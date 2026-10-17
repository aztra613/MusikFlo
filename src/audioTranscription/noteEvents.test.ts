import { describe, expect, it } from 'vitest';
import { RawNoteEvent } from './types';
import {
  countOverlappingEvents,
  countSignificantOverlaps,
  extractMelody,
  medianOnsetInterval,
  normaliseNoteEvents,
  suggestTempo,
  summariseEvents,
} from './noteEvents';

function event(startSeconds: number, durationSeconds: number, midi: number, amplitude = 0.8): RawNoteEvent {
  return {
    startSeconds,
    durationSeconds,
    endSeconds: startSeconds + durationSeconds,
    midi,
    confidence: amplitude,
  };
}

describe('normaliseNoteEvents', () => {
  it('sorts events by onset and derives end times', () => {
    const result = normaliseNoteEvents([
      { startSeconds: 0.5, durationSeconds: 0.4, midi: 64 },
      { startSeconds: 0.1, durationSeconds: 0.3, midi: 60 },
    ]);

    expect(result.map((e) => e.midi)).toEqual([60, 64]);
    expect(result[0].endSeconds).toBeCloseTo(0.4, 6);
  });

  it('rejects impossible values instead of passing them to the score', () => {
    const result = normaliseNoteEvents([
      { startSeconds: -1, durationSeconds: 0.5, midi: 60 },
      { startSeconds: 0.2, durationSeconds: 0, midi: 60 },
      { startSeconds: 0.3, durationSeconds: 0.5, midi: 999 },
      { startSeconds: Number.NaN, durationSeconds: 0.5, midi: 60 },
      { startSeconds: 0.4, durationSeconds: 0.5, midi: 60 },
    ]);

    expect(result).toHaveLength(1);
    expect(result[0].midi).toBe(60);
  });

  it('clamps events that run past the end of the clip', () => {
    const result = normaliseNoteEvents([{ startSeconds: 1.8, durationSeconds: 1, midi: 60 }], {
      clipDurationSeconds: 2,
    });

    expect(result[0].endSeconds).toBe(2);
    expect(result[0].durationSeconds).toBeCloseTo(0.2, 6);
  });

  it('sorts simultaneous notes from low to high so the melody is predictable', () => {
    const result = normaliseNoteEvents([
      { startSeconds: 0, durationSeconds: 1, midi: 67 },
      { startSeconds: 0, durationSeconds: 1, midi: 60 },
      { startSeconds: 0, durationSeconds: 1, midi: 64 },
    ]);
    expect(result.map((e) => e.midi)).toEqual([60, 64, 67]);
  });
});

describe('countOverlappingEvents', () => {
  it('reports zero for a strictly sequential line', () => {
    expect(countOverlappingEvents([event(0, 0.5, 60), event(0.5, 0.5, 62), event(1, 0.5, 64)])).toBe(0);
  });

  it('counts every note involved in a simultaneity', () => {
    // Three notes sounding together: all three are unrepresentable in a
    // single-line score, so all three must be reported.
    expect(countOverlappingEvents([event(0, 1, 60), event(0.1, 1, 64), event(0.2, 1, 67)])).toBe(3);
  });

  it('does not treat a touching boundary as an overlap', () => {
    expect(countOverlappingEvents([event(0, 1, 60), event(1, 1, 62)])).toBe(0);
  });

  it('detects a long note overlapping a later short note', () => {
    expect(countOverlappingEvents([event(0, 2, 48), event(1, 0.5, 72)])).toBe(2);
  });
});

describe('extractMelody', () => {
  it('keeps the highest note of a simultaneous group and reports what it removed', () => {
    const result = extractMelody([event(0, 1, 60), event(0, 1, 64), event(0, 1, 67)]);

    expect(result.events).toHaveLength(1);
    expect(result.events[0].midi).toBe(67);
    expect(result.removedCount).toBe(2);
  });

  it('leaves a monophonic line untouched', () => {
    const input = [event(0, 0.5, 60), event(0.5, 0.5, 62)];
    const result = extractMelody(input);
    expect(result.events.map((e) => e.midi)).toEqual([60, 62]);
    expect(result.removedCount).toBe(0);
  });

  it('trims the lower note so the result never overlaps', () => {
    const result = extractMelody([event(0, 2, 60), event(1, 0.5, 72)]);
    expect(result.events.map((e) => e.midi)).toEqual([60, 72]);
    // The held C is cut off where the higher note begins.
    expect(result.events[0].endSeconds).toBeCloseTo(1, 6);
    expect(result.trimmedCount).toBe(1);
    expect(result.removedCount).toBe(0);
    expect(countOverlappingEvents(result.events)).toBe(0);
  });

  it('reports trimming and removal separately', () => {
    // A rising line trims the earlier note; a falling line removes the lower one.
    const rising = extractMelody([event(0, 1, 60), event(0.5, 1, 67)]);
    expect(rising).toMatchObject({ trimmedCount: 1, removedCount: 0 });

    const falling = extractMelody([event(0, 1, 67), event(0.5, 1, 60)]);
    expect(falling).toMatchObject({ trimmedCount: 0, removedCount: 1 });
  });
});

describe('tempo and summary helpers', () => {
  it('derives an interval and a tempo from steady onsets', () => {
    const events = [event(0, 0.4, 60), event(0.5, 0.4, 62), event(1, 0.4, 64), event(1.5, 0.4, 65)];
    expect(medianOnsetInterval(events)).toBeCloseTo(0.5, 6);
    expect(suggestTempo(events)).toBe(120);
  });

  it('reports no tempo for a single note', () => {
    expect(suggestTempo([event(0, 1, 60)])).toBeNull();
  });

  it('summarises pitch range and overlaps', () => {
    const summary = summariseEvents([event(0, 1, 60), event(0, 1, 67), event(2, 1, 62)]);
    expect(summary.noteCount).toBe(3);
    expect(summary.lowestMidi).toBe(60);
    expect(summary.highestMidi).toBe(67);
    expect(summary.distinctPitches).toBe(3);
    expect(summary.overlappingEvents).toBe(2);
  });

  it('summarises an empty result without throwing', () => {
    expect(summariseEvents([])).toEqual({
      noteCount: 0,
      distinctPitches: 0,
      lowestMidi: null,
      highestMidi: null,
      overlappingEvents: 0,
      significantOverlaps: 0,
    });
  });
});

describe('countSignificantOverlaps', () => {
  it('ignores a legato tail, which is not a chord', () => {
    // Measured on the reference fixture: tones that ring 10% past their written
    // length overlap the next note by ~160 ms but do not sound together.
    const legato = [event(0, 0.66, 60), event(0.6, 0.66, 62), event(1.2, 0.66, 64)];
    expect(countOverlappingEvents(legato)).toBeGreaterThan(0);
    expect(countSignificantOverlaps(legato)).toBe(0);
  });

  it('detects genuinely simultaneous notes', () => {
    const chord = [event(0, 1.4, 60), event(0.1, 1.4, 64), event(0.15, 1.4, 67)];
    expect(countSignificantOverlaps(chord)).toBe(3);
  });

  it('ignores a short overlap relative to the note length', () => {
    expect(countSignificantOverlaps([event(0, 2, 60), event(1.9, 2, 64)])).toBe(0);
  });
});
