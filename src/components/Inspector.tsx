import React from 'react';
import {
  Accidental,
  NoteDuration,
  Score,
  ScoreNote,
  TICKS_PER_QUARTER,
  getEventTicks,
  getScientificPitch,
} from '../types/music';
import { shiftDiatonic } from '../utils/notationUtils';
import { audioEngine } from '../audio/audioEngine';
import { ArrowDown, ArrowUp, Info, Music2, Trash2 } from 'lucide-react';

interface InspectorProps {
  score: Score;
  selectedNoteId: string | null;
  onUpdateNote: (noteId: string, updates: Partial<ScoreNote>) => void;
  onDeleteNote: (noteId: string) => void;
  onClose: () => void;
  /** Rendered inside the mobile drawer, which supplies its own container. */
  variant?: 'sidebar' | 'panel';
}

const DURATION_LABELS: Record<NoteDuration, { glyph: string; name: string }> = {
  '1': { glyph: '𝅝', name: 'Whole' },
  '2': { glyph: '𝅗𝅥', name: 'Half' },
  '4': { glyph: '𝅘𝅥', name: 'Quarter' },
  '8': { glyph: '𝅘𝅥𝅯', name: 'Eighth' },
  '16': { glyph: '𝅘𝅥𝅰', name: '16th' },
};

export const Inspector: React.FC<InspectorProps> = ({
  score,
  selectedNoteId,
  onUpdateNote,
  onDeleteNote,
  onClose,
  variant = 'sidebar',
}) => {
  let selectedNote: ScoreNote | null = null;
  let measureIndex = -1;
  let beatInMeasure = 1;

  if (selectedNoteId) {
    for (let mIdx = 0; mIdx < score.measures.length; mIdx++) {
      const measure = score.measures[mIdx];
      let accumTicks = 0;

      for (const event of measure.events) {
        if (event.id === selectedNoteId) {
          selectedNote = event;
          measureIndex = mIdx;
          // Beat position in the notated meter, not always in quarter notes:
          // in 6/8 the beat is an eighth note.
          const beatUnitTicks = (TICKS_PER_QUARTER * 4) / score.timeSignature.denominator;
          beatInMeasure = accumTicks / beatUnitTicks + 1;
          break;
        }
        accumTicks += getEventTicks(event);
      }
      if (selectedNote) break;
    }
  }

  const containerClass =
    variant === 'sidebar'
      ? 'flex flex-col p-4 border-l border-border bg-surface w-full md:w-64 shrink-0 select-none text-xs text-text-secondary'
      : 'flex flex-col p-4 bg-surface w-full select-none text-xs text-text-secondary';

  if (!selectedNote) {
    return (
      <div className={`${containerClass} overflow-y-auto`}>
        <div className="flex items-center gap-1.5 font-semibold text-text-primary mb-3">
          <Info size={14} className="text-primary" />
          <span>Inspector</span>
        </div>
        <p className="leading-relaxed mb-3">
          Nothing is selected. Use the <strong className="text-text-primary">Select</strong> tool, or click a note with the note
          or rest tool, to inspect and edit its pitch, duration and accidental.
        </p>
        <div className="p-2.5 rounded-lg bg-app-bg border border-border flex flex-col gap-2">
          <span className="font-semibold text-text-primary">Keyboard</span>
          <div className="flex justify-between">
            <span className="text-text-muted">Change pitch</span>
            <span className="font-mono text-text-primary">↑ / ↓</span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-muted">Delete selection</span>
            <span className="font-mono text-text-primary">Del / Backspace</span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-muted">Play / stop</span>
            <span className="font-mono text-text-primary">Space</span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-muted">Deselect</span>
            <span className="font-mono text-text-primary">Esc</span>
          </div>
        </div>
      </div>
    );
  }

  const isRest = !!selectedNote.isRest;

  const handlePitchStep = (delta: number) => {
    if (!selectedNote || selectedNote.isRest) return;
    const { step, octave } = shiftDiatonic(selectedNote.step, selectedNote.octave, delta);
    onUpdateNote(selectedNote.id, { step, octave });
    audioEngine.previewNote({ ...selectedNote, step, octave }, score.instrument);
  };

  return (
    <div className={`${containerClass} gap-4 overflow-y-auto`}>
      <div className="flex items-center justify-between pb-2 border-b border-border">
        <span className="text-xs font-bold text-text-primary uppercase tracking-wider flex items-center gap-1.5">
          <Music2 size={14} className="text-brass" />
          Inspector
        </span>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => onDeleteNote(selectedNote!.id)}
            className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-md text-danger bg-danger-bg hover:bg-danger hover:text-white transition-colors border border-danger/30"
            title={isRest ? 'Delete this rest (Del or Backspace)' : 'Delete this note (Del or Backspace)'}
          >
            <Trash2 size={12} />
            <span>{isRest ? 'Delete rest' : 'Delete note'}</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="text-xs text-text-muted hover:text-text-primary px-1.5 py-0.5 rounded"
          >
            Done
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between text-xs text-text-muted">
        <span>Position</span>
        <span className="font-mono font-medium text-text-primary">
          Bar {measureIndex + 1} · Beat {beatInMeasure.toFixed(1)}
        </span>
      </div>

      {/* Pitch */}
      <div>
        <label className="text-[11px] font-semibold text-text-muted uppercase tracking-wider block mb-1">
          Pitch &amp; octave
        </label>
        <div className="flex items-center justify-between p-2 rounded-lg bg-app-bg border border-border">
          <span className="font-mono text-base font-bold text-primary">{getScientificPitch(selectedNote)}</span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => handlePitchStep(-1)}
              disabled={isRest}
              className="p-1 rounded hover:bg-surface text-text-primary border border-border disabled:opacity-40"
              title="Step pitch down"
              aria-label="Step pitch down"
            >
              <ArrowDown size={14} />
            </button>
            <button
              type="button"
              onClick={() => handlePitchStep(1)}
              disabled={isRest}
              className="p-1 rounded hover:bg-surface text-text-primary border border-border disabled:opacity-40"
              title="Step pitch up"
              aria-label="Step pitch up"
            >
              <ArrowUp size={14} />
            </button>
          </div>
        </div>
        {isRest && (
          <p className="mt-1.5 text-[11px] text-text-muted">A rest has no pitch and is displayed at the standard rest position.</p>
        )}
      </div>

      {/* Duration */}
      <div>
        <label className="text-[11px] font-semibold text-text-muted uppercase tracking-wider block mb-1">Duration</label>
        <div className="grid grid-cols-5 gap-1 p-1 bg-app-bg border border-border rounded-lg text-center">
          {(Object.keys(DURATION_LABELS) as NoteDuration[]).map((duration) => (
            <button
              key={duration}
              type="button"
              onClick={() => onUpdateNote(selectedNote!.id, { duration })}
              title={DURATION_LABELS[duration].name}
              aria-pressed={selectedNote!.duration === duration}
              className={`py-1 text-xs font-mono font-semibold rounded ${
                selectedNote!.duration === duration ? 'bg-surface text-primary shadow-xs' : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              {DURATION_LABELS[duration].glyph}
            </button>
          ))}
        </div>
      </div>

      {/* Accidental */}
      <div>
        <label className="text-[11px] font-semibold text-text-muted uppercase tracking-wider block mb-1">Accidental</label>
        <div className="grid grid-cols-4 gap-1 p-1 bg-app-bg border border-border rounded-lg text-center">
          {(
            [
              { value: undefined, label: 'None', title: 'No accidental' },
              { value: '#' as Accidental, label: '♯', title: 'Sharp' },
              { value: 'b' as Accidental, label: '♭', title: 'Flat' },
              { value: 'n' as Accidental, label: '♮', title: 'Explicit natural' },
            ] as const
          ).map((option) => (
            <button
              key={option.label}
              type="button"
              disabled={isRest}
              onClick={() => onUpdateNote(selectedNote!.id, { accidental: option.value })}
              title={option.title}
              aria-pressed={selectedNote!.accidental === option.value}
              className={`py-1 text-xs font-medium rounded disabled:opacity-40 ${
                selectedNote!.accidental === option.value
                  ? 'bg-surface text-primary shadow-xs font-bold'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* Dotted */}
      <div className="flex items-center justify-between p-2 rounded-lg bg-app-bg border border-border">
        <span className="text-xs font-medium text-text-primary">Dotted (·)</span>
        <button
          type="button"
          onClick={() => onUpdateNote(selectedNote!.id, { dotted: !selectedNote!.dotted })}
          aria-pressed={!!selectedNote!.dotted}
          className={`px-2.5 py-1 text-xs font-mono font-medium rounded transition-all ${
            selectedNote!.dotted ? 'bg-primary text-white' : 'bg-surface text-text-secondary border border-border'
          }`}
        >
          {selectedNote!.dotted ? 'ON' : 'OFF'}
        </button>
      </div>
    </div>
  );
};
