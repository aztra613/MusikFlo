import React, { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { Accidental, NoteDuration, Score, ScoreNote, cloneEvents } from '../types/music';
import { createBlankScore } from '../data/samples';
import { loadProject, saveProject } from '../storage/db';
import { audioEngine } from '../audio/audioEngine';
import {
  NO_SELECTION,
  Selection,
  addMeasure,
  createEditorState,
  deleteEvent,
  editorReducer,
  insertEvent,
  makeEventId,
  makeMeasureId,
  neighbourEventId,
  removeMeasure,
  replaceMeasureEvents,
  updateEvent,
} from '../editor/editorReducer';
import { MEASURES_PER_ROW } from '../score/geometry';
import { shiftDiatonic } from '../utils/notationUtils';
import { TopBar, SaveStatus } from './TopBar';
import { ScoreSetupStrip } from './ScoreSetupStrip';
import { NotationPalette } from './NotationPalette';
import { ScoreCanvas, EditorTool } from './ScoreCanvas';
import { Inspector } from './Inspector';
import { TransportDock } from './TransportDock';
import { HelpModal } from './HelpModal';
import { AudioToScoreFlow } from './AudioToScoreFlow';
import { Sparkles, SlidersHorizontal, X, AudioLines } from 'lucide-react';

interface StudioProps {
  initialScore: Score;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onGoHome: () => void;
  onScoreChange: (score: Score) => void;
}

interface Toast {
  id: number;
  message: string;
  kind: 'success' | 'error';
}

const PANEL_LABELS: Record<EditorTool, string> = {
  select: 'Select',
  note: 'Note',
  rest: 'Rest',
  eraser: 'Eraser',
};

/** A shortcut must not fire while the user is typing or operating a control. */
function isInteractiveTarget(target: EventTarget | null): boolean {
  const element = target as HTMLElement | null;
  if (!element || typeof element.closest !== 'function') return false;
  return !!element.closest('input, textarea, select, button, a, [contenteditable="true"], [role="menu"], [role="dialog"]');
}

/**
 * Modal shell for the transcription flow.
 *
 * Moves focus into the dialog on open, closes on Escape, and restores focus to
 * whatever was focused before — the same focus contract the help dialog uses.
 */
const TranscriptionOverlay: React.FC<{ onClose: () => void; children: React.ReactNode }> = ({
  onClose,
  children,
}) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      previouslyFocused.current?.focus?.();
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 backdrop-blur-xs p-4 sm:p-8">
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="Convert audio to sheet music"
        className="w-full max-w-3xl focus:outline-none"
        onPointerDown={(event) => event.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
};

export const Studio: React.FC<StudioProps> = ({ initialScore, theme, onToggleTheme, onGoHome, onScoreChange }) => {
  const [state, dispatch] = useReducer(editorReducer, initialScore, createEditorState);
  const { score, selection, revision } = state;

  const [activeDuration, setActiveDuration] = useState<NoteDuration>('4');
  const [activeAccidental, setActiveAccidental] = useState<Accidental | ''>('');
  const [activeDotted, setActiveDotted] = useState(false);
  const [activeTool, setActiveTool] = useState<EditorTool>('select');
  const [learningMode, setLearningMode] = useState(false);

  const [copiedMeasure, setCopiedMeasure] = useState<{ events: ScoreNote[]; sourceIndex: number } | null>(null);
  const [mobilePanel, setMobilePanel] = useState<'none' | 'palette' | 'inspector'>('none');
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isTranscribeOpen, setIsTranscribeOpen] = useState(false);
  const [showFirstRunHint, setShowFirstRunHint] = useState(() => {
    try {
      return !localStorage.getItem('musikflo_dismissed_hint');
    } catch {
      return true;
    }
  });

  const selectedNoteId = selection.kind === 'event' ? selection.noteId : null;
  const selectedMeasureIndex = selection.kind === 'measure' ? selection.measureIndex : null;

  const selectedNote = useMemo(() => {
    if (!selectedNoteId) return null;
    for (const measure of score.measures) {
      const found = measure.events.find((n) => n.id === selectedNoteId);
      if (found) return found;
    }
    return null;
  }, [selectedNoteId, score]);

  /* ------------------------------ feedback ------------------------------ */

  const toastId = useRef(0);
  const notify = useCallback((message: string, kind: 'success' | 'error' = 'success') => {
    const id = ++toastId.current;
    setToasts((prev) => [...prev.slice(-2), { id, message, kind }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3600);
  }, []);

  /* ------------------------------- saving ------------------------------- */

  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
  const savedRevision = useRef(-1);

  // The playhead is fed by the real audio timeline, the same subscription the
  // transport uses. Previously a single overwritable callback meant only one of
  // the two consumers ever received ticks.
  const [activePlayhead, setActivePlayhead] = useState<{
    measureIndex: number;
    eventIndex: number;
    isPlaying: boolean;
  } | null>(null);

  useEffect(() => {
    return audioEngine.subscribePlaybackTick((tick) => {
      setActivePlayhead(
        tick.isPlaying ? { measureIndex: tick.measureIndex, eventIndex: tick.eventIndex, isPlaying: true } : null
      );
    });
  }, []);

  useEffect(() => {
    onScoreChange(score);
  }, [score, onScoreChange]);

  // Debounced autosave keyed on the editor revision. The previous implementation
  // flipped its own `saveStatus` dependency and cancelled the timer it had just
  // scheduled, so nothing was ever written.
  useEffect(() => {
    if (revision === savedRevision.current) return;
    setSaveStatus('saving');

    const timer = setTimeout(async () => {
      const result = await saveProject(score);
      if (result.ok) {
        savedRevision.current = revision;
        setSaveStatus('saved');
      } else {
        setSaveStatus('error');
        notify('Your work could not be saved in this browser. Export a backup now.', 'error');
      }
    }, 800);

    return () => clearTimeout(timer);
  }, [revision, score, notify]);

  // Editing while playing would leave the visual playhead pointing at stale
  // indices, so the policy is explicit: changing the score stops playback.
  useEffect(() => {
    if (audioEngine.getIsPlaying()) {
      audioEngine.stop();
      notify('Playback stopped because the score changed.', 'success');
    }
  }, [score, notify]);

  /* ------------------------------ mutations ----------------------------- */

  const handleUpdateTitle = useCallback((title: string) => {
    dispatch({ type: 'mutate', mutate: (s) => ({ ...s, title, updatedAt: Date.now() }) });
  }, []);

  const handleUpdateScoreSettings = useCallback((updates: Partial<Score>) => {
    dispatch({ type: 'mutate', mutate: (s) => ({ ...s, ...updates, updatedAt: Date.now() }) });
  }, []);

  const handleAddMeasure = useCallback(() => {
    dispatch({ type: 'mutate', mutate: (s) => addMeasure(s) });
  }, []);

  const handleRemoveMeasure = useCallback(() => {
    dispatch({ type: 'mutate', mutate: (s) => removeMeasure(s), selection: 'auto' });
  }, []);

  const handleDuplicateMeasure = useCallback(
    (sourceIndex: number) => {
      const targetIndex = sourceIndex + 1;
      const source = score.measures[sourceIndex];
      if (!source) return;

      dispatch({
        type: 'mutate',
        mutate: (s) => {
          const src = s.measures[sourceIndex];
          if (!src) return null;
          const cloned = cloneEvents(src.events);

          if (targetIndex < s.measures.length) {
            const existing = s.measures[targetIndex];
            if (existing.events.length === 0) {
              return replaceMeasureEvents(s, targetIndex, cloned);
            }
            const measures = s.measures.slice();
            measures.splice(targetIndex, 0, { id: makeMeasureId(targetIndex), events: cloned });
            return { ...s, measures, updatedAt: Date.now() };
          }

          return {
            ...s,
            measures: [...s.measures, { id: makeMeasureId(s.measures.length), events: cloned }],
            updatedAt: Date.now(),
          };
        },
        selection: { kind: 'measure', measureIndex: Math.min(targetIndex, score.measures.length) },
      });

      notify(`Duplicated Bar ${sourceIndex + 1}.`);
    },
    [notify, score.measures]
  );

  const handleDuplicateLine = useCallback(
    (lineIndex: number) => {
      const startIndex = lineIndex * MEASURES_PER_ROW;
      const endIndex = Math.min(score.measures.length, startIndex + MEASURES_PER_ROW);
      if (startIndex >= endIndex) return;

      dispatch({
        type: 'mutate',
        mutate: (s) => {
          const start = lineIndex * MEASURES_PER_ROW;
          const end = Math.min(s.measures.length, start + MEASURES_PER_ROW);
          if (start >= end) return null;

          const cloned = s.measures.slice(start, end).map((m, i) => ({
            id: makeMeasureId(start + i),
            events: cloneEvents(m.events),
          }));

          return {
            ...s,
            measures: [...s.measures.slice(0, end), ...cloned, ...s.measures.slice(end)],
            updatedAt: Date.now(),
          };
        },
        selection: { kind: 'measure', measureIndex: endIndex },
      });

      notify(`Duplicated Line ${lineIndex + 1} (Bars ${startIndex + 1}–${endIndex}).`);
    },
    [notify, score.measures]
  );

  const handleCopyMeasure = useCallback(
    (measureIndex: number) => {
      const source = score.measures[measureIndex];
      if (!source) return;
      setCopiedMeasure({ events: source.events, sourceIndex: measureIndex });
      notify(`Copied Bar ${measureIndex + 1}. Use Paste or Ctrl+V.`);
    },
    [notify, score.measures]
  );

  const handlePasteMeasure = useCallback(
    (targetIndex: number) => {
      if (!copiedMeasure) {
        notify('Copy a bar first.', 'error');
        return;
      }
      dispatch({
        type: 'mutate',
        mutate: (s) => replaceMeasureEvents(s, targetIndex, cloneEvents(copiedMeasure.events)),
      });
      notify(`Pasted into Bar ${targetIndex + 1}.`);
    },
    [copiedMeasure, notify]
  );

  const handleClearMeasure = useCallback(
    (measureIndex: number) => {
      dispatch({
        type: 'mutate',
        mutate: (s) => (s.measures[measureIndex]?.events.length ? replaceMeasureEvents(s, measureIndex, []) : null),
        selection: 'auto',
      });
      notify(`Cleared Bar ${measureIndex + 1}.`);
    },
    [notify]
  );

  const handleInsertEvent = useCallback((measureIndex: number, index: number, event: Omit<ScoreNote, 'id'>) => {
    const id = makeEventId();
    dispatch({
      type: 'mutate',
      mutate: (s) => insertEvent(s, measureIndex, index, event, id),
      selection: { kind: 'event', noteId: id },
    });
  }, []);

  const handleUpdateNote = useCallback((noteId: string, updates: Partial<ScoreNote>) => {
    dispatch({ type: 'mutate', mutate: (s) => updateEvent(s, noteId, updates) });
  }, []);

  const handleDeleteNote = useCallback(
    (noteId: string) => {
      const nextSelection: Selection = (() => {
        const neighbour = neighbourEventId(score, noteId);
        return neighbour ? { kind: 'event', noteId: neighbour } : NO_SELECTION;
      })();
      dispatch({ type: 'mutate', mutate: (s) => deleteEvent(s, noteId), selection: nextSelection });
    },
    [score]
  );

  const handleSelectNote = useCallback((noteId: string | null) => {
    dispatch({ type: 'select', selection: noteId ? { kind: 'event', noteId } : NO_SELECTION });
  }, []);

  const handleSelectMeasure = useCallback((measureIndex: number | null) => {
    dispatch({
      type: 'select',
      selection: measureIndex === null ? NO_SELECTION : { kind: 'measure', measureIndex },
    });
  }, []);

  const handleNewScore = useCallback(() => {
    if (!window.confirm('Start a new blank score? The current score will be replaced (Ctrl+Z cannot undo this).')) return;
    audioEngine.stop();
    dispatch({ type: 'reset', score: createBlankScore() });
    setCopiedMeasure(null);
    notify('Started a new blank score.');
  }, [notify]);

  const handleImportScore = useCallback(
    (imported: Score) => {
      audioEngine.stop();
      dispatch({ type: 'reset', score: imported });
      setCopiedMeasure(null);
    },
    []
  );

  /**
   * Accept a transcription as a brand-new composition.
   *
   * The composition already open is flushed to browser storage first, so it stays
   * recoverable through the Recent menu, and the user is asked to confirm when
   * there are edits that have not been persisted yet. The transcription is never
   * written over the open score, and undo history starts clean because this is a
   * different project rather than an edit of the current one.
   */
  const handleAcceptTranscription = useCallback(
    async (next: Score) => {
      if (saveStatus !== 'saved') {
        const proceed = window.confirm(
          `Open “${next.title}” as a new composition?\n\nYour current score still has unsaved changes. It will be saved in this browser first, and remains available from the Recent menu.`
        );
        if (!proceed) return;
      }

      // Persist the current project under its own id before switching away.
      const flushed = await saveProject(score);
      if (!flushed.ok) {
        notify('Your current score could not be saved, so it was kept open instead.', 'error');
        return;
      }

      audioEngine.stop();
      dispatch({ type: 'reset', score: next });
      setCopiedMeasure(null);
      setIsTranscribeOpen(false);
      notify(`Opened “${next.title}” as a new composition.`);
    },
    [notify, saveStatus, score]
  );

  /** Re-open a project already stored in this browser. */
  const handleOpenRecentProject = useCallback(
    async (id: string) => {
      if (id === score.id) {
        notify('That project is already open.');
        return;
      }

      if (saveStatus !== 'saved') {
        const proceed = window.confirm(
          'Open a different saved project?\n\nYour current score has unsaved changes. It will be saved in this browser first.'
        );
        if (!proceed) return;
      }

      const flushed = await saveProject(score);
      if (!flushed.ok) {
        notify('Your current score could not be saved, so it was kept open instead.', 'error');
        return;
      }

      const restored = await loadProject(id);
      if (!restored) {
        notify('That project could not be opened.', 'error');
        return;
      }

      audioEngine.stop();
      dispatch({ type: 'reset', score: restored });
      setCopiedMeasure(null);
      notify(`Opened “${restored.title}”.`);
    },
    [notify, saveStatus, score]
  );

  /* ------------------------------ shortcuts ----------------------------- */

  const handleUndo = useCallback(() => dispatch({ type: 'undo' }), []);
  const handleRedo = useCallback(() => dispatch({ type: 'redo' }), []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isInteractiveTarget(event.target)) return;

      const mod = event.ctrlKey || event.metaKey;
      const key = event.key.toLowerCase();

      if (mod && key === 'z') {
        event.preventDefault();
        if (event.shiftKey) handleRedo();
        else handleUndo();
        return;
      }
      if (mod && key === 'y') {
        event.preventDefault();
        handleRedo();
        return;
      }
      if (mod && key === 'd') {
        event.preventDefault();
        handleDuplicateMeasure(selectedMeasureIndex ?? score.measures.length - 1);
        return;
      }
      if (mod && key === 'c') {
        if (selectedMeasureIndex === null) return;
        event.preventDefault();
        handleCopyMeasure(selectedMeasureIndex);
        return;
      }
      if (mod && key === 'v') {
        if (!copiedMeasure) return;
        event.preventDefault();
        handlePasteMeasure(selectedMeasureIndex ?? score.measures.length - 1);
        return;
      }

      if (event.code === 'Space') {
        event.preventDefault();
        if (audioEngine.getIsPlaying()) audioEngine.stop();
        else void audioEngine.playScore(score);
        return;
      }

      if (event.key === 'Escape') {
        if (selection.kind !== 'none') dispatch({ type: 'select', selection: NO_SELECTION });
        return;
      }

      if (!selectedNote) return;

      if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault();
        handleDeleteNote(selectedNote.id);
        return;
      }

      if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
        if (selectedNote.isRest) return;
        event.preventDefault();
        const delta = event.key === 'ArrowUp' ? 1 : -1;
        const { step, octave } = shiftDiatonic(selectedNote.step, selectedNote.octave, delta);
        handleUpdateNote(selectedNote.id, { step, octave });
        audioEngine.previewNote({ ...selectedNote, step, octave }, score.instrument);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    copiedMeasure,
    handleCopyMeasure,
    handleDeleteNote,
    handleDuplicateMeasure,
    handlePasteMeasure,
    handleRedo,
    handleUndo,
    handleUpdateNote,
    score,
    selectedMeasureIndex,
    selectedNote,
    selection.kind,
  ]);

  // Release audio when leaving the studio.
  useEffect(() => () => audioEngine.stop(), []);

  const dismissHint = () => {
    setShowFirstRunHint(false);
    try {
      localStorage.setItem('musikflo_dismissed_hint', 'true');
    } catch {
      // Storage can be unavailable; the hint simply reappears next time.
    }
  };

  const palette = (
    <NotationPalette
      activeDuration={activeDuration}
      onSelectDuration={setActiveDuration}
      activeAccidental={activeAccidental}
      onSelectAccidental={setActiveAccidental}
      activeDotted={activeDotted}
      onToggleDotted={() => setActiveDotted((d) => !d)}
      activeTool={activeTool}
      onSelectTool={setActiveTool}
      learningMode={learningMode}
      onToggleLearningMode={() => setLearningMode((l) => !l)}
    />
  );

  const inspector = (
    <Inspector
      score={score}
      selectedNoteId={selectedNoteId}
      onUpdateNote={handleUpdateNote}
      onDeleteNote={handleDeleteNote}
      onClose={() => handleSelectNote(null)}
    />
  );

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-app-bg text-text-primary">
      <TopBar
        score={score}
        onUpdateTitle={handleUpdateTitle}
        saveStatus={saveStatus}
        canUndo={state.past.length > 0}
        canRedo={state.future.length > 0}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onNewScore={handleNewScore}
        onImportScore={handleImportScore}
        theme={theme}
        onToggleTheme={onToggleTheme}
        onOpenHelp={() => setIsHelpOpen(true)}
        onGoHome={onGoHome}
        onNotify={notify}
        onTranscribeAudio={() => setIsTranscribeOpen(true)}
        onOpenRecentProject={(id) => void handleOpenRecentProject(id)}
      />

      <ScoreSetupStrip
        score={score}
        onUpdateScore={handleUpdateScoreSettings}
        onAddMeasure={handleAddMeasure}
        onRemoveMeasure={handleRemoveMeasure}
        onDuplicateMeasure={handleDuplicateMeasure}
        onDuplicateLine={handleDuplicateLine}
        selectedMeasureIndex={selectedMeasureIndex}
        onSelectMeasure={handleSelectMeasure}
        hasCopiedMeasure={!!copiedMeasure}
        onPasteMeasure={handlePasteMeasure}
      />

      {showFirstRunHint && (
        <div className="flex items-center justify-between gap-3 px-4 py-2 bg-primary-soft text-primary text-xs font-medium border-b border-primary/20">
          <div className="flex items-center gap-2">
            <Sparkles size={14} className="shrink-0" aria-hidden="true" />
            <span>
              Pick the <strong>Note</strong> tool, choose a value, then click a staff line or space to place your first note.
            </span>
          </div>
          <button
            type="button"
            onClick={dismissHint}
            className="p-1 hover:bg-primary/20 rounded transition-colors"
            title="Dismiss this hint"
            aria-label="Dismiss this hint"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Mobile panel switches */}
      <div className="md:hidden flex items-center gap-2 px-4 py-2 border-b border-border bg-surface">
        <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">Tool: {PANEL_LABELS[activeTool]}</span>
        <div className="ml-auto flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setIsTranscribeOpen(true)}
            aria-label="Transcribe audio"
            className="flex items-center gap-1 px-2.5 py-1 rounded-md border border-border bg-app-bg text-xs font-medium text-text-primary"
          >
            <AudioLines size={12} />
            Transcribe
          </button>
          <button
            type="button"
            onClick={() => setMobilePanel((p) => (p === 'palette' ? 'none' : 'palette'))}
            aria-expanded={mobilePanel === 'palette'}
            className="px-2.5 py-1 rounded-md border border-border bg-app-bg text-xs font-medium text-text-primary"
          >
            Notation
          </button>
          <button
            type="button"
            onClick={() => setMobilePanel((p) => (p === 'inspector' ? 'none' : 'inspector'))}
            aria-expanded={mobilePanel === 'inspector'}
            className="flex items-center gap-1 px-2.5 py-1 rounded-md border border-border bg-app-bg text-xs font-medium text-text-primary"
          >
            <SlidersHorizontal size={12} />
            Inspect
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden relative">
        <div className="hidden md:flex">{palette}</div>

        <main className="flex-1 flex flex-col overflow-hidden relative" role="main">
          <ScoreCanvas
            score={score}
            selection={selection}
            onSelectNote={handleSelectNote}
            onSelectMeasure={handleSelectMeasure}
            onInsertEvent={handleInsertEvent}
            onUpdateNote={handleUpdateNote}
            onDeleteNote={handleDeleteNote}
            onDuplicateMeasure={handleDuplicateMeasure}
            onDuplicateLine={handleDuplicateLine}
            onCopyMeasure={handleCopyMeasure}
            onPasteMeasure={handlePasteMeasure}
            onClearMeasure={handleClearMeasure}
            copiedMeasureIndex={copiedMeasure?.sourceIndex ?? null}
            hasCopiedMeasure={!!copiedMeasure}
            activeDuration={activeDuration}
            activeAccidental={activeAccidental}
            activeDotted={activeDotted}
            activeTool={activeTool}
            learningMode={learningMode}
            activePlayhead={activePlayhead}
            theme={theme}
          />
        </main>

        <div className="hidden md:flex">{inspector}</div>
      </div>

      <TransportDock
        score={score}
        onUpdateScore={handleUpdateScoreSettings}
        selectedMeasureIndex={selectedMeasureIndex}
        activePlayhead={activePlayhead}
      />

      {/* Mobile drawers */}
      {mobilePanel !== 'none' && (
        <div className="md:hidden fixed inset-0 z-40 flex" role="dialog" aria-modal="true" aria-label={mobilePanel === 'palette' ? 'Notation palette' : 'Inspector'}>
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobilePanel('none')} aria-hidden="true" />
          <div className="relative w-[85%] max-w-xs h-full bg-surface shadow-2xl overflow-y-auto">
            <div className="flex items-center justify-between px-4 py-2 border-b border-border">
              <span className="text-xs font-bold uppercase tracking-wider text-text-primary">
                {mobilePanel === 'palette' ? 'Notation' : 'Inspector'}
              </span>
              <button
                type="button"
                onClick={() => setMobilePanel('none')}
                className="p-1 rounded-md text-text-muted hover:text-text-primary"
                aria-label="Close panel"
              >
                <X size={16} />
              </button>
            </div>
            {mobilePanel === 'palette' ? palette : inspector}
          </div>
        </div>
      )}

      <HelpModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />

      {/* Audio to sheet music. Rendered as an overlay so the open composition
          and its undo history are never unmounted while transcribing. */}
      {isTranscribeOpen && (
        <TranscriptionOverlay onClose={() => setIsTranscribeOpen(false)}>
          <AudioToScoreFlow
            embedded
            theme={theme}
            onExit={() => setIsTranscribeOpen(false)}
            onAccept={(next) => void handleAcceptTranscription(next)}
            describeAcceptance={(candidate) =>
              `Opens as a new composition called “${candidate.title}”. “${score.title}” stays saved in this browser and is available from the Recent menu.`
            }
          />
        </TranscriptionOverlay>
      )}

      <div className="fixed bottom-20 right-6 z-50 flex flex-col gap-2 items-end" aria-live="polite">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border text-xs font-semibold shadow-lg max-w-xs ${
              toast.kind === 'error'
                ? 'bg-danger-bg border-danger/40 text-danger'
                : 'bg-surface-raised border-primary/40 text-text-primary'
            }`}
          >
            <Sparkles size={14} className="shrink-0" aria-hidden="true" />
            <span>{toast.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
