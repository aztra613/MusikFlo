import {
  Accidental,
  Clef,
  InstrumentId,
  Measure,
  NoteDuration,
  NoteStep,
  Score,
  ScoreNote,
  TimeSignature,
} from '../types/music';
import { INSTRUMENT_IDS } from '../audio/instruments';

const CLEFS: Clef[] = ['treble', 'bass'];
/** Derived from the voice table, so a new instrument is accepted automatically. */
const INSTRUMENTS: InstrumentId[] = INSTRUMENT_IDS;
const DURATIONS: NoteDuration[] = ['1', '2', '4', '8', '16'];
const STEPS: NoteStep[] = ['c', 'd', 'e', 'f', 'g', 'a', 'b'];
const ACCIDENTALS: Accidental[] = ['#', 'b', 'n'];

/** Conservative limits so a malformed file cannot exhaust the browser. */
export const IMPORT_LIMITS = {
  maxMeasures: 200,
  maxEventsPerMeasure: 64,
  minTempo: 20,
  maxTempo: 320,
  minOctave: 0,
  maxOctave: 9,
};

export interface ImportValidationResult {
  ok: boolean;
  score?: Score;
  errors: string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validateTimeSignature(value: unknown, errors: string[]): TimeSignature {
  if (!isRecord(value)) {
    errors.push('timeSignature must be an object with a numerator and denominator');
    return { numerator: 4, denominator: 4 };
  }

  const numerator = Number(value.numerator);
  const denominator = Number(value.denominator);
  const validDenominators = [1, 2, 4, 8, 16];

  if (!Number.isInteger(numerator) || numerator < 1 || numerator > 32) {
    errors.push('timeSignature.numerator must be a whole number between 1 and 32');
  }
  if (!validDenominators.includes(denominator)) {
    errors.push('timeSignature.denominator must be one of 1, 2, 4, 8 or 16');
  }

  return {
    numerator: Number.isInteger(numerator) && numerator >= 1 && numerator <= 32 ? numerator : 4,
    denominator: validDenominators.includes(denominator) ? denominator : 4,
  };
}

function validateEvent(value: unknown, path: string, errors: string[]): ScoreNote | null {
  if (!isRecord(value)) {
    errors.push(`${path} is not a note object`);
    return null;
  }

  const step = value.step as NoteStep;
  if (!STEPS.includes(step)) {
    errors.push(`${path}.step must be one of ${STEPS.join(', ')}`);
  }

  const octave = Number(value.octave);
  if (!Number.isInteger(octave) || octave < IMPORT_LIMITS.minOctave || octave > IMPORT_LIMITS.maxOctave) {
    errors.push(`${path}.octave must be a whole number between ${IMPORT_LIMITS.minOctave} and ${IMPORT_LIMITS.maxOctave}`);
  }

  const duration = value.duration as NoteDuration;
  if (!DURATIONS.includes(duration)) {
    errors.push(`${path}.duration must be one of ${DURATIONS.join(', ')}`);
  }

  if (value.accidental !== undefined && !ACCIDENTALS.includes(value.accidental as Accidental)) {
    errors.push(`${path}.accidental must be one of ${ACCIDENTALS.join(', ')} when present`);
  }

  if (typeof value.id !== 'string' || value.id.length === 0) {
    errors.push(`${path}.id must be a non-empty string`);
  }

  if (errors.length > 0) return null;

  return {
    id: value.id as string,
    step,
    octave,
    duration,
    accidental: value.accidental as Accidental | undefined,
    dotted: value.dotted === true || undefined,
    isRest: value.isRest === true || undefined,
    tied: value.tied === true || undefined,
  };
}

/**
 * Validate an imported .musikflo project before it reaches the editor. Import
 * previously accepted any object with a `measures` array, which let malformed
 * files crash rendering, playback and export.
 */
export function validateImportedScore(input: unknown): ImportValidationResult {
  const errors: string[] = [];

  if (!isRecord(input)) {
    return { ok: false, errors: ['The file does not contain a MusikFlo project object.'] };
  }

  if (typeof input.id !== 'string' || input.id.length === 0) errors.push('id must be a non-empty string');
  if (typeof input.title !== 'string') errors.push('title must be a string');
  if (typeof input.composer !== 'string') errors.push('composer must be a string');

  const clef = input.clef as Clef;
  if (!CLEFS.includes(clef)) errors.push(`clef must be one of ${CLEFS.join(', ')}`);

  const instrument = input.instrument as InstrumentId;
  if (!INSTRUMENTS.includes(instrument)) errors.push(`instrument must be one of ${INSTRUMENTS.join(', ')}`);

  if (typeof input.keySignature !== 'string') errors.push('keySignature must be a string');

  const tempo = Number(input.tempo);
  if (!Number.isFinite(tempo) || tempo < IMPORT_LIMITS.minTempo || tempo > IMPORT_LIMITS.maxTempo) {
    errors.push(`tempo must be a number between ${IMPORT_LIMITS.minTempo} and ${IMPORT_LIMITS.maxTempo}`);
  }

  const timeSignature = validateTimeSignature(input.timeSignature, errors);

  if (!Array.isArray(input.measures)) {
    errors.push('measures must be an array');
    return { ok: false, errors };
  }

  if (input.measures.length === 0) errors.push('a project must contain at least one measure');
  if (input.measures.length > IMPORT_LIMITS.maxMeasures) {
    errors.push(`a project cannot contain more than ${IMPORT_LIMITS.maxMeasures} measures`);
  }

  const measures: Measure[] = [];
  const seenMeasureIds = new Set<string>();

  input.measures.forEach((rawMeasure, mIdx) => {
    const path = `measures[${mIdx}]`;
    if (!isRecord(rawMeasure)) {
      errors.push(`${path} is not a measure object`);
      return;
    }

    const id = rawMeasure.id;
    if (typeof id !== 'string' || id.length === 0) {
      errors.push(`${path}.id must be a non-empty string`);
    } else if (seenMeasureIds.has(id)) {
      errors.push(`${path}.id is duplicated`);
    } else {
      seenMeasureIds.add(id);
    }

    if (!Array.isArray(rawMeasure.events)) {
      errors.push(`${path}.events must be an array`);
      return;
    }
    if (rawMeasure.events.length > IMPORT_LIMITS.maxEventsPerMeasure) {
      errors.push(`${path}.events cannot contain more than ${IMPORT_LIMITS.maxEventsPerMeasure} events`);
      return;
    }

    const before = errors.length;
    const events = rawMeasure.events
      .map((event, eIdx) => validateEvent(event, `${path}.events[${eIdx}]`, errors))
      .filter((event): event is ScoreNote => event !== null);

    if (errors.length > before) return;

    measures.push({ id: id as string, events });
  });

  if (errors.length > 0) return { ok: false, errors };

  const now = Date.now();
  const score: Score = {
    id: input.id as string,
    title: input.title as string,
    composer: input.composer as string,
    clef,
    timeSignature,
    keySignature: input.keySignature as string,
    tempo,
    instrument,
    showTimeSigOnEveryBar: input.showTimeSigOnEveryBar === true || undefined,
    measures,
    createdAt: Number.isFinite(Number(input.createdAt)) ? Number(input.createdAt) : now,
    updatedAt: Number.isFinite(Number(input.updatedAt)) ? Number(input.updatedAt) : now,
  };

  return { ok: true, score, errors: [] };
}
