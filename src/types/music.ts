/**
 * Canonical music data model and validation types for MusikFlo
 */

export type Clef = 'treble' | 'bass';

export type StaffMode = 'single' | 'grand';

export type TimeSignature = {
  numerator: number;
  denominator: number;
};

export type NoteDuration = '1' | '2' | '4' | '8' | '16';

export type Accidental = '#' | 'b' | 'n';

export type NoteStep = 'c' | 'd' | 'e' | 'f' | 'g' | 'a' | 'b';

export type InstrumentId = 'piano' | 'guitar' | 'strings' | 'flute' | 'bansuri' | 'clarinet';

export interface ScoreNote {
  id: string;
  step: NoteStep;
  octave: number; // typically 2 to 6
  accidental?: Accidental;
  duration: NoteDuration;
  dotted?: boolean;
  isRest?: boolean;
  tied?: boolean;
}

export interface Measure {
  id: string;
  events: ScoreNote[];
  /** Lower staff events in Grand Staff (Piano) mode */
  bassEvents?: ScoreNote[];
}

export interface PlaybackMuteState {
  trebleMuted?: boolean;
  bassMuted?: boolean;
}

export interface Score {
  id: string;
  title: string;
  composer: string;
  staffMode?: StaffMode; // 'single' (default) | 'grand' (Treble + Bass Piano Staff)
  clef: Clef;
  timeSignature: TimeSignature;
  keySignature: string; // e.g. 'C', 'G', 'D', 'F', 'Bb', 'Am'
  tempo: number; // BPM (40 - 240)
  instrument: InstrumentId;
  showTimeSigOnEveryBar?: boolean;
  playbackMute?: PlaybackMuteState;
  measures: Measure[];
  createdAt: number;
  updatedAt: number;
}

/**
 * Clone score note events with fresh unique IDs
 */
export function cloneEvents(events: ScoreNote[]): ScoreNote[] {
  return events.map((ev) => ({
    ...ev,
    id: `n-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
  }));
}

// Tick calculations: 960 ticks per quarter note
export const TICKS_PER_QUARTER = 960;

export const DURATION_TICKS: Record<NoteDuration, number> = {
  '1': TICKS_PER_QUARTER * 4,     // 3840
  '2': TICKS_PER_QUARTER * 2,     // 1920
  '4': TICKS_PER_QUARTER,         // 960
  '8': TICKS_PER_QUARTER / 2,     // 480
  '16': TICKS_PER_QUARTER / 4,    // 240
};

export function getEventTicks(event: ScoreNote): number {
  const baseTicks = DURATION_TICKS[event.duration];
  return event.dotted ? baseTicks * 1.5 : baseTicks;
}

export function getMeasureCapacityTicks(timeSignature: TimeSignature): number {
  return (timeSignature.numerator * (4 / timeSignature.denominator)) * TICKS_PER_QUARTER;
}

export function getMeasureTotalTicks(measure: Measure): number {
  return measure.events.reduce((sum, ev) => sum + getEventTicks(ev), 0);
}

export interface MeasureValidation {
  measureIndex: number;
  capacityTicks: number;
  usedTicks: number;
  status: 'complete' | 'incomplete' | 'overfull';
  message: string;
}

export function validateMeasure(
  measure: Measure,
  measureIndex: number,
  timeSignature: TimeSignature
): MeasureValidation {
  const capacityTicks = getMeasureCapacityTicks(timeSignature);
  const usedTicks = getMeasureTotalTicks(measure);
  const diffTicks = usedTicks - capacityTicks;
  const quarterBeatsCapacity = capacityTicks / TICKS_PER_QUARTER;
  const quarterBeatsUsed = usedTicks / TICKS_PER_QUARTER;

  if (diffTicks === 0) {
    return {
      measureIndex,
      capacityTicks,
      usedTicks,
      status: 'complete',
      message: `Measure ${measureIndex + 1} — ${timeSignature.numerator}/${timeSignature.denominator} beats complete`,
    };
  }

  if (diffTicks < 0) {
    const missingBeats = (-diffTicks) / TICKS_PER_QUARTER;
    const beatFormatted = missingBeats === 1 ? '1 quarter-note beat' : `${missingBeats.toFixed(missingBeats % 1 === 0 ? 0 : 2)} beats`;
    return {
      measureIndex,
      capacityTicks,
      usedTicks,
      status: 'incomplete',
      message: `Measure ${measureIndex + 1} — ${quarterBeatsUsed.toFixed(quarterBeatsUsed % 1 === 0 ? 0 : 1)}/${quarterBeatsCapacity} beats filled. Add ${beatFormatted}.`,
    };
  }

  const overBeats = diffTicks / TICKS_PER_QUARTER;
  return {
    measureIndex,
    capacityTicks,
    usedTicks,
    status: 'overfull',
    message: `Measure ${measureIndex + 1} — overfull by ${overBeats.toFixed(overBeats % 1 === 0 ? 0 : 2)} beat(s). Shorten or remove a note.`,
  };
}

// MIDI note number calculation
const SEMITONES: Record<NoteStep, number> = {
  c: 0,
  d: 2,
  e: 4,
  f: 5,
  g: 7,
  a: 9,
  b: 11,
};

export function getMidiNumber(step: NoteStep, octave: number, accidental?: Accidental): number {
  let semitone = SEMITONES[step];
  if (accidental === '#') semitone += 1;
  else if (accidental === 'b') semitone -= 1;
  return (octave + 1) * 12 + semitone;
}

export function getNoteFrequency(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export function getScientificPitch(note: ScoreNote): string {
  if (note.isRest) return 'Rest';
  const acc = note.accidental === '#' ? '♯' : note.accidental === 'b' ? '♭' : '';
  return `${note.step.toUpperCase()}${acc}${note.octave}`;
}

/**
 * Instrument labels now live beside the voice definitions in
 * `audio/instruments.ts`, so a label and its sound can never drift apart.
 */
