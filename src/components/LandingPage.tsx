import React, { useEffect, useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Score, NoteDuration } from '../types/music';
import { audioEngine } from '../audio/audioEngine';
import { INSTRUMENT_IDS, VOICES } from '../audio/instruments';
import { BrandMark } from './BrandMark';
import { Footer } from './Footer';
import { ArrowRight, Download, FileAudio, FileCode, Music, Play, Printer, Square, Sun, Moon, ShieldCheck, Sparkles } from 'lucide-react';

interface LandingPageProps {
  onStartComposing: () => void;
  onTrySample: () => void;
  /** Opens the audio-to-sheet-music workflow. */
  onTranscribeAudio: () => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
}

interface DemoNote {
  step: 'e' | 'f' | 'g' | 'd' | 'c';
  octave: number;
  duration: NoteDuration;
  /** Score-space position of the notehead in the demonstration SVG. */
  x: number;
  y: number;
}

/**
 * The demonstration is a real two-bar 4/4 motif. Notation, the score sent to
 * the audio engine and the highlighted note all come from this single array, so
 * the picture cannot drift from what is heard.
 */
const DEMO_NOTES: DemoNote[] = [
  { step: 'e', octave: 4, duration: '4', x: 130, y: 100 },
  { step: 'f', octave: 4, duration: '4', x: 172, y: 95 },
  { step: 'g', octave: 4, duration: '4', x: 214, y: 90 },
  { step: 'e', octave: 4, duration: '4', x: 256, y: 100 },
  { step: 'd', octave: 4, duration: '4', x: 320, y: 105 },
  { step: 'c', octave: 4, duration: '4', x: 362, y: 110 },
  { step: 'e', octave: 4, duration: '2', x: 424, y: 100 },
];

const DEMO_SCORE: Score = {
  id: 'hero-demo',
  title: 'Hero Demo',
  composer: 'MusikFlo',
  clef: 'treble',
  timeSignature: { numerator: 4, denominator: 4 },
  keySignature: 'C',
  tempo: 108,
  instrument: 'piano',
  createdAt: 0,
  updatedAt: 0,
  measures: [
    {
      id: 'dm1',
      events: DEMO_NOTES.slice(0, 4).map((note, index) => ({
        id: `dn${index}`,
        step: note.step,
        octave: note.octave,
        duration: note.duration,
      })),
    },
    {
      id: 'dm2',
      events: DEMO_NOTES.slice(4).map((note, index) => ({
        id: `dn${index + 4}`,
        step: note.step,
        octave: note.octave,
        duration: note.duration,
      })),
    },
  ],
};

const FEATURES = [
  {
    icon: Music,
    title: 'Compose visually',
    body: 'Place notes on a real staff and change pitch, duration and rhythm without writing music code.',
  },
  {
    icon: Play,
    title: 'Hear every note',
    body: 'Play your melody with synthesised instruments and follow the highlighted note as the score sounds.',
  },
  {
    icon: Download,
    title: 'Take your music with you',
    body: 'Download an editable project backup, or export MIDI, MusicXML, WAV and PDF copies of your score.',
  },
  {
    icon: FileAudio,
    title: 'Audio to sheet music',
    body: 'Convert MP3 or WAV clips up to 3 minutes into editable notation using on-device neural transcription.',
  },
  {
    icon: Sparkles,
    title: 'Grand Staff & dual-clef writing',
    body: 'Write piano parts on linked Treble + Bass staves with a real VexFlow brace. Solo or mute either hand during playback.',
  },
  {
    icon: ShieldCheck,
    title: 'Meter check & theory guard-rails',
    body: 'Live beat-count feedback per bar, overfill warnings, and key-aware accidentals catch mistakes before they reach your ears.',
  },
];

const STEPS = [
  {
    number: '01',
    title: 'Choose a tool and value',
    body: 'Select, note, rest or eraser. Pick whole, half, quarter, eighth or sixteenth values, then add sharps, flats or a dot.',
  },
  {
    number: '02',
    title: 'Place it on the staff',
    body: 'Hover to preview the pitch and ledger line. Click or tap to place it. Bar totals are checked against the meter as you go.',
  },
  {
    number: '03',
    title: 'Play, refine and export',
    body: 'Play the score, step pitches with the arrow keys, then export the formats you need.',
  },
];

const INSTRUMENTS = INSTRUMENT_IDS.map((id) => ({ name: VOICES[id].label, detail: VOICES[id].blurb }));

const EXPORTS = [
  {
    icon: Music,
    name: 'Standard MIDI (.mid)',
    detail: 'Pitch, tempo and durations as a standard MIDI file.',
  },
  {
    icon: FileCode,
    name: 'MusicXML 3.1 (.musicxml)',
    detail: 'Notation interchange, including your clef, meter and key signature.',
  },
  {
    icon: FileAudio,
    name: 'Audio (.wav)',
    detail: '16-bit 44.1 kHz PCM, rendered offline from the score timeline.',
  },
  {
    icon: Printer,
    name: 'PDF score and project backup',
    detail: 'A single-page printable manuscript, plus a .musikflo file you can re-open later.',
  },
];

const HERO_GROUP = { hidden: {}, show: { transition: { staggerChildren: 0.06, delayChildren: 0.04 } } };
const HERO_ITEM = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.32, ease: [0.22, 1, 0.36, 1] as const } },
};

export const LandingPage: React.FC<LandingPageProps> = ({
  onStartComposing,
  onTrySample,
  onTranscribeAudio,
  theme,
  onToggleTheme,
}) => {
  const [isDemoPlaying, setIsDemoPlaying] = useState(false);
  const [demoNoteIndex, setDemoNoteIndex] = useState<number | null>(null);
  const prefersReducedMotion = useReducedMotion();

  // The demonstration highlight is driven by the same real audio timeline the
  // studio uses, and the subscription is released on unmount.
  useEffect(() => {
    const unsubscribe = audioEngine.subscribePlaybackTick((tick) => {
      setIsDemoPlaying(tick.isPlaying);
      setDemoNoteIndex(tick.isPlaying && tick.globalEventIndex >= 0 ? tick.globalEventIndex : null);
    });
    return () => {
      unsubscribe();
      audioEngine.stop();
    };
  }, []);

  const handleToggleDemo = () => {
    if (audioEngine.getIsPlaying()) {
      audioEngine.stop();
      return;
    }
    void audioEngine.playScore(DEMO_SCORE);
  };

  const reveal = useMemo(() => {
    if (prefersReducedMotion) {
      return {
        initial: { opacity: 0 } as const,
        whileInView: { opacity: 1 } as const,
        transition: { duration: 0.2 },
      };
    }
    return {
      initial: { opacity: 0, y: 14 } as const,
      whileInView: { opacity: 1, y: 0 } as const,
      transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] as const },
    };
  }, [prefersReducedMotion]);

  const pressable = prefersReducedMotion ? {} : { whileHover: { y: -1 }, whileTap: { scale: 0.985 } };
  const viewport = { once: true, amount: 0.25 } as const;

  // One derived value drives both the play control and its label, so the button
  // can never claim "pause" while the engine is actually stopping.
  const demoControl = isDemoPlaying
    ? { icon: <Square size={17} className="fill-current" />, label: 'Stop demonstration' }
    : { icon: <Play size={17} className="fill-current ml-0.5" />, label: 'Play the sample melody' };

  return (
    <div className="min-h-screen flex flex-col bg-app-bg text-text-primary selection:bg-primary-soft selection:text-primary">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:px-4 focus:py-2 focus:rounded-lg focus:bg-primary focus:text-white focus:text-sm"
      >
        Skip to content
      </a>

      <header className="sticky top-0 z-30 border-b border-border bg-app-bg/90 backdrop-blur-md">
        <div className="flex items-center justify-between gap-4 px-6 md:px-12 py-4">
          <div className="flex items-center gap-2.5 shrink-0">
            <span className="w-8 h-8 rounded-lg bg-primary-soft flex items-center justify-center text-primary">
              <BrandMark size={20} />
            </span>
            <span className="font-serif text-2xl font-bold tracking-tight text-text-primary">MusikFlo</span>
          </div>

          <nav aria-label="Sections" className="hidden sm:flex items-center gap-6 text-sm font-medium text-text-secondary">
            <a href="#how-it-works" className="hover:text-text-primary transition-colors whitespace-nowrap">
              How it works
            </a>
            <a href="#features" className="hover:text-text-primary transition-colors whitespace-nowrap">
              Features
            </a>
            <a href="#instruments" className="hover:text-text-primary transition-colors whitespace-nowrap">
              Instruments
            </a>
            <a href="#exports" className="hover:text-text-primary transition-colors whitespace-nowrap">
              Exports
            </a>
          </nav>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={onToggleTheme}
              className="p-2 rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface transition-colors"
              title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
              aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            >
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <motion.button
              type="button"
              onClick={onStartComposing}
              className="px-4 py-2 text-xs font-semibold rounded-lg bg-primary text-white hover:bg-primary-hover shadow-xs transition-colors whitespace-nowrap"
              {...pressable}
            >
              Open Studio
            </motion.button>
          </div>
        </div>

        {/* Narrow screens get the same section links in their own scrollable row
            rather than losing site navigation entirely. */}
        <nav
          aria-label="Page sections"
          className="sm:hidden flex items-center gap-5 px-6 py-2 border-t border-border overflow-x-auto text-sm font-medium text-text-secondary"
        >
          <a href="#how-it-works" className="whitespace-nowrap">
            How it works
          </a>
          <a href="#features" className="whitespace-nowrap">
            Features
          </a>
          <a href="#instruments" className="whitespace-nowrap">
            Instruments
          </a>
          <a href="#exports" className="whitespace-nowrap">
            Exports
          </a>
        </nav>
      </header>

      <main id="main-content" className="flex-1">
        <section className="relative px-6 md:px-12 pt-14 pb-20 max-w-7xl mx-auto w-full">
          <div className="absolute inset-0 pointer-events-none opacity-40 overflow-hidden" aria-hidden="true">
            <svg className="w-full h-full text-staff-line/30" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <pattern id="hero-staff" width="200" height="120" patternUnits="userSpaceOnUse">
                  {[20, 30, 40, 50, 60].map((y) => (
                    <line key={y} x1="0" y1={y} x2="200" y2={y} stroke="currentColor" strokeWidth="0.75" />
                  ))}
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#hero-staff)" />
            </svg>
          </div>

          <div className="relative grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
            <motion.div
              className="lg:col-span-6 flex flex-col gap-6"
              variants={HERO_GROUP}
              initial={prefersReducedMotion ? undefined : 'hidden'}
              animate={prefersReducedMotion ? undefined : 'show'}
            >
              <motion.div variants={HERO_ITEM} className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-primary-soft/80 border border-primary/30 text-xs font-semibold text-primary w-fit">
                <Sparkles size={14} className="shrink-0" aria-hidden="true" />
                <span>100% Free · No Login Required · Instant In-Browser Access</span>
              </motion.div>

              <motion.h1
                variants={HERO_ITEM}
                className="font-serif text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight text-text-primary leading-[1.08] text-balance"
              >
                Turn a note into a melody.
              </motion.h1>

              <motion.p variants={HERO_ITEM} className="text-base sm:text-lg text-text-secondary leading-relaxed max-w-xl">
                Compose directly on the staff, hear every note as you create, and take your music with you.
              </motion.p>

              <motion.div variants={HERO_ITEM} className="flex flex-wrap items-center gap-3 pt-2">
                <motion.button
                  type="button"
                  onClick={onStartComposing}
                  className="flex items-center gap-2 px-6 py-3.5 text-sm font-semibold rounded-xl bg-primary text-white hover:bg-primary-hover shadow-sm transition-colors"
                  {...pressable}
                >
                  <span>Start composing</span>
                  <ArrowRight size={16} />
                </motion.button>

                <motion.button
                  type="button"
                  onClick={onTrySample}
                  className="px-5 py-3.5 text-sm font-medium rounded-xl border border-border bg-surface hover:bg-app-bg text-text-primary transition-colors"
                  {...pressable}
                >
                  Try a sample
                </motion.button>

                {/* Secondary route to transcription: quiet, outlined, and never
                    displacing the primary "Start composing" action. */}
                <motion.button
                  type="button"
                  onClick={onTranscribeAudio}
                  className="flex items-center gap-2 px-5 py-3.5 text-sm font-medium rounded-xl border border-border bg-surface hover:bg-app-bg text-text-primary transition-colors"
                  {...pressable}
                >
                  <FileAudio size={15} aria-hidden="true" />
                  Convert audio to sheet music
                </motion.button>
              </motion.div>

              <motion.div variants={HERO_ITEM} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs sm:text-sm font-medium text-text-secondary pt-1">
                <span className="flex items-center gap-1.5 font-semibold text-primary">
                  <span className="w-2 h-2 rounded-full bg-success"></span>
                  No Login Needed
                </span>
                <span aria-hidden="true" className="text-border">·</span>
                <span>Free to use</span>
                <span aria-hidden="true" className="text-border">·</span>
                <span>Your projects stay in your browser</span>
              </motion.div>
            </motion.div>

            <motion.div
              className="lg:col-span-6"
              initial={prefersReducedMotion ? undefined : { opacity: 0, y: 14 }}
              animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="relative p-6 sm:p-8 rounded-2xl bg-paper border border-border shadow-md">
                <div className="flex items-center justify-between gap-3 pb-4 mb-4 border-b border-border/80 text-xs text-text-secondary">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-text-primary">Theme in C major</span>
                    <span aria-hidden="true" className="text-border">
                      ·
                    </span>
                    <span>108 BPM</span>
                  </div>
                  <span className="font-mono text-[11px] text-text-muted">Piano</span>
                </div>

                <div className="relative w-full overflow-hidden flex justify-center py-4 bg-paper">
                  <svg
                    viewBox="0 0 520 180"
                    className="w-full h-auto select-none"
                    style={{ maxHeight: '200px' }}
                    role="img"
                    aria-label="Eight-note demonstration melody in C major on a treble staff"
                  >
                    <title>Sample melody in C major</title>
                    {[60, 70, 80, 90, 100].map((y) => (
                      <line key={y} x1="20" y1={y} x2="500" y2={y} stroke="var(--staff-line)" strokeWidth="1.2" />
                    ))}

                    <line x1="20" y1="60" x2="20" y2="100" stroke="var(--notation-ink)" strokeWidth="1.5" />
                    <line x1="290" y1="60" x2="290" y2="100" stroke="var(--staff-line)" strokeWidth="1.2" />
                    <line x1="495" y1="60" x2="495" y2="100" stroke="var(--notation-ink)" strokeWidth="1.5" />

                    <text x="30" y="95" fontSize="46" fontFamily="serif" fill="var(--notation-ink)" aria-hidden="true">
                      𝄞
                    </text>
                    <text x="78" y="78" fontSize="20" fontWeight="bold" fontFamily="sans-serif" fill="var(--notation-ink)">
                      4
                    </text>
                    <text x="78" y="98" fontSize="20" fontWeight="bold" fontFamily="sans-serif" fill="var(--notation-ink)">
                      4
                    </text>

                    {/* Ledger line for the C4 in the second bar. */}
                    <line x1="352" y1="110" x2="372" y2="110" stroke="var(--staff-line)" strokeWidth="1.2" />

                    {DEMO_NOTES.map((note, index) => {
                      const isSounding = isDemoPlaying && demoNoteIndex === index;
                      const isHalf = note.duration === '2';

                      return (
                        <g key={`${note.step}${note.octave}-${index}`}>
                          {isSounding && (
                            <ellipse
                              cx={note.x + 5}
                              cy={note.y}
                              rx="12"
                              ry="10"
                              fill="var(--primary-soft)"
                              stroke="var(--playhead)"
                              strokeWidth="1.5"
                            />
                          )}
                          <ellipse
                            cx={note.x + 5}
                            cy={note.y}
                            rx="6"
                            ry="4.5"
                            transform={`rotate(-20 ${note.x + 5} ${note.y})`}
                            fill={isSounding ? 'var(--playhead)' : isHalf ? 'none' : 'var(--notation-ink)'}
                            stroke={isSounding ? 'var(--playhead)' : 'var(--notation-ink)'}
                            strokeWidth={isHalf ? 2 : 1}
                          />
                          <line
                            x1={note.x + 10}
                            y1={note.y}
                            x2={note.x + 10}
                            y2={note.y - 30}
                            stroke={isSounding ? 'var(--playhead)' : 'var(--notation-ink)'}
                            strokeWidth="1.5"
                          />
                          {isSounding && (
                            <text
                              x={note.x + 5}
                              y={note.y - 36}
                              textAnchor="middle"
                              fontSize="11"
                              fontWeight="bold"
                              fontFamily="monospace"
                              fill="var(--playhead)"
                            >
                              {note.step.toUpperCase()}
                              {note.octave}
                            </text>
                          )}
                        </g>
                      );
                    })}
                  </svg>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-4 mt-2 border-t border-border">
                  <div className="flex items-center gap-3">
                    <motion.button
                      type="button"
                      onClick={handleToggleDemo}
                      className="flex items-center justify-center w-10 h-10 rounded-full bg-primary hover:bg-primary-hover text-white shadow-xs transition-colors"
                      title={demoControl.label}
                      aria-label={demoControl.label}
                      aria-pressed={isDemoPlaying}
                      {...pressable}
                    >
                      {demoControl.icon}
                    </motion.button>

                    <span className="text-xs" role="status" aria-live="polite">
                      <span className="font-semibold text-text-primary block">
                        {isDemoPlaying ? 'Playing the sample melody…' : 'Hear this sample melody'}
                      </span>
                      <span className="text-[11px] text-text-muted">Synthesised in your browser with Tone.js</span>
                    </span>
                  </div>

                  <motion.button
                    type="button"
                    onClick={onTrySample}
                    className="text-xs font-semibold text-primary hover:text-primary-hover flex items-center gap-1"
                    {...pressable}
                  >
                    <span>Edit in studio</span>
                    <ArrowRight size={13} />
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Below-hero transcription feature block: one concise entry point. */}
        <section className="px-6 md:px-12 py-14 border-t border-border bg-surface">
          <motion.div
            className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-6"
            {...reveal}
            viewport={viewport}
          >
            <div className="max-w-2xl">
              <h2 className="font-serif text-2xl sm:text-3xl font-bold tracking-tight text-text-primary">
                Already have a recording?
              </h2>
              <p className="text-sm sm:text-base text-text-secondary mt-2">
                Turn a short melody into editable notation. Choose an MP3 or WAV clip and it is analysed on your own
                device — nothing is uploaded to a MusikFlo server.
              </p>
            </div>

            <motion.button
              type="button"
              onClick={onTranscribeAudio}
              className="self-start flex items-center gap-2 px-5 py-3 text-sm font-semibold rounded-xl border border-primary text-primary hover:bg-primary-soft transition-colors shrink-0"
              {...pressable}
            >
              <FileAudio size={16} aria-hidden="true" />
              Transcribe a clip
            </motion.button>
          </motion.div>
        </section>

        <section id="features" className="px-6 md:px-12 py-16 border-t border-border bg-surface">
          <motion.div className="max-w-7xl mx-auto" {...reveal} viewport={viewport}>
            <div className="mb-12">
              <h2 className="font-serif text-3xl sm:text-4xl font-bold tracking-tight text-text-primary">
                Built for intuitive music creation.
              </h2>
              <p className="text-text-secondary text-sm sm:text-base mt-2 max-w-2xl">
                Every tool follows ordinary music notation, without asking you to write code or learn a dense settings panel.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {FEATURES.map((feature) => (
                <div key={feature.title} className="flex flex-col gap-3">
                  <span className="w-10 h-10 rounded-xl bg-primary-soft text-primary flex items-center justify-center">
                    <feature.icon size={20} aria-hidden="true" />
                  </span>
                  <h3 className="text-base font-bold text-text-primary">{feature.title}</h3>
                  <p className="text-sm text-text-secondary leading-relaxed">{feature.body}</p>
                </div>
              ))}
            </div>
          </motion.div>
        </section>

        <section id="how-it-works" className="px-6 md:px-12 py-16 border-t border-border bg-app-bg">
          <motion.div className="max-w-7xl mx-auto" {...reveal} viewport={viewport}>
            <div className="mb-12">
              <h2 className="font-serif text-3xl sm:text-4xl font-bold tracking-tight text-text-primary">How it works</h2>
              <p className="text-text-secondary text-sm mt-1">Three steps from your first note to a finished melody.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {STEPS.map((step) => (
                <div key={step.number} className="p-6 rounded-2xl bg-surface border border-border">
                  <span className="font-mono text-2xl font-bold text-primary block mb-3">{step.number}</span>
                  <h3 className="text-base font-bold text-text-primary mb-2">{step.title}</h3>
                  <p className="text-xs sm:text-sm text-text-secondary leading-relaxed">{step.body}</p>
                </div>
              ))}
            </div>
          </motion.div>
        </section>

        <section id="instruments" className="px-6 md:px-12 py-16 border-t border-border bg-surface">
          <motion.div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12" {...reveal} viewport={viewport}>
            <div>
              <h2 className="font-serif text-2xl sm:text-3xl font-bold text-text-primary mb-3">Instruments</h2>
              <p className="text-sm text-text-secondary mb-6">
                Five voices synthesised live in your browser. No audio files are downloaded, and no samples need installing.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {INSTRUMENTS.map((instrument) => (
                  <div key={instrument.name} className="p-3.5 rounded-xl bg-app-bg border border-border text-xs">
                    <strong className="text-text-primary block font-semibold mb-0.5">{instrument.name}</strong>
                    <span className="text-text-muted text-[11px] leading-tight block">{instrument.detail}</span>
                  </div>
                ))}
              </div>
            </div>

            <div id="exports">
              <h2 className="font-serif text-2xl sm:text-3xl font-bold text-text-primary mb-3">Export formats</h2>
              <p className="text-sm text-text-secondary mb-6">
                Your score stays portable. Nothing is locked to MusikFlo, and every file is generated on your device.
              </p>

              <div className="space-y-3">
                {EXPORTS.map((format) => (
                  <div key={format.name} className="p-4 rounded-xl bg-app-bg border border-border flex items-start gap-3">
                    <format.icon size={18} className="text-primary mt-0.5 shrink-0" aria-hidden="true" />
                    <span className="text-xs">
                      <strong className="text-text-primary block font-semibold">{format.name}</strong>
                      <span className="text-text-muted">{format.detail}</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </section>

        <section className="px-6 md:px-12 py-20 border-t border-border bg-app-bg text-center">
          <motion.div className="max-w-2xl mx-auto flex flex-col items-center gap-6" {...reveal} viewport={viewport}>
            <h2 className="font-serif text-4xl sm:text-5xl font-bold text-text-primary tracking-tight">
              Your next melody starts with one note.
            </h2>
            <p className="text-text-secondary text-sm sm:text-base">
              No registration, no setup wizard, no subscription. Open the score canvas and start composing now.
            </p>
            <motion.button
              type="button"
              onClick={onStartComposing}
              className="flex items-center gap-2 px-8 py-4 text-sm font-semibold rounded-xl bg-primary text-white hover:bg-primary-hover shadow-md transition-colors"
              {...pressable}
            >
              <span>Open MusikFlo Studio</span>
              <ArrowRight size={16} />
            </motion.button>
          </motion.div>
        </section>
      </main>

      <Footer />
    </div>
  );
};
