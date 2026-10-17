import { NoteDuration, TICKS_PER_QUARTER, getMeasureCapacityTicks } from '../types/music';
import { MAX_TRANSCRIPTION_MEASURES } from './config';
import { medianOnsetInterval } from './noteEvents';
import { QuantiseGrid, QuantiseReport, QuantisedEvent, RawNoteEvent, TranscriptionSettings } from './types';

/** A notation value the score model can express. */
export interface NotationValue {
  duration: NoteDuration;
  dotted: boolean;
}

/**
 * Rhythm quantisation and measure construction.
 *
 * Pure functions: no audio, no model, no rendering. The raw estimated timings are
 * never mutated — this layer derives notation from them and reports exactly what
 * it had to change, so the review screen can disclose the simplification.
 *
 * Design constraint: the score model has one duration per event and no reliable
 * tie playback. Rather than emit a tick count with no exact notation value (which
 * would make the plan and the engraved score disagree), every event is expressed
 * as one of the values below, and anything longer than the space left in a bar is
 * shortened with the remainder filled by rests. Shortened notes are counted and
 * disclosed.
 */

/** Every duration the score model can express, ascending. */
export const NOTATION_VALUES: Array<NotationValue & { ticks: number; duration: NoteDuration }> = [
  { ticks: TICKS_PER_QUARTER / 4, duration: '16', dotted: false },
  { ticks: TICKS_PER_QUARTER * 0.375, duration: '16', dotted: true },
  { ticks: TICKS_PER_QUARTER / 2, duration: '8', dotted: false },
  { ticks: TICKS_PER_QUARTER * 0.75, duration: '8', dotted: true },
  { ticks: TICKS_PER_QUARTER, duration: '4', dotted: false },
  { ticks: TICKS_PER_QUARTER * 1.5, duration: '4', dotted: true },
  { ticks: TICKS_PER_QUARTER * 2, duration: '2', dotted: false },
  { ticks: TICKS_PER_QUARTER * 3, duration: '2', dotted: true },
  { ticks: TICKS_PER_QUARTER * 4, duration: '1', dotted: false },
];

export const MIN_VALUE_TICKS = NOTATION_VALUES[0].ticks; // 240 (sixteenth)
const EIGHTH_TICKS = TICKS_PER_QUARTER / 2; // 480

export const QUANTISE_GRIDS: Array<{ id: QuantiseGrid; label: string; description: string }> = [
  { id: 'auto', label: 'Automatic', description: 'Picks a grid from the detected note spacing.' },
  { id: '8', label: 'Eighth notes', description: 'Coarser rhythm; simpler notation.' },
  { id: '16', label: 'Sixteenth notes', description: 'Finer rhythm; follows faster passages.' },
];

/** The notation value for a tick count, or null when it is not representable. */
export function notationForTicks(ticks: number): NotationValue | null {
  const match = NOTATION_VALUES.find((value) => Math.abs(value.ticks - ticks) < 1e-6);
  return match ? { duration: match.duration, dotted: match.dotted } : null;
}

/** The largest representable value that fits in `ticks` and is at least `minimum`. */
export function largestValueAtMost(ticks: number, minimum: number): number {
  let best = 0;
  for (const value of NOTATION_VALUES) {
    if (value.ticks <= ticks + 1e-6 && value.ticks >= minimum - 1e-6) best = value.ticks;
  }
  return best;
}

/** Nearest representable value to `ticks`, clamped to `[minimum, largest]`. */
export function nearestValue(ticks: number, minimum: number): number {
  let best = MIN_VALUE_TICKS;
  let bestError = Infinity;
  for (const value of NOTATION_VALUES) {
    if (value.ticks < minimum - 1e-6) continue;
    const error = Math.abs(value.ticks - ticks);
    if (error < bestError - 1e-6) {
      bestError = error;
      best = value.ticks;
    }
  }
  return best;
}

/** Choose the tick resolution for onset snapping. */
export function resolveGridTicks(grid: QuantiseGrid, events: RawNoteEvent[], bpm: number): number {
  if (grid === '8') return EIGHTH_TICKS;
  if (grid === '16') return MIN_VALUE_TICKS;

  const interval = medianOnsetInterval(events);
  if (interval === null) return EIGHTH_TICKS;

  const beatSeconds = 60 / Math.max(1, bpm);
  return interval / beatSeconds < 0.4 ? MIN_VALUE_TICKS : EIGHTH_TICKS;
}

/**
 * Decompose a tick count into representable values, largest first.
 * Used to fill gaps and bar remainders with rests.
 */
export function decomposeIntoTicks(ticks: number, minimum: number): number[] {
  const parts: number[] = [];
  let remaining = Math.round(ticks);
  let guard = 0;

  while (remaining >= minimum - 1e-6 && guard++ < 512) {
    const value = largestValueAtMost(remaining, minimum);
    if (value <= 0) break;
    parts.push(value);
    remaining -= value;
  }

  return parts;
}

export function quantiseEvents(events: RawNoteEvent[], settings: TranscriptionSettings): QuantiseReport {
  const capacity = getMeasureCapacityTicks(settings.timeSignature);
  const gridTicks = resolveGridTicks(settings.grid, events, settings.bpm);
  const secondsPerTick = 60 / settings.bpm / TICKS_PER_QUARTER;

  const stream: QuantisedEvent[] = [];
  let cursorTicks = 0;
  let timingErrorTotal = 0;
  let maxTimingErrorMs = 0;
  let simplified = false;
  let insertedRests = 0;

  for (const event of events) {
    const rawStartTicks = event.startSeconds / secondsPerTick;
    const rawDurationTicks = event.durationSeconds / secondsPerTick;

    const startTicks = Math.max(0, Math.round(rawStartTicks / gridTicks) * gridTicks);
    const durationTicks = nearestValue(rawDurationTicks, Math.max(MIN_VALUE_TICKS, gridTicks));

    const startErrorMs = Math.abs(startTicks - rawStartTicks) * secondsPerTick * 1000;
    const durationErrorMs = Math.abs(durationTicks - rawDurationTicks) * secondsPerTick * 1000;
    timingErrorTotal += startErrorMs;
    maxTimingErrorMs = Math.max(maxTimingErrorMs, startErrorMs);

    if (startErrorMs > 1 || durationErrorMs > 1) simplified = true;

    // Fill the gap before this note with rests.
    if (startTicks > cursorTicks) {
      const parts = decomposeIntoTicks(startTicks - cursorTicks, Math.min(gridTicks, MIN_VALUE_TICKS));
      for (const part of parts) {
        stream.push({ midi: null, isRest: true, ticks: part, sourceStartSeconds: null, timingErrorMs: 0 });
        insertedRests++;
      }
      cursorTicks = startTicks;
    } else if (startTicks < cursorTicks) {
      // The previous note still sounds. Shorten this one so events never overlap
      // in the score, and record that the rhythm changed.
      simplified = true;
    }

    stream.push({
      midi: event.midi,
      isRest: false,
      ticks: durationTicks,
      sourceStartSeconds: event.startSeconds,
      timingErrorMs: startErrorMs,
    });
    cursorTicks = Math.max(cursorTicks, startTicks) + durationTicks;
  }

  const { measures, truncatedNotes, droppedEvents, restsAdded } = layoutMeasures(stream, capacity, gridTicks);

  return {
    measures,
    gridTicks,
    minValueTicks: Math.max(MIN_VALUE_TICKS, gridTicks),
    simplified,
    meanTimingErrorMs: events.length > 0 ? timingErrorTotal / events.length : 0,
    maxTimingErrorMs,
    truncatedNotes,
    droppedEvents,
    insertedRests: insertedRests + restsAdded,
  };
}

interface LayoutResult {
  measures: QuantisedEvent[][];
  truncatedNotes: number;
  droppedEvents: number;
  restsAdded: number;
}

/**
 * Lay the stream out into exactly-full measures.
 *
 * A note with more ticks left than the bar can hold is shortened to the largest
 * representable value that fits, and the remaining space is filled with rests so
 * the bar is complete and every later note keeps its own onset. Shortened notes
 * are counted so the review screen can disclose them.
 */
export function layoutMeasures(stream: QuantisedEvent[], capacity: number, gridTicks: number): LayoutResult {
  const minimum = Math.max(MIN_VALUE_TICKS, gridTicks);
  const measures: QuantisedEvent[][] = [];
  let current: QuantisedEvent[] = [];
  let remaining = capacity;
  let truncatedNotes = 0;
  let droppedEvents = 0;
  let restsAdded = 0;

  const closeMeasure = () => {
    // Complete the bar with rests so every measure is exactly full.
    const filled = current.reduce((sum, item) => sum + item.ticks, 0);
    for (const part of decomposeIntoTicks(capacity - filled, MIN_VALUE_TICKS)) {
      current.push({ midi: null, isRest: true, ticks: part, sourceStartSeconds: null, timingErrorMs: 0 });
      restsAdded++;
    }
    measures.push(current);
    current = [];
    remaining = capacity;
  };

  for (const item of stream) {
    if (measures.length >= MAX_TRANSCRIPTION_MEASURES) {
      if (!item.isRest) droppedEvents++;
      continue;
    }

    let pending = item.ticks;

    while (pending > 0) {
      if (measures.length >= MAX_TRANSCRIPTION_MEASURES) {
        if (!item.isRest) droppedEvents++;
        break;
      }

      if (item.isRest) {
        let placed = 0;
        for (const part of decomposeIntoTicks(pending, MIN_VALUE_TICKS)) {
          if (part > remaining) break;
          current.push({ ...item, ticks: part });
          remaining -= part;
          placed += part;
          restsAdded++;
        }
        pending -= placed;

        if (remaining === 0 || placed === 0) closeMeasure();
        continue;
      }

      const fits = largestValueAtMost(Math.min(pending, remaining), minimum);

      if (fits <= 0) {
        // No room for a legal value in this bar: start the next one.
        closeMeasure();
        continue;
      }

      current.push({ ...item, ticks: fits });
      remaining -= fits;

      if (pending > fits) truncatedNotes++;
      pending = 0;

      if (remaining === 0) closeMeasure();
    }
  }

  // A score must contain at least one measure, so an empty stream still yields
  // one (rest-filled) bar rather than no measures at all.
  if (current.length > 0 || measures.length === 0) closeMeasure();

  return { measures: measures.slice(0, MAX_TRANSCRIPTION_MEASURES), truncatedNotes, droppedEvents, restsAdded };
}
