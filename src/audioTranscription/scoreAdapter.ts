import { Clef, Score, ScoreNote, TimeSignature } from '../types/music';
import { NoteSummary, summariseEvents } from './noteEvents';
import { QuantiseReport, RawNoteEvent, TranscriptionSettings } from './types';
import { notationForTicks } from './quantise';

/**
 * Adapter from the transcription result model into the canonical MusikFlo score.
 *
 * This is the only place transcription touches the project model. It creates a
 * brand-new score with new identifiers and never mutates an existing one, so
 * accepting a transcription cannot overwrite the composition already open.
 */

const SHARP_NAMES: Array<{ step: ScoreNote['step']; accidental?: ScoreNote['accidental'] }> = [
  { step: 'c' },
  { step: 'c', accidental: '#' },
  { step: 'd' },
  { step: 'd', accidental: '#' },
  { step: 'e' },
  { step: 'f' },
  { step: 'f', accidental: '#' },
  { step: 'g' },
  { step: 'g', accidental: '#' },
  { step: 'a' },
  { step: 'a', accidental: '#' },
  { step: 'b' },
];

const FLAT_NAMES: Array<{ step: ScoreNote['step']; accidental?: ScoreNote['accidental'] }> = [
  { step: 'c' },
  { step: 'd', accidental: 'b' },
  { step: 'd' },
  { step: 'e', accidental: 'b' },
  { step: 'e' },
  { step: 'f' },
  { step: 'g', accidental: 'b' },
  { step: 'g' },
  { step: 'a', accidental: 'b' },
  { step: 'a' },
  { step: 'b', accidental: 'b' },
  { step: 'b' },
];

/** Key signatures that are conventionally written with flats. */
const FLAT_KEYS = new Set(['F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Cb', 'Dm', 'Gm', 'Cm', 'Fm', 'Bbm', 'Ebm']);

export interface MidiPitch {
  step: ScoreNote['step'];
  octave: number;
  accidental?: ScoreNote['accidental'];
}

/**
 * Convert a MIDI note number to a spelled pitch.
 *
 * Spelling follows the key signature's convention (sharps or flats) rather than
 * always choosing sharps, so a transcription in F major reads with flats as a
 * musician would expect.
 */
export function midiToPitch(midi: number, keySignature: string): MidiPitch {
  const table = FLAT_KEYS.has(keySignature) ? FLAT_NAMES : SHARP_NAMES;
  const pitchClass = ((midi % 12) + 12) % 12;
  const octave = Math.floor(midi / 12) - 1;
  const { step, accidental } = table[pitchClass];
  return accidental ? { step, octave, accidental } : { step, octave };
}

/** Musical range midpoint: below this, a bass staff reads more comfortably. */
const TREBLE_FLOOR_MIDI = 57; // A3

/**
 * Suggested clef for a set of events.
 *
 * This is a readable default offered to the user, not a musical claim: the clef
 * stays a visible, changeable setting on the review screen.
 */
export function suggestClef(events: RawNoteEvent[]): Clef {
  if (events.length === 0) return 'treble';
  const pitches = events.map((event) => event.midi).sort((a, b) => a - b);
  const median = pitches[Math.floor(pitches.length / 2)];
  return median < TREBLE_FLOOR_MIDI ? 'bass' : 'treble';
}

/** Nearest supported tempo, clamped to the range the transport accepts. */
export function clampTempo(bpm: number): number {
  return Math.max(40, Math.min(240, Math.round(bpm)));
}

export interface BuildScoreOptions {
  report: QuantiseReport;
  settings: TranscriptionSettings;
  /** Used for the project title and composer fields. */
  sourceName: string;
  keySignature?: string;
  instrument?: Score['instrument'];
}

function newId(prefix: string, index: number): string {
  return `${prefix}-${Date.now().toString(36)}-${index}-${Math.random().toString(36).slice(2, 7)}`;
}

/** File name without its extension, used as the new project's title. */
export function titleFromFileName(fileName: string): string {
  const base = fileName.replace(/\.[^.]+$/, '').trim();
  return base.length > 0 ? base.slice(0, 80) : 'Transcribed audio';
}

/**
 * Build a new canonical score from a quantised transcription.
 *
 * Every measure contains exactly one bar of representable values, so the result
 * passes the studio's own rhythmic validation rather than being forced in.
 */
export function buildScoreFromTranscription(options: BuildScoreOptions): Score {
  const { report, settings, sourceName } = options;
  const keySignature = options.keySignature ?? 'C';
  const now = Date.now();

  const measures = report.measures.map((events, measureIndex) => ({
    id: newId('m', measureIndex),
    events: events.map((event, eventIndex): ScoreNote => {
      const notation = notationForTicks(event.ticks) ?? { duration: '16' as const, dotted: false };
      const id = newId('n', measureIndex * 1000 + eventIndex);

      if (event.isRest || event.midi === null) {
        return {
          id,
          step: 'b',
          octave: 4,
          duration: notation.duration,
          dotted: notation.dotted || undefined,
          isRest: true,
        };
      }

      const pitch = midiToPitch(event.midi, keySignature);
      return {
        id,
        step: pitch.step,
        octave: pitch.octave,
        duration: notation.duration,
        dotted: notation.dotted || undefined,
        accidental: pitch.accidental,
      };
    }),
  }));

  return {
    id: newId('score', 0),
    title: titleFromFileName(sourceName),
    // Provenance is recorded at project level rather than by adding a field to
    // the note model, so the canonical score schema is unchanged.
    composer: 'Transcribed from audio',
    clef: settings.clef,
    timeSignature: settings.timeSignature,
    keySignature,
    tempo: clampTempo(settings.bpm),
    instrument: options.instrument ?? 'piano',
    measures: measures.length > 0 ? measures : [{ id: newId('m', 0), events: [] }],
    createdAt: now,
    updatedAt: now,
  };
}

/** Review-screen summary of what the conversion did to the detected timing. */
export interface ConversionSummary {
  noteSummary: NoteSummary;
  measures: number;
  gridTicks: number;
  beatsPerBar: number;
  simplified: boolean;
  meanTimingErrorMs: number;
  maxTimingErrorMs: number;
  truncatedNotes: number;
  droppedEvents: number;
  insertedRests: number;
  /** True when the detected audio contained genuinely simultaneous notes. */
  polyphonic: boolean;
  /** Count of events involved in a genuine simultaneity. */
  significantOverlaps: number;
}

export function summariseConversion(
  events: RawNoteEvent[],
  report: QuantiseReport,
  timeSignature: TimeSignature
): ConversionSummary {
  const noteSummary = summariseEvents(events);
  return {
    noteSummary,
    measures: report.measures.length,
    gridTicks: report.gridTicks,
    beatsPerBar: (timeSignature.numerator * 4) / timeSignature.denominator,
    simplified: report.simplified,
    meanTimingErrorMs: report.meanTimingErrorMs,
    maxTimingErrorMs: report.maxTimingErrorMs,
    truncatedNotes: report.truncatedNotes,
    droppedEvents: report.droppedEvents,
    insertedRests: report.insertedRests,
    // Genuine simultaneities only; a legato tail must not be reported as a chord.
    polyphonic: noteSummary.significantOverlaps > 0,
    significantOverlaps: noteSummary.significantOverlaps,
  };
}

/** Human-readable grid label for the review summary. */
export function gridLabel(gridTicks: number): string {
  if (gridTicks >= 960) return 'quarter notes';
  if (gridTicks >= 480) return 'eighth notes';
  return 'sixteenth notes';
}
