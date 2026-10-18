import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Music,
  MousePointerClick,
  Plus,
  Play,
  Download,
  ChevronRight,
  ChevronLeft,
  X,
  Sparkles,
  GraduationCap,
} from 'lucide-react';

const STORAGE_KEY = 'musikflo_tutorial_completed';

interface WelcomeTutorialProps {
  isOpen: boolean;
  onClose: () => void;
}

interface TutorialStep {
  icon: React.ReactNode;
  title: string;
  description: string;
  tip: string;
  visual: React.ReactNode;
}

const STEPS: TutorialStep[] = [
  {
    icon: <Sparkles size={24} className="text-brass" />,
    title: 'Welcome to MusikFlo Studio!',
    description:
      'MusikFlo is a visual sheet music composer that runs right in your browser. No installs, no sign-ups \u2014 just compose, hear, and export.',
    tip: "Let's walk you through the basics in under a minute.",
    visual: (
      <div className="flex items-center justify-center gap-3 py-4">
        <span className="text-5xl font-serif leading-none">{'\u{1D11E}'}</span>
        <div className="flex gap-1.5">
          {['\u{1D160}', '\u{1D160}', '\u{1D15E}', '\u{1D160}', '\u{1D15D}'].map((g, i) => (
            <span
              key={i}
              className="text-3xl font-serif text-primary animate-pulse"
              style={{ animationDelay: `${i * 0.15}s` }}
            >
              {g}
            </span>
          ))}
        </div>
      </div>
    ),
  },
  {
    icon: <Music size={24} className="text-primary" />,
    title: 'Pick a Tool',
    description:
      "The toolbar has four tools: Note, Rest, Select, and Eraser. Start with the Note tool \u2014 it is selected by default.",
    tip: 'You can always switch back to Note by clicking the Note button in the toolbar.',
    visual: (
      <div className="flex flex-wrap items-center justify-center gap-2 py-3">
        {[
          { label: 'Note', emoji: '\u{1F3B5}', active: true },
          { label: 'Rest', emoji: '\u{1D13D}', active: false },
          { label: 'Select', emoji: '\u{1F446}', active: false },
          { label: 'Eraser', emoji: '\u{1F9F9}', active: false },
        ].map((t) => (
          <div
            key={t.label}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-semibold transition-all ${
              t.active
                ? 'bg-primary text-white border-primary shadow-md scale-110'
                : 'bg-app-bg text-text-muted border-border'
            }`}
          >
            <span>{t.emoji}</span>
            <span>{t.label}</span>
          </div>
        ))}
      </div>
    ),
  },
  {
    icon: <MousePointerClick size={24} className="text-primary" />,
    title: 'Choose a Duration',
    description:
      "Before placing a note, pick its length: Whole, Half, Quarter, 8th, or 16th. Quarter notes are pre-selected.",
    tip: "You can also toggle the Dot button for dotted rhythms, or add sharps and flats.",
    visual: (
      <div className="flex items-center justify-center gap-2 py-3">
        {[
          { glyph: '\u{1D15D}', label: 'Whole', active: false },
          { glyph: '\u{1D15E}', label: 'Half', active: false },
          { glyph: '\u{1D160}', label: 'Qtr', active: true },
          { glyph: '\u{1D161}', label: '8th', active: false },
          { glyph: '\u{1D162}', label: '16th', active: false },
        ].map((d) => (
          <div
            key={d.label}
            className={`flex flex-col items-center px-2.5 py-2 rounded-lg border text-xs transition-all ${
              d.active
                ? 'bg-primary text-white border-primary shadow-md scale-110'
                : 'bg-app-bg text-text-muted border-border'
            }`}
          >
            <span className="text-xl font-serif leading-none mb-1">{d.glyph}</span>
            <span className="text-[10px]">{d.label}</span>
          </div>
        ))}
      </div>
    ),
  },
  {
    icon: <MousePointerClick size={24} className="text-success" />,
    title: 'Place Notes on the Staff',
    description:
      "Click or tap anywhere on the five staff lines (or the spaces between them) to place a note. Higher position = higher pitch.",
    tip: "A ghost preview shows the note name (e.g. C5, A4) before you click. Ledger lines appear automatically for notes above or below the staff.",
    visual: (
      <div className="relative py-4 px-6">
        <div className="flex flex-col gap-[6px]">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="h-[1.5px] bg-staff-line rounded-full" />
          ))}
        </div>
        <div
          className="absolute left-1/2 -translate-x-1/2"
          style={{ top: '18px' }}
        >
          <div className="relative">
            <div className="w-4 h-3 bg-primary rounded-full rotate-[-15deg]" />
            <div className="absolute left-3.5 -top-5 w-[2px] h-6 bg-primary" />
          </div>
        </div>
        <div
          className="absolute right-[30%] animate-bounce"
          style={{ top: '8px' }}
        >
          <MousePointerClick size={18} className="text-brass" />
        </div>
        <p className="text-center text-[10px] text-text-muted mt-3">
          Click on any line or space to place your note
        </p>
      </div>
    ),
  },
  {
    icon: <Plus size={24} className="text-primary" />,
    title: 'Add & Manage Bars',
    description:
      "Use \"+\u00A0Add Bar\" to create new measures, \"\u2014\u00A0Remove Bar\" to delete the last one, or \"Duplicate\" to copy a bar. Each bar must fill up to the time signature to pass the meter check.",
    tip: "Keyboard shortcut: Ctrl+D (or \u2318D on Mac) duplicates the selected bar instantly.",
    visual: (
      <div className="flex flex-wrap items-center justify-center gap-2 py-3">
        {[
          { label: '\u2014 Remove Bar', style: 'border-danger/40 text-danger' },
          { label: '+ Add Bar', style: 'border-primary/40 text-primary font-bold' },
          { label: 'Duplicate Bar', style: 'border-border text-text-secondary' },
        ].map((btn) => (
          <div
            key={btn.label}
            className={`px-3 py-1.5 rounded-md border text-xs ${btn.style} bg-app-bg`}
          >
            {btn.label}
          </div>
        ))}
      </div>
    ),
  },
  {
    icon: <Play size={24} className="text-success" />,
    title: 'Play Your Music',
    description:
      "Press the Play button in the transport bar at the bottom, or just hit Spacebar. MusikFlo synthesises every note in real time with your chosen instrument sound.",
    tip: "Change instrument from the Sound dropdown at the top \u2014 try Piano, Guitar, Strings, Flute, Bansuri, or Clarinet.",
    visual: (
      <div className="flex items-center justify-center gap-4 py-3">
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-white text-sm font-bold shadow-lg">
          <Play size={16} fill="currentColor" />
          <span>Play</span>
        </div>
        <span className="text-text-muted text-xs">or press</span>
        <kbd className="px-2.5 py-1 rounded-md bg-surface border border-border font-mono text-xs text-text-primary shadow-sm">
          Space
        </kbd>
      </div>
    ),
  },
  {
    icon: <Download size={24} className="text-primary" />,
    title: 'Export & Share',
    description:
      "When you are happy with your piece, tap the green Export button in the top bar. You can export as PDF sheet music, MIDI, MP3, or WAV audio.",
    tip: "Use \"Backup project (.musikflo)\" to save your entire score and re-import it later on any device.",
    visual: (
      <div className="flex flex-wrap items-center justify-center gap-2 py-3">
        {['PDF', 'MIDI', 'MP3', 'WAV', 'Backup'].map((fmt) => (
          <div
            key={fmt}
            className="px-3 py-1.5 rounded-md bg-app-bg border border-border text-xs text-text-secondary"
          >
            {fmt}
          </div>
        ))}
      </div>
    ),
  },
];

export const WelcomeTutorial: React.FC<WelcomeTutorialProps> = ({ isOpen, onClose }) => {
  const [step, setStep] = useState(0);
  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  const totalSteps = STEPS.length;
  const current = STEPS[step];
  const isLast = step === totalSteps - 1;

  const handleClose = useCallback(() => {
    try {
      localStorage.setItem(STORAGE_KEY, 'true');
    } catch {
      // Storage unavailable
    }
    setStep(0);
    onClose();
  }, [onClose]);

  const handleNext = useCallback(() => {
    if (isLast) {
      handleClose();
    } else {
      setStep((s) => s + 1);
    }
  }, [isLast, handleClose]);

  const handlePrev = useCallback(() => {
    setStep((s) => Math.max(0, s - 1));
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') handleClose();
      if (event.key === 'ArrowRight') handleNext();
      if (event.key === 'ArrowLeft') handlePrev();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      previouslyFocused.current?.focus?.();
    };
  }, [isOpen, handleClose, handleNext, handlePrev]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="relative w-full max-w-md flex flex-col rounded-2xl bg-surface-raised border border-border shadow-2xl overflow-hidden focus:outline-none"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tutorial-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-surface">
          <div className="flex items-center gap-2 text-text-primary">
            <GraduationCap size={16} className="text-primary" aria-hidden="true" />
            <span className="text-xs font-bold uppercase tracking-wider text-text-muted">
              Quick Tour &bull; {step + 1} / {totalSteps}
            </span>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="p-1 rounded-md text-text-muted hover:text-text-primary hover:bg-app-bg transition-colors"
            aria-label="Skip tutorial"
            title="Skip tutorial"
          >
            <X size={16} />
          </button>
        </div>

        {/* Progress bar */}
        <div className="h-1 bg-border">
          <div
            className="h-full bg-primary rounded-r-full transition-all duration-300 ease-out"
            style={{ width: `${((step + 1) / totalSteps) * 100}%` }}
          />
        </div>

        {/* Content */}
        <div className="flex flex-col px-6 py-5 min-h-[280px]">
          <div className="flex items-center gap-3 mb-3">
            {current.icon}
            <h2 id="tutorial-title" className="text-lg font-bold text-text-primary leading-tight">
              {current.title}
            </h2>
          </div>

          <p className="text-sm text-text-secondary leading-relaxed mb-3">
            {current.description}
          </p>

          {/* Visual demonstration */}
          <div className="rounded-xl bg-app-bg border border-border overflow-hidden mb-3">
            {current.visual}
          </div>

          {/* Tip */}
          <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-primary-soft text-primary text-xs">
            <Sparkles size={12} className="shrink-0 mt-0.5" aria-hidden="true" />
            <span>{current.tip}</span>
          </div>
        </div>

        {/* Footer nav */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-border bg-surface">
          <button
            type="button"
            onClick={handleClose}
            className="text-xs text-text-muted hover:text-text-primary transition-colors"
          >
            Skip tour
          </button>

          <div className="flex items-center gap-2">
            {step > 0 && (
              <button
                type="button"
                onClick={handlePrev}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg border border-border text-text-secondary hover:bg-app-bg transition-colors"
              >
                <ChevronLeft size={14} />
                Back
              </button>
            )}
            <button
              type="button"
              onClick={handleNext}
              className="flex items-center gap-1 px-4 py-1.5 text-xs font-semibold rounded-lg bg-primary text-white hover:bg-primary-hover transition-colors shadow-sm"
            >
              {isLast ? (
                <>
                  Start Composing
                  <Sparkles size={14} />
                </>
              ) : (
                <>
                  Next
                  <ChevronRight size={14} />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

/** Returns true if the user has never completed the tutorial. */
export function shouldShowTutorial(): boolean {
  try {
    return !localStorage.getItem(STORAGE_KEY);
  } catch {
    return false;
  }
}
