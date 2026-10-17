import { Clef, NoteStep, ScoreNote } from '../types/music';

export const DIATONIC_STEPS: NoteStep[] = ['c', 'd', 'e', 'f', 'g', 'a', 'b'];

/**
 * Staff line coordinate model
 * ---------------------------
 * Every function in this module works in VexFlow's *stave line* coordinate space,
 * which is the same space accepted by `Stave.getYForLine(line)`:
 *
 *   line 0   = top staff line        (F5 in treble, A3 in bass)
 *   line 1   = second line from top  (D5 in treble, F3 in bass)
 *   line 4   = bottom staff line     (E4 in treble, G2 in bass)
 *   line 0.5 = space just under the top line
 *   line 5   = first ledger line below the staff (C4 in treble)
 *   line -1  = first ledger line above the staff (C4 in bass)
 *
 * One unit of `line` spans two diatonic steps, so one staff line to the next is
 * +1 and one line-or-space step is +0.5. Because `Stave.getYForLine(line)` is
 * linear, fractional values (spaces) are valid and the pointer preview lands on
 * exactly the same pixel VexFlow uses for the committed note.
 */
export interface PitchAtLine {
  step: NoteStep;
  octave: number;
  isLine: boolean;
  isLedger: boolean;
  label: string;
  /** Diatonic steps above the bottom staff line; bottom line = 0, first space above = 1. */
  positionIndex: number;
}

export interface StaffPitchInfo extends PitchAtLine {
  /** The VexFlow stave line coordinate for this staff position. */
  line: number;
  description: string;
}

/** Inclusive line range that remains musically sensible for placement/preview. */
export const MIN_STAFF_LINE = -3;
export const MAX_STAFF_LINE = 7;

const TOP_LINE_PITCH: Record<Clef, { step: NoteStep; octave: number }> = {
  // Top staff line of each clef.
  treble: { step: 'f', octave: 5 },
  bass: { step: 'a', octave: 3 },
};

function toDiatonicTotal(step: NoteStep, octave: number): number {
  return octave * 7 + DIATONIC_STEPS.indexOf(step);
}

function fromDiatonicTotal(total: number): { step: NoteStep; octave: number } {
  const octave = Math.floor(total / 7);
  const step = DIATONIC_STEPS[((total % 7) + 7) % 7];
  return { step, octave };
}

/** Diatonic total of the clef's top staff line (line 0). */
export function topLineTotal(clef: Clef): number {
  const p = TOP_LINE_PITCH[clef];
  return toDiatonicTotal(p.step, p.octave);
}

function describePosition(line: number): string {
  if (line < 0) return 'Ledger position above the staff';
  if (line > 4) return 'Ledger position below the staff';
  if (Number.isInteger(line)) return `Staff line ${5 - line} from the bottom`;
  return 'Staff space';
}

/** Convert a VexFlow stave line coordinate into a concrete pitch. */
export function getPitchFromLine(line: number, clef: Clef): PitchAtLine {
  const total = topLineTotal(clef) - Math.round(line * 2);
  const { step, octave } = fromDiatonicTotal(total);
  const isLine = Math.abs(line - Math.round(line)) < 1e-9;
  const isLedger = line < 0 || line > 4;
  const isMiddleC = step === 'c' && octave === 4;

  return {
    step,
    octave,
    isLine,
    isLedger,
    label: `${step.toUpperCase()}${octave}${isMiddleC ? ' · Middle C' : ''}`,
    positionIndex: Math.round((4 - line) * 2),
  };
}

/** Inverse of {@link getPitchFromLine}. */
export function getLineFromPitch(step: NoteStep, octave: number, clef: Clef): number {
  return (topLineTotal(clef) - toDiatonicTotal(step, octave)) / 2;
}

/** Every staff position between `MIN_STAFF_LINE` and `MAX_STAFF_LINE`, low to high. */
export function getStaffPitches(clef: Clef): StaffPitchInfo[] {
  const positions: StaffPitchInfo[] = [];
  for (let line = MAX_STAFF_LINE; line >= MIN_STAFF_LINE; line -= 0.5) {
    positions.push({
      ...getPitchFromLine(line, clef),
      line,
      description: describePosition(line),
    });
  }
  return positions;
}

/** True when the line coordinate is a valid placement/preview position. */
export function isValidStaffLine(line: number): boolean {
  return Number.isFinite(line) && line >= MIN_STAFF_LINE && line <= MAX_STAFF_LINE;
}

/**
 * Transpose a note step diatonically up (+1) or down (-1), clamped to C1–C7.
 */
export function shiftDiatonic(step: NoteStep, octave: number, delta: number): { step: NoteStep; octave: number } {
  const curIndex = DIATONIC_STEPS.indexOf(step);
  let totalSteps = octave * 7 + curIndex + delta;

  // Bound to a safe musical range (C1 to C7)
  totalSteps = Math.max(7, Math.min(48, totalSteps));

  return fromDiatonicTotal(totalSteps);
}

/**
 * Convert a ScoreNote to VexFlow key format: e.g. "c/4" or "f#/5".
 */
export function toVexflowKey(note: ScoreNote): string {
  if (note.isRest) {
    return 'b/4'; // Standard rest placement
  }
  return `${note.step}/${note.octave}`;
}
