import React, { useEffect, useRef } from 'react';
import { X, BookOpen, Keyboard, ShieldCheck, Music, MousePointer2, GraduationCap } from 'lucide-react';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartTutorial?: () => void;
}

const SHORTCUTS: Array<[string, string]> = [
  ['Play / stop', 'Space'],
  ['Delete selected note or rest', 'Del / Backspace'],
  ['Step pitch up / down', '↑ / ↓'],
  ['Deselect', 'Esc'],
  ['Undo', 'Ctrl+Z / ⌘Z'],
  ['Redo', 'Ctrl+Shift+Z / ⌘⇧Z'],
  ['Duplicate bar to next', 'Ctrl+D / ⌘D'],
  ['Copy selected bar', 'Ctrl+C / ⌘C'],
  ['Paste copied bar', 'Ctrl+V / ⌘V'],
];

const TOOLS: Array<[string, string]> = [
  ['Select', 'Click a note or rest to edit it. Clicking empty staff does nothing.'],
  ['Note', 'Click empty staff to place a note. Clicking an existing event selects it.'],
  ['Rest', 'Click empty staff to place a rest. Clicking an existing event selects it.'],
  ['Erase', 'Click a note or rest to delete it. Clicking empty staff does nothing.'],
];

export const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose, onStartTutorial }) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  // Move focus into the dialog on open and restore it on close, and close on Escape.
  useEffect(() => {
    if (!isOpen) return;

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
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="relative w-full max-w-2xl max-h-[85vh] flex flex-col rounded-2xl bg-surface-raised border border-border shadow-2xl overflow-hidden focus:outline-none"
        role="dialog"
        aria-modal="true"
        aria-labelledby="help-modal-title"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-surface">
          <div className="flex items-center gap-2 text-text-primary">
            <BookOpen size={18} className="text-primary" aria-hidden="true" />
            <h2 id="help-modal-title" className="text-base font-bold">
              MusikFlo notation &amp; studio guide
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-text-muted hover:text-text-primary hover:bg-app-bg transition-colors"
            aria-label="Close dialog"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-sm text-text-secondary leading-relaxed">
          <section>
            <h3 className="text-xs font-bold uppercase tracking-wider text-text-primary mb-2 flex items-center gap-1.5">
              <MousePointer2 size={14} className="text-primary" aria-hidden="true" />
              1. Tools
            </h3>
            <div className="grid grid-cols-1 gap-2 text-xs">
              {TOOLS.map(([name, description]) => (
                <div key={name} className="flex gap-3 p-2.5 rounded-lg bg-app-bg border border-border">
                  <strong className="text-text-primary w-16 shrink-0">{name}</strong>
                  <span className="text-text-muted">{description}</span>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h3 className="text-xs font-bold uppercase tracking-wider text-text-primary mb-2 flex items-center gap-1.5">
              <Music size={14} className="text-primary" aria-hidden="true" />
              2. The staff &amp; pitch
            </h3>
            <p className="mb-2">
              Music is written on a staff of five lines and four spaces. Vertical position is pitch; the preview always shows the
              note name before you place it.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3 rounded-xl bg-app-bg border border-border text-xs">
              <div>
                <strong className="text-text-primary block mb-1">Treble clef</strong>
                <ul className="list-disc list-inside space-y-0.5 text-text-muted">
                  <li>
                    Lines (bottom to top): <span className="font-mono text-text-primary">E4, G4, B4, D5, F5</span>
                  </li>
                  <li>
                    Spaces: <span className="font-mono text-text-primary">F4, A4, C5, E5</span>
                  </li>
                  <li>
                    Middle C (<span className="font-mono text-text-primary">C4</span>): first ledger line below the staff
                  </li>
                </ul>
              </div>
              <div>
                <strong className="text-text-primary block mb-1">Bass clef</strong>
                <ul className="list-disc list-inside space-y-0.5 text-text-muted">
                  <li>
                    Lines (bottom to top): <span className="font-mono text-text-primary">G2, B2, D3, F3, A3</span>
                  </li>
                  <li>
                    Spaces: <span className="font-mono text-text-primary">A2, C3, E3, G3</span>
                  </li>
                  <li>
                    Middle C (<span className="font-mono text-text-primary">C4</span>): first ledger line above the staff
                  </li>
                </ul>
              </div>
            </div>
          </section>

          <section>
            <h3 className="text-xs font-bold uppercase tracking-wider text-text-primary mb-2">3. Notes, rests &amp; meter</h3>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center text-xs">
              {[
                ['𝅝', 'Whole', '4 beats'],
                ['𝅗𝅥', 'Half', '2 beats'],
                ['𝅘𝅥', 'Quarter', '1 beat'],
                ['𝅘𝅥𝅯', 'Eighth', '½ beat'],
                ['𝅘𝅥𝅰', '16th', '¼ beat'],
              ].map(([glyph, name, beats]) => (
                <div key={name} className="p-2 rounded-lg bg-app-bg border border-border">
                  <span className="text-2xl block mb-1 font-serif" aria-hidden="true">
                    {glyph}
                  </span>
                  <strong className="text-text-primary block">{name}</strong>
                  <span className="text-text-muted text-[11px]">{beats}</span>
                </div>
              ))}
            </div>
            <p className="mt-2 text-xs text-text-muted">
              The meter check above the score reports each bar as complete, incomplete or overfull. Time signatures govern notation
              and validation; an empty bar does not add silence during playback.
            </p>
          </section>

          <section>
            <h3 className="text-xs font-bold uppercase tracking-wider text-text-primary mb-2 flex items-center gap-1.5">
              <Keyboard size={14} className="text-primary" aria-hidden="true" />
              4. Keyboard shortcuts
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              {SHORTCUTS.map(([label, keys]) => (
                <div key={label} className="flex justify-between gap-3 p-2 rounded bg-app-bg border border-border">
                  <span>{label}</span>
                  <kbd className="px-1.5 py-0.5 rounded bg-surface border border-border font-mono text-[11px] shrink-0">
                    {keys}
                  </kbd>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h3 className="text-xs font-bold uppercase tracking-wider text-text-primary mb-2 flex items-center gap-1.5">
              <ShieldCheck size={14} className="text-success" aria-hidden="true" />
              5. Where your work is stored
            </h3>
            <div className="p-3 rounded-xl bg-app-bg border border-border text-xs text-text-muted">
              <p>
                MusikFlo saves your score in this browser using IndexedDB, falling back to localStorage when IndexedDB is
                unavailable. There is no account and your music is never uploaded to a MusikFlo server.
              </p>
              <p className="mt-2">
                The page does download its fonts from Google Fonts, so the browser makes ordinary font requests. Locally stored
                scores are not encrypted and are lost if you clear site data.
              </p>
              <p className="mt-2 text-text-primary font-medium">
                Export → Backup project (.musikflo) before clearing browser data or switching device.
              </p>
            </div>
          </section>

          <section>
            <h3 className="text-xs font-bold uppercase tracking-wider text-text-primary mb-2 flex items-center gap-1.5">
              <Music size={14} className="text-primary" aria-hidden="true" />
              6. Turning audio into notation
            </h3>
            <p className="text-xs">
              <strong className="text-text-primary">Transcribe audio</strong> in the top bar converts a short MP3 or WAV clip
              into a new score. The recording is analysed on this device and is never uploaded; the transcription runtime is
              downloaded the first time you use it.
            </p>
            <p className="mt-2 text-xs text-text-muted">
              It works best on a clear, melody-focused clip of one instrument. The result is an estimate — you can change the
              tempo, meter, rhythm grid and clef during review before opening it. Your current score is always preserved, and
              stays available from the Recent menu.
            </p>
          </section>
        </div>

        <div className="px-6 py-3 border-t border-border bg-surface flex items-center justify-between">
          {onStartTutorial ? (
            <button
              type="button"
              onClick={() => {
                onClose();
                onStartTutorial();
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-primary-soft text-primary hover:bg-primary hover:text-white transition-colors"
            >
              <GraduationCap size={15} />
              Take Quick Studio Tour
            </button>
          ) : (
            <span />
          )}
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium rounded-lg bg-primary text-white hover:bg-primary-hover transition-colors"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
};
