import { Clef, TimeSignature } from '../types/music';

/**
 * Audio-to-sheet-music — result model.
 *
 * Deliberately separate from the canonical `Score` model: inference output is an
 * estimate with timings in seconds, and it must survive review and re-quantisation
 * without ever being written into a project as if it were certain.
 */

/** A single estimated note, in seconds, as returned by the model. */
export interface RawNoteEvent {
  /** Onset from the start of the clip, in seconds. */
  startSeconds: number;
  /** Sounding length, in seconds. */
  durationSeconds: number;
  /** End derived from start + duration, in seconds. */
  endSeconds: number;
  /** MIDI note number (0–127). */
  midi: number;
  /** Model amplitude confidence, 0–1. */
  confidence: number;
}

/** Diagnostics recorded for development. Never contains audio or note content. */
export interface TranscriptionDiagnostics {
  decodeMs: number;
  resampleMs: number;
  modelLoadMs: number;
  inferenceMs: number;
  modelFrames: number;
  inputSampleRate: number;
  outputSampleRate: number;
}

export interface TranscriptionResult {
  /** Estimated notes, sorted by onset. Timing is preserved exactly as inferred. */
  events: RawNoteEvent[];
  /** Decoded clip duration in seconds. */
  durationSeconds: number;
  /** Number of events that sound at the same time as another event. */
  overlappingEvents: number;
  diagnostics: TranscriptionDiagnostics;
}

/** Stages the flow reports. Progress values are only emitted where measurable. */
export type TranscriptionStage =
  | 'idle'
  | 'decoding'
  | 'loading-model'
  | 'analysing'
  | 'normalising'
  | 'done';

export interface TranscriptionProgress {
  stage: TranscriptionStage;
  /** Human-readable, safe to show. */
  message: string;
  /** 0–1, only present when the runtime reports a measurable percentage. */
  percent?: number;
}

/** Rhythm grid offered during review. */
export type QuantiseGrid = 'auto' | '8' | '16';

/** Settings the user controls before the score is built. */
export interface TranscriptionSettings {
  bpm: number;
  timeSignature: TimeSignature;
  grid: QuantiseGrid;
  /** Clef for the generated score. */
  clef: Clef;
}

/** How a detected note was turned into notation. */
export interface QuantisedEvent {
  /** MIDI number, or null for a rest. */
  midi: number | null;
  isRest: boolean;
  /** Duration in score ticks. */
  ticks: number;
  /** Original onset in seconds, where the event came from audio. */
  sourceStartSeconds: number | null;
  /** Absolute quantisation error for this event, in milliseconds. */
  timingErrorMs: number;
}

export interface QuantiseReport {
  /** Measures of quantised events, in order. */
  measures: QuantisedEvent[][];
  /** Onset resolution actually used, in ticks. */
  gridTicks: number;
  /** Smallest note value used, in ticks. */
  minValueTicks: number;
  /** True when a note's timing or duration had to be rounded to the grid. */
  simplified: boolean;
  meanTimingErrorMs: number;
  maxTimingErrorMs: number;
  /** Notes shortened because they would otherwise cross a barline. */
  truncatedNotes: number;
  /** Events that could not be represented (beyond the measure cap). */
  droppedEvents: number;
  /** Rests inserted to fill gaps or complete bars. */
  insertedRests: number;
}

export interface TranscriptionError {
  /** Stable code for diagnostics; the message is what the user sees. */
  code:
    | 'unsupported-type'
    | 'too-large'
    | 'too-long'
    | 'empty-audio'
    | 'decode-failed'
    | 'model-load-failed'
    | 'inference-failed'
    | 'no-notes'
    | 'cancelled'
    | 'unknown';
  message: string;
  /** Optional remediation shown beneath the message. */
  hint?: string;
}

export class TranscriptionFailure extends Error {
  readonly code: TranscriptionError['code'];
  readonly hint?: string;

  constructor(error: TranscriptionError) {
    super(error.message);
    this.name = 'TranscriptionFailure';
    this.code = error.code;
    this.hint = error.hint;
  }
}
