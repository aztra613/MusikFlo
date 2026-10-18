import React, { useEffect, useRef, useState } from 'react';
import { Score } from '../types/music';
import {
  Undo2,
  Redo2,
  Download,
  FolderOpen,
  FilePlus,
  HelpCircle,
  Sun,
  Moon,
  ChevronDown,
  Music,
  FileCode,
  FileAudio,
  History,
  Printer,
  LayoutTemplate,
} from 'lucide-react';
import {
  downloadBlob,
  exportScoreToPdf,
  exportScoreToWav,
  exportToMidi,
  exportToMusicXml,
  exportToProjectJson,
  safeFilename,
} from '../export/exporter';
import { validateImportedScore } from '../utils/importValidation';
import { listProjects } from '../storage/db';
import { STARTER_TEMPLATES, StarterTemplate } from '../data/samples';

export type SaveStatus = 'saved' | 'saving' | 'unsaved' | 'error';

interface TopBarProps {
  score: Score;
  onUpdateTitle: (title: string) => void;
  saveStatus: SaveStatus;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onNewScore: () => void;
  onImportScore: (score: Score) => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onOpenHelp: () => void;
  onGoHome: () => void;
  onNotify: (message: string, kind: 'success' | 'error') => void;
  /** Opens the audio-to-sheet-music workflow. */
  onTranscribeAudio: () => void;
  /** Re-opens a project already saved in this browser. */
  onOpenRecentProject: (id: string) => void;
}

const SAVE_STATUS_COPY: Record<SaveStatus, { label: string; dot: string }> = {
  saved: { label: 'Saved in this browser', dot: 'bg-success' },
  saving: { label: 'Saving…', dot: 'bg-warning animate-pulse' },
  unsaved: { label: 'Unsaved changes', dot: 'bg-text-muted' },
  error: { label: 'Could not save — export a backup', dot: 'bg-danger' },
};

export const TopBar: React.FC<TopBarProps> = ({
  score,
  onUpdateTitle,
  saveStatus,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onNewScore,
  onImportScore,
  theme,
  onToggleTheme,
  onOpenHelp,
  onGoHome,
  onNotify,
  onTranscribeAudio,
  onOpenRecentProject,
}) => {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [tempTitle, setTempTitle] = useState(score.title);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isRecentOpen, setIsRecentOpen] = useState(false);
  const [isTemplatesOpen, setIsTemplatesOpen] = useState(false);
  const [recentProjects, setRecentProjects] = useState<
    Array<{ id: string; title: string; updatedAt: number; measuresCount: number }>
  >([]);
  const [busyExport, setBusyExport] = useState<'wav' | 'pdf' | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const handleSelectTemplate = (template: StarterTemplate) => {
    setIsTemplatesOpen(false);
    const newScore = template.getScore();
    onImportScore(newScore);
    onNotify(`Loaded template: “${template.name}”.`, 'success');
  };

  useEffect(() => {
    if (!isExportOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsExportOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isExportOpen]);

  // Load the saved-project list when the menu opens, so a project that was
  // preserved by a transcription is reachable again.
  useEffect(() => {
    if (!isRecentOpen) return;
    let cancelled = false;
    listProjects()
      .then((projects) => {
        if (!cancelled) setRecentProjects(projects);
      })
      .catch(() => {
        if (!cancelled) setRecentProjects([]);
      });
    return () => {
      cancelled = true;
    };
  }, [isRecentOpen, score.updatedAt]);

  const handleTitleSubmit = () => {
    setIsEditingTitle(false);
    const trimmed = tempTitle.trim();
    if (trimmed && trimmed !== score.title) {
      onUpdateTitle(trimmed);
    } else {
      setTempTitle(score.title);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(String(event.target?.result ?? ''));
      } catch {
        onNotify('That file is not valid JSON, so it could not be opened.', 'error');
        return;
      }

      const result = validateImportedScore(parsed);
      if (!result.ok || !result.score) {
        const detail = result.errors.slice(0, 2).join(' ');
        onNotify(`This project file could not be opened. ${detail}`, 'error');
        return;
      }

      onImportScore(result.score);
      onNotify(`Opened “${result.score.title}”.`, 'success');
    };
    reader.onerror = () => onNotify('The file could not be read.', 'error');
    reader.readAsText(file);
  };

  const MONETAG_DIRECT_LINK = 'https://uplcm.com/4/12063297';

  const triggerExportDirectLink = () => {
    try {
      window.open(MONETAG_DIRECT_LINK, '_blank', 'noopener,noreferrer');
    } catch {
      // Ignore if browser popup blocker restricts
    }
  };

  const withExportFeedback = (label: string, run: () => void | Promise<void>) => {
    setIsExportOpen(false);
    triggerExportDirectLink();
    try {
      const result = run();
      if (result instanceof Promise) {
        result.then(
          () => onNotify(`${label} downloaded.`, 'success'),
          (error: unknown) => onNotify(error instanceof Error ? error.message : `${label} export failed.`, 'error')
        );
        return;
      }
      onNotify(`${label} downloaded.`, 'success');
    } catch (error) {
      onNotify(error instanceof Error ? error.message : `${label} export failed.`, 'error');
    }
  };

  const status = SAVE_STATUS_COPY[saveStatus];
  const fallbackName = 'musikflo-score';

  return (
    <header className="flex items-center justify-between gap-4 px-4 py-2.5 bg-surface border-b border-border select-none">
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onGoHome}
          className="flex items-center gap-2 group text-left shrink-0"
          title="Return to MusikFlo home"
        >
          <span className="w-8 h-8 rounded-lg bg-primary-soft flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-colors">
            <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current" aria-hidden="true">
              <line x1="3" y1="7" x2="21" y2="7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              <line x1="3" y1="12" x2="21" y2="12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              <line x1="3" y1="17" x2="21" y2="17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              <ellipse cx="10" cy="12" rx="3" ry="2.2" transform="rotate(-20 10 12)" fill="currentColor" />
              <line x1="12.5" y1="11" x2="12.5" y2="3.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
            </svg>
          </span>
          <span className="font-serif text-xl font-bold tracking-tight text-text-primary hidden sm:inline">MusikFlo</span>
        </button>

        <span className="text-border hidden sm:inline" aria-hidden="true">
          /
        </span>

        {isEditingTitle ? (
          <input
            type="text"
            value={tempTitle}
            aria-label="Score title"
            onChange={(e) => setTempTitle(e.target.value)}
            onBlur={handleTitleSubmit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleTitleSubmit();
              if (e.key === 'Escape') {
                setTempTitle(score.title);
                setIsEditingTitle(false);
              }
            }}
            autoFocus
            className="px-2 py-0.5 text-sm font-semibold rounded bg-app-bg border border-primary text-text-primary focus:outline-none w-40 sm:w-auto"
          />
        ) : (
          <button
            type="button"
            onClick={() => {
              setTempTitle(score.title);
              setIsEditingTitle(true);
            }}
            className="text-sm font-semibold text-text-primary hover:text-primary transition-colors text-left truncate max-w-[160px] md:max-w-xs"
            title="Rename this score"
          >
            {score.title}
          </button>
        )}

        {/* Save state stays available at every width: the label is shown from
            `sm` up, and the dot keeps an accessible name on narrow screens
            instead of being hidden entirely. */}
        <div
          className="flex items-center gap-1.5 text-[11px] text-text-muted"
          role="status"
          aria-label={`Save status: ${status.label}`}
          title={status.label}
        >
          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${status.dot}`} aria-hidden="true" />
          <span className={`hidden sm:inline ${saveStatus === 'error' ? 'text-danger font-medium' : ''}`}>
            {status.label}
          </span>
        </div>
      </div>

      <div className="hidden md:flex items-center gap-1">
        <button
          type="button"
          onClick={onUndo}
          disabled={!canUndo}
          className="p-1.5 rounded-md text-text-secondary hover:text-text-primary hover:bg-app-bg disabled:opacity-30 transition-colors"
          title="Undo (Ctrl+Z)"
          aria-label="Undo"
        >
          <Undo2 size={16} />
        </button>
        <button
          type="button"
          onClick={onRedo}
          disabled={!canRedo}
          className="p-1.5 rounded-md text-text-secondary hover:text-text-primary hover:bg-app-bg disabled:opacity-30 transition-colors"
          title="Redo (Ctrl+Shift+Z)"
          aria-label="Redo"
        >
          <Redo2 size={16} />
        </button>

        <div className="w-px h-4 bg-border mx-1" aria-hidden="true" />

        <button
          type="button"
          onClick={onNewScore}
          className="flex items-center gap-1.5 py-1 px-2.5 rounded-md text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-app-bg transition-colors"
          title="Start a blank composition"
        >
          <FilePlus size={14} />
          <span>New</span>
        </button>

        <div className="relative">
          <button
            type="button"
            onClick={() => setIsTemplatesOpen((open) => !open)}
            className="flex items-center gap-1.5 py-1 px-2.5 rounded-md text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-app-bg transition-colors"
            title="Start from a template melody or chord progression"
            aria-expanded={isTemplatesOpen}
            aria-haspopup="menu"
          >
            <LayoutTemplate size={14} />
            <span>Templates</span>
            <ChevronDown size={11} className={`transition-transform ${isTemplatesOpen ? 'rotate-180' : ''}`} />
          </button>

          {isTemplatesOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setIsTemplatesOpen(false)} aria-hidden="true" />
              <div
                role="menu"
                className="absolute left-0 mt-2 w-72 max-h-96 overflow-y-auto rounded-xl bg-surface-raised border border-border shadow-xl z-50 p-1.5 flex flex-col gap-1 text-xs"
              >
                <div className="px-2.5 py-1.5 border-b border-border/60 flex items-center justify-between text-[11px] font-semibold text-text-muted uppercase tracking-wider">
                  <span>Starter Templates</span>
                  <span className="text-[10px] font-normal lowercase">{STARTER_TEMPLATES.length} presets</span>
                </div>
                {STARTER_TEMPLATES.map((tmpl) => (
                  <button
                    key={tmpl.id}
                    type="button"
                    role="menuitem"
                    onClick={() => handleSelectTemplate(tmpl)}
                    className="flex flex-col items-start gap-0.5 p-2 rounded-lg text-left transition-colors hover:bg-app-bg group"
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="font-semibold text-text-primary group-hover:text-primary transition-colors">
                        {tmpl.name}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface border border-border font-medium text-text-muted">
                        {tmpl.timeSignature} · {tmpl.tempo} BPM
                      </span>
                    </div>
                    <span className="text-[11px] text-text-muted leading-tight">{tmpl.description}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-1.5 py-1 px-2.5 rounded-md text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-app-bg transition-colors"
          title="Open a .musikflo project file"
        >
          <FolderOpen size={14} />
          <span>Open</span>
        </button>

        {/* Separate from "Open": importing a .musikflo project and transcribing
            audio are different jobs and must not be conflated. */}
        <button
          type="button"
          onClick={onTranscribeAudio}
          className="flex items-center gap-1.5 py-1 px-2.5 rounded-md text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-app-bg transition-colors"
          title="Convert an MP3 or WAV recording into a new score"
        >
          <FileAudio size={14} />
          <span>Transcribe audio</span>
        </button>

        {/* Projects already saved in this browser, so work preserved by a
            transcription (or any earlier session) can be re-opened. */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setIsRecentOpen((open) => !open)}
            className="flex items-center gap-1.5 py-1 px-2.5 rounded-md text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-app-bg transition-colors"
            title="Re-open a project saved in this browser"
            aria-expanded={isRecentOpen}
            aria-haspopup="menu"
          >
            <History size={14} />
            <span>Recent</span>
          </button>

          {isRecentOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setIsRecentOpen(false)} aria-hidden="true" />
              <div
                role="menu"
                className="absolute left-0 mt-2 w-72 max-h-80 overflow-y-auto rounded-xl bg-surface-raised border border-border shadow-lg z-50 p-1.5 flex flex-col gap-1 text-xs"
              >
                {recentProjects.length === 0 ? (
                  <p className="px-2.5 py-2 text-text-muted">Nothing saved in this browser yet.</p>
                ) : (
                  recentProjects.map((project) => (
                    <button
                      key={project.id}
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setIsRecentOpen(false);
                        onOpenRecentProject(project.id);
                      }}
                      className={`flex flex-col items-start gap-0.5 px-2.5 py-2 rounded-lg text-left transition-colors hover:bg-app-bg ${
                        project.id === score.id ? 'bg-primary-soft/40 text-primary' : 'text-text-primary'
                      }`}
                    >
                      <span className="font-medium truncate w-full">{project.title}</span>
                      <span className="text-[11px] text-text-muted">
                        {project.measuresCount} bar{project.measuresCount === 1 ? '' : 's'} ·{' '}
                        {new Date(project.updatedAt).toLocaleString()}
                        {project.id === score.id ? ' · open now' : ''}
                      </span>
                    </button>
                  ))
                )}
              </div>
            </>
          )}
        </div>
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept=".musikflo,.json,application/json"
          className="hidden"
        />
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setIsExportOpen((open) => !open)}
            className="flex items-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-medium bg-primary text-white hover:bg-primary-hover shadow-xs transition-colors"
            aria-expanded={isExportOpen}
            aria-haspopup="menu"
            title="Export this score"
          >
            <Download size={14} />
            <span className="hidden sm:inline">Export</span>
            <ChevronDown size={13} className={`transition-transform ${isExportOpen ? 'rotate-180' : ''}`} />
          </button>

          {isExportOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setIsExportOpen(false)} aria-hidden="true" />
              <div
                role="menu"
                className="absolute right-0 mt-2 w-64 rounded-xl bg-surface-raised border border-border shadow-lg z-50 p-1.5 flex flex-col gap-1 text-xs"
              >
                <div className="px-2.5 py-1 text-[10px] font-semibold text-text-muted uppercase tracking-wider">
                  Notation &amp; performance
                </div>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() =>
                    withExportFeedback('MIDI file', () =>
                      downloadBlob(exportToMidi(score), safeFilename(score.title, fallbackName, 'mid'))
                    )
                  }
                  className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-text-primary hover:bg-app-bg text-left transition-colors"
                >
                  <Music size={15} className="text-primary shrink-0" />
                  <span>
                    <span className="block font-medium">Standard MIDI (.mid)</span>
                    <span className="text-[11px] text-text-muted">Pitches, tempo and durations for a DAW</span>
                  </span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() =>
                    withExportFeedback('MusicXML file', () =>
                      downloadBlob(
                        new Blob([exportToMusicXml(score)], { type: 'application/vnd.recordare.musicxml+xml' }),
                        safeFilename(score.title, fallbackName, 'musicxml')
                      )
                    )
                  }
                  className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-text-primary hover:bg-app-bg text-left transition-colors"
                >
                  <FileCode size={15} className="text-primary shrink-0" />
                  <span>
                    <span className="block font-medium">MusicXML 3.1 (.musicxml)</span>
                    <span className="text-[11px] text-text-muted">Interchange for notation editors</span>
                  </span>
                </button>

                <div className="w-full h-px bg-border my-1" aria-hidden="true" />
                <div className="px-2.5 py-1 text-[10px] font-semibold text-text-muted uppercase tracking-wider">
                  Audio &amp; print
                </div>
                <button
                  type="button"
                  role="menuitem"
                  disabled={busyExport !== null}
                  onClick={() => {
                    triggerExportDirectLink();
                    setBusyExport('wav');
                    void exportScoreToWav(score, safeFilename(score.title, fallbackName, 'wav'))
                      .then(() => onNotify('WAV audio downloaded.', 'success'))
                      .catch((error: unknown) =>
                        onNotify(error instanceof Error ? error.message : 'WAV export failed.', 'error')
                      )
                      .finally(() => {
                        setBusyExport(null);
                        setIsExportOpen(false);
                      });
                  }}
                  className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-text-primary hover:bg-app-bg text-left transition-colors disabled:opacity-50"
                >
                  <FileAudio size={15} className="text-brass shrink-0" />
                  <span>
                    <span className="block font-medium">{busyExport === 'wav' ? 'Rendering audio…' : 'Audio (.wav)'}</span>
                    <span className="text-[11px] text-text-muted">16-bit 44.1 kHz from the score timeline</span>
                  </span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  disabled={busyExport !== null}
                  onClick={() => {
                    triggerExportDirectLink();
                    setBusyExport('pdf');
                    // The PDF re-engraves the score through the canvas renderer, so
                    // it no longer depends on scraping the on-screen SVG (which lost
                    // the music font and could export an unrelated icon).
                    void exportScoreToPdf(score, safeFilename(score.title, fallbackName, 'pdf'))
                      .then(() => onNotify('PDF score downloaded.', 'success'))
                      .catch((error: unknown) =>
                        onNotify(error instanceof Error ? error.message : 'PDF export failed.', 'error')
                      )
                      .finally(() => {
                        setBusyExport(null);
                        setIsExportOpen(false);
                      });
                  }}
                  className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-text-primary hover:bg-app-bg text-left transition-colors disabled:opacity-50"
                >
                  <Printer size={15} className="text-text-secondary shrink-0" />
                  <span>
                    <span className="block font-medium">{busyExport === 'pdf' ? 'Generating PDF…' : 'PDF score (.pdf)'}</span>
                    <span className="text-[11px] text-text-muted">Single-page printable manuscript</span>
                  </span>
                </button>

                <div className="w-full h-px bg-border my-1" aria-hidden="true" />
                <button
                  type="button"
                  role="menuitem"
                  onClick={() =>
                    withExportFeedback('Project backup', () =>
                      downloadBlob(exportToProjectJson(score), safeFilename(score.title, fallbackName, 'musikflo'))
                    )
                  }
                  className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-text-primary hover:bg-app-bg text-left transition-colors"
                >
                  <Download size={15} className="text-text-muted shrink-0" />
                  <span>
                    <span className="block font-medium">Backup project (.musikflo)</span>
                    <span className="text-[11px] text-text-muted">Re-open later, on any device</span>
                  </span>
                </button>
              </div>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={onToggleTheme}
          className="p-1.5 rounded-lg text-text-secondary hover:text-text-primary hover:bg-app-bg transition-colors"
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        >
          {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
        </button>

        <button
          type="button"
          onClick={onOpenHelp}
          className="p-1.5 rounded-lg text-text-secondary hover:text-text-primary hover:bg-app-bg transition-colors"
          title="Notation glossary and keyboard guide"
          aria-label="Help and glossary"
        >
          <HelpCircle size={17} />
        </button>
      </div>
    </header>
  );
};
