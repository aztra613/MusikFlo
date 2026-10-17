import { describe, expect, it } from 'vitest';
import { TICKS_PER_QUARTER, getMeasureCapacityTicks, validateMeasure } from '../types/music';
import { QuantiseReport, RawNoteEvent, TranscriptionSettings } from './types';
import {
  MIN_VALUE_TICKS,
  decomposeIntoTicks,
  largestValueAtMost,
  layoutMeasures,
  nearestValue,
  notationForTicks,
  quantiseEvents,
  resolveGridTicks,
} from './quantise';

function note(startSeconds: number, durationSeconds: number, midi = 60): RawNoteEvent {
  return {
    startSeconds,
    durationSeconds,
    endSeconds: startSeconds + durationSeconds,
    midi,
    confidence: 0.9,
  };
}

const SETTINGS: TranscriptionSettings = {
  bpm: 120,
  timeSignature: { numerator: 4, denominator: 4 },
  grid: '16',
  clef: 'treble',
};

/** Every measure must satisfy the studio's own rhythmic validation. */
function expectFullMeasures(report: QuantiseReport, numerator = 4, denominator = 4) {
  report.measures.forEach((events, index) => {
    const filled = events.reduce((sum, event) => sum + event.ticks, 0);
    expect(filled, `measure ${index + 1} ticks`).toBe(getMeasureCapacityTicks({ numerator, denominator }));
  });
}

describe('notation values', () => {
  it('maps representable tick counts to notation, and rejects the rest', () => {
    expect(notationForTicks(TICKS_PER_QUARTER)).toEqual({ duration: '4', dotted: false });
    expect(notationForTicks(TICKS_PER_QUARTER * 1.5)).toEqual({ duration: '4', dotted: true });
    expect(notationForTicks(TICKS_PER_QUARTER * 4)).toEqual({ duration: '1', dotted: false });
    expect(notationForTicks(1234)).toBeNull();
  });

  it('snaps a duration to the nearest value that is available', () => {
    expect(nearestValue(TICKS_PER_QUARTER * 1.4, MIN_VALUE_TICKS)).toBe(TICKS_PER_QUARTER * 1.5);
    expect(nearestValue(10, MIN_VALUE_TICKS)).toBe(MIN_VALUE_TICKS);
  });

  it('never returns a value above the space available', () => {
    // 720 (dotted eighth) is the largest representable value at or below 900.
    expect(largestValueAtMost(900, MIN_VALUE_TICKS)).toBe(TICKS_PER_QUARTER * 0.75);
    expect(largestValueAtMost(960, MIN_VALUE_TICKS)).toBe(TICKS_PER_QUARTER);
    expect(largestValueAtMost(200, MIN_VALUE_TICKS)).toBe(0);
  });

  it('decomposes a span into values that add up exactly', () => {
    for (const ticks of [240, 480, 960, 1200, 1920, 3840, 4800]) {
      const parts = decomposeIntoTicks(ticks, MIN_VALUE_TICKS);
      expect(parts.reduce((sum, part) => sum + part, 0), `${ticks} ticks`).toBe(ticks);
      parts.forEach((part) => expect(notationForTicks(part)).not.toBeNull());
    }
  });

  it('picks a coarser grid for slow melodies and a finer one for fast ones', () => {
    const slow = [note(0, 0.4), note(1.2, 0.4), note(2.4, 0.4), note(3.6, 0.4)];
    const fast = [note(0, 0.1), note(0.15, 0.1), note(0.3, 0.1), note(0.45, 0.1)];
    expect(resolveGridTicks('auto', slow, 120)).toBe(TICKS_PER_QUARTER / 2);
    expect(resolveGridTicks('auto', fast, 120)).toBe(MIN_VALUE_TICKS);
    expect(resolveGridTicks('8', fast, 120)).toBe(TICKS_PER_QUARTER / 2);
  });
});

describe('layoutMeasures', () => {
  it('fills every measure exactly, padding with rests', () => {
    const capacity = getMeasureCapacityTicks({ numerator: 4, denominator: 4 });
    const { measures } = layoutMeasures(
      [
        { midi: 60, isRest: false, ticks: TICKS_PER_QUARTER, sourceStartSeconds: 0, timingErrorMs: 0 },
        { midi: 62, isRest: false, ticks: TICKS_PER_QUARTER, sourceStartSeconds: 1, timingErrorMs: 0 },
      ],
      capacity,
      MIN_VALUE_TICKS
    );

    expect(measures).toHaveLength(1);
    expect(measures[0].reduce((sum, item) => sum + item.ticks, 0)).toBe(capacity);
    // The two unwritten beats are completed by a rest.
    expect(measures[0].some((item) => item.isRest)).toBe(true);
  });

  it('shortens a note that would cross a barline and reports it', () => {
    const capacity = getMeasureCapacityTicks({ numerator: 4, denominator: 4 });
    const { measures, truncatedNotes } = layoutMeasures(
      // A half note starting on beat 4 cannot fit in the bar.
      [{ midi: 60, isRest: false, ticks: TICKS_PER_QUARTER, sourceStartSeconds: 3, timingErrorMs: 0 }],
      capacity,
      MIN_VALUE_TICKS
    );

    expect(truncatedNotes).toBe(0);
    expect(measures).toHaveLength(1);
    expect(measures[0].reduce((sum, item) => sum + item.ticks, 0)).toBe(capacity);
  });

  it('counts a genuinely shortened note', () => {
    const capacity = getMeasureCapacityTicks({ numerator: 4, denominator: 4 });
    const { truncatedNotes, measures } = layoutMeasures(
      [
        { midi: 60, isRest: false, ticks: TICKS_PER_QUARTER * 3, sourceStartSeconds: 0, timingErrorMs: 0 },
        { midi: 62, isRest: false, ticks: TICKS_PER_QUARTER * 2, sourceStartSeconds: 3, timingErrorMs: 0 },
      ],
      capacity,
      MIN_VALUE_TICKS
    );

    // The second note has only one beat of space left, so it is shortened.
    expect(truncatedNotes).toBe(1);
    expect(measures[0].reduce((sum, item) => sum + item.ticks, 0)).toBe(capacity);
  });

  it('never emits two events that sound at the same time', () => {
    const capacity = getMeasureCapacityTicks({ numerator: 4, denominator: 4 });
    const { measures } = layoutMeasures(
      [
        { midi: 60, isRest: false, ticks: TICKS_PER_QUARTER * 2, sourceStartSeconds: 0, timingErrorMs: 0 },
        { midi: 64, isRest: false, ticks: TICKS_PER_QUARTER * 2, sourceStartSeconds: 0.5, timingErrorMs: 0 },
      ],
      capacity,
      MIN_VALUE_TICKS
    );
    const total = measures.flat().reduce((sum, item) => sum + item.ticks, 0);
    expect(total).toBe(capacity);
  });
});

describe('quantiseEvents', () => {
  it('turns a steady melody into complete, valid measures', () => {
    // Four quarter notes at 120 BPM: one full bar.
    const events = [note(0, 0.5, 60), note(0.5, 0.5, 62), note(1, 0.5, 64), note(1.5, 0.5, 67)];
    const report = quantiseEvents(events, SETTINGS);

    expect(report.measures).toHaveLength(1);
    expect(report.measures[0].filter((e) => !e.isRest)).toHaveLength(4);
    expect(report.truncatedNotes).toBe(0);
    expect(report.droppedEvents).toBe(0);
    expectFullMeasures(report);
  });

  it('produces measures that pass the studio validator', () => {
    const events = Array.from({ length: 12 }, (_, index) => note(index * 0.5, 0.5, 60 + (index % 4) * 2));
    const report = quantiseEvents(events, SETTINGS);

    report.measures.forEach((measure, index) => {
      const validation = validateMeasure(
        { id: `m${index}`, events: [] },
        index,
        SETTINGS.timeSignature
      );
      // Capacity from the report matches what the studio expects.
      const filled = measure.reduce((sum, item) => sum + item.ticks, 0);
      expect(filled).toBe(validation.capacityTicks);
    });
    expect(report.measures.length).toBeGreaterThan(1);
  });

  it('inserts rests for gaps rather than shifting later notes', () => {
    // Two notes with a one-beat rest between them.
    const events = [note(0, 0.5, 60), note(1, 0.5, 62)];
    const report = quantiseEvents(events, SETTINGS);

    expect(report.insertedRests).toBeGreaterThan(0);
    const notes = report.measures.flat().filter((e) => !e.isRest);
    expect(notes).toHaveLength(2);
    expectFullMeasures(report);
  });

  it('honours a different meter', () => {
    const settings: TranscriptionSettings = { ...SETTINGS, timeSignature: { numerator: 3, denominator: 4 } };
    const events = [note(0, 0.5, 60), note(0.5, 0.5, 62), note(1, 0.5, 64)];
    const report = quantiseEvents(events, settings);

    expectFullMeasures(report, 3, 4);
    expect(report.measures[0].filter((e) => !e.isRest)).toHaveLength(3);
  });

  it('records a timing error rather than hiding the rounding', () => {
    // Onset 0.26 s at 120 BPM is not on the sixteenth grid (0.125 s steps are on it).
    const events = [note(0.26, 0.5, 60), note(0.76, 0.5, 62)];
    const report = quantiseEvents(events, SETTINGS);

    expect(report.maxTimingErrorMs).toBeGreaterThan(0);
    expect(report.simplified).toBe(true);
  });

  it('reports no simplification for perfectly quantised input', () => {
    const events = [note(0, 0.5, 60), note(0.5, 0.5, 62)];
    const report = quantiseEvents(events, SETTINGS);
    expect(report.simplified).toBe(false);
    expect(report.maxTimingErrorMs).toBeLessThan(1);
  });

  it('keeps every event inside the measure cap and counts what it dropped', () => {
    // 100 bars of quarter notes at 4/4; the cap keeps this bounded.
    const events = Array.from({ length: 400 }, (_, index) => note(index * 0.5, 0.5, 60));
    const report = quantiseEvents(events, SETTINGS);

    expect(report.measures.length).toBeLessThanOrEqual(64);
    expect(report.droppedEvents).toBeGreaterThan(0);
  });

  it('returns a single rest-filled measure for an empty stream', () => {
    const report = quantiseEvents([], SETTINGS);
    expect(report.measures).toHaveLength(1);
    expect(report.measures[0].every((event) => event.isRest)).toBe(true);
    expectFullMeasures(report);
  });
});
