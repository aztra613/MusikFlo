import { describe, expect, it } from 'vitest';
import {
  DIATONIC_STEPS,
  MAX_STAFF_LINE,
  MIN_STAFF_LINE,
  getLineFromPitch,
  getPitchFromLine,
  getStaffPitches,
  isValidStaffLine,
  shiftDiatonic,
  toVexflowKey,
} from './notationUtils';
import { Clef, NoteStep } from '../types/music';

/** Reference: treble lines bottom→top E4, G4, B4, D5, F5. */
const TREBLE_LINES: Array<[number, string]> = [
  [4, 'E4'],
  [3, 'G4'],
  [2, 'B4'],
  [1, 'D5'],
  [0, 'F5'],
];

/** Reference: bass lines bottom→top G2, B2, D3, F3, A3. */
const BASS_LINES: Array<[number, string]> = [
  [4, 'G2'],
  [3, 'B2'],
  [2, 'D3'],
  [1, 'F3'],
  [0, 'A3'],
];

function pitchLabel(line: number, clef: Clef): string {
  const p = getPitchFromLine(line, clef);
  return `${p.step.toUpperCase()}${p.octave}`;
}

describe('getPitchFromLine', () => {
  it.each(TREBLE_LINES)('treble line %i is %s', (line, label) => {
    expect(pitchLabel(line, 'treble')).toBe(label);
  });

  it.each(BASS_LINES)('bass line %i is %s', (line, label) => {
    expect(pitchLabel(line, 'bass')).toBe(label);
  });

  it('places middle C on the first ledger line below the treble staff', () => {
    const c4 = getPitchFromLine(5, 'treble');
    expect(c4.step).toBe('c');
    expect(c4.octave).toBe(4);
    expect(c4.isLedger).toBe(true);
    expect(c4.isLine).toBe(true);
    expect(c4.label).toBe('C4 · Middle C');
  });

  it('places middle C on the first ledger line above the bass staff', () => {
    const c4 = getPitchFromLine(-1, 'bass');
    expect(c4.step).toBe('c');
    expect(c4.octave).toBe(4);
    expect(c4.isLedger).toBe(true);
    expect(c4.isLine).toBe(true);
    expect(c4.label).toBe('C4 · Middle C');
  });

  it('labels the space between the treble ledger C4 and the bottom line as D4', () => {
    const d4 = getPitchFromLine(4.5, 'treble');
    expect(d4.step).toBe('d');
    expect(d4.octave).toBe(4);
    expect(d4.isLine).toBe(false);
    expect(d4.isLedger).toBe(true);
  });

  it('maps every treble staff space', () => {
    expect(pitchLabel(4.5, 'treble')).toBe('D4');
    expect(pitchLabel(3.5, 'treble')).toBe('F4');
    expect(pitchLabel(2.5, 'treble')).toBe('A4');
    expect(pitchLabel(1.5, 'treble')).toBe('C5');
    expect(pitchLabel(0.5, 'treble')).toBe('E5');
  });

  it('maps every bass staff space', () => {
    expect(pitchLabel(4.5, 'bass')).toBe('F2');
    expect(pitchLabel(3.5, 'bass')).toBe('A2');
    expect(pitchLabel(2.5, 'bass')).toBe('C3');
    expect(pitchLabel(1.5, 'bass')).toBe('E3');
    expect(pitchLabel(0.5, 'bass')).toBe('G3');
  });

  it('walks one octave per seven diatonic steps in both clefs', () => {
    for (const clef of ['treble', 'bass'] as Clef[]) {
      for (let line = 4; line >= -2; line -= 0.5) {
        const low = getPitchFromLine(line, clef);
        const high = getPitchFromLine(line - 3.5, clef);
        const gap = (high.octave - low.octave) * 7 + DIATONIC_STEPS.indexOf(high.step) - DIATONIC_STEPS.indexOf(low.step);
        expect(gap).toBe(7);
      }
    }
  });

  it('reports positionIndex counted up from the bottom staff line', () => {
    expect(getPitchFromLine(4, 'treble').positionIndex).toBe(0);
    expect(getPitchFromLine(0, 'treble').positionIndex).toBe(8);
    expect(getPitchFromLine(4, 'bass').positionIndex).toBe(0);
    expect(getPitchFromLine(0, 'bass').positionIndex).toBe(8);
  });
});

describe('getLineFromPitch', () => {
  it('is the exact inverse of getPitchFromLine for every reference pitch', () => {
    const pitches: Array<[NoteStep, number]> = [
      ['c', 4],
      ['e', 4],
      ['g', 4],
      ['b', 4],
      ['d', 5],
      ['f', 5],
      ['a', 5],
      ['c', 6],
      ['g', 2],
      ['b', 2],
      ['d', 3],
    ];

    for (const clef of ['treble', 'bass'] as Clef[]) {
      for (const [step, octave] of pitches) {
        const line = getLineFromPitch(step, octave, clef);
        const roundTrip = getPitchFromLine(line, clef);
        expect([roundTrip.step, roundTrip.octave]).toEqual([step, octave]);
      }
    }
  });

  it('round-trips every staff position including ledger positions', () => {
    for (const clef of ['treble', 'bass'] as Clef[]) {
      for (let line = MIN_STAFF_LINE; line <= MAX_STAFF_LINE; line += 0.5) {
        const pitch = getPitchFromLine(line, clef);
        expect(getLineFromPitch(pitch.step, pitch.octave, clef)).toBe(line);
      }
    }
  });
});

describe('isValidStaffLine', () => {
  it('accepts the documented range and rejects far-outside positions', () => {
    expect(isValidStaffLine(MIN_STAFF_LINE)).toBe(true);
    expect(isValidStaffLine(MAX_STAFF_LINE)).toBe(true);
    expect(isValidStaffLine(0)).toBe(true);
    expect(isValidStaffLine(MIN_STAFF_LINE - 0.5)).toBe(false);
    expect(isValidStaffLine(MAX_STAFF_LINE + 5)).toBe(false);
    expect(isValidStaffLine(Number.NaN)).toBe(false);
  });
});

describe('getStaffPitches', () => {
  it('returns ascending positions from the lowest ledger line to the highest', () => {
    const positions = getStaffPitches('treble');
    expect(positions[0].line).toBe(MAX_STAFF_LINE);
    expect(positions[positions.length - 1].line).toBe(MIN_STAFF_LINE);
  });

  it('agrees with getPitchFromLine for every entry', () => {
    for (const clef of ['treble', 'bass'] as Clef[]) {
      for (const entry of getStaffPitches(clef)) {
        expect(entry).toMatchObject(getPitchFromLine(entry.line, clef));
      }
    }
  });
});

describe('shiftDiatonic', () => {
  it('moves between adjacent steps and octaves', () => {
    expect(shiftDiatonic('c', 4, 1)).toEqual({ step: 'd', octave: 4 });
    expect(shiftDiatonic('b', 4, 1)).toEqual({ step: 'c', octave: 5 });
    expect(shiftDiatonic('c', 4, -1)).toEqual({ step: 'b', octave: 3 });
  });

  it('clamps to a safe musical range', () => {
    expect(shiftDiatonic('c', 1, -40)).toEqual({ step: 'c', octave: 1 });
    expect(shiftDiatonic('b', 6, 40)).toEqual({ step: 'b', octave: 6 });
  });
});

describe('toVexflowKey', () => {
  it('ignores pitch for rests so they land at the standard rest position', () => {
    expect(toVexflowKey({ id: 'x', step: 'c', octave: 4, duration: '4', isRest: true })).toBe('b/4');
    expect(toVexflowKey({ id: 'y', step: 'f', octave: 5, duration: '4' })).toBe('f/5');
  });
});
