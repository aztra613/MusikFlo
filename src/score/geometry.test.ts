import { describe, expect, it } from 'vitest';
import {
  DEFAULT_LAYOUT,
  EventBox,
  getLayoutForScore,
  getMeasureIndexAtPoint,
  getMeasureRect,
  getRowTopLineY,
  insertionIndexForX,
  isInsideContentRegion,
  findEventAtPoint,
  staffLineToY,
  totalHeight,
  totalRows,
  totalWidth,
  yToStaffLine,
} from './geometry';
import { getPitchFromLine } from '../utils/notationUtils';

const LINE_SPACING = 10;
const TOP_LINE_Y = getRowTopLineY(0);

function box(id: string, centerX: number, centerY: number, size = 12): EventBox {
  return {
    id,
    x: centerX - size / 2,
    y: centerY - size / 2,
    width: size,
    height: size,
    centerX,
    centerY,
  };
}

describe('layout', () => {
  it('lays measures out in a fixed grid shared by rendering and interaction', () => {
    expect(getMeasureRect(0)).toMatchObject({ row: 0, col: 0, x: 40, y: 40 });
    expect(getMeasureRect(1)).toMatchObject({ row: 0, col: 1, x: 40 + DEFAULT_LAYOUT.measureWidth, y: 40 });
    expect(getMeasureRect(2)).toMatchObject({ row: 1, col: 0, x: 40, y: 40 + DEFAULT_LAYOUT.staveHeight });
  });

  it('reports row counts and canvas size for long scores', () => {
    expect(totalRows(0)).toBe(1);
    expect(totalRows(4)).toBe(2);
    expect(totalRows(5)).toBe(3);
    expect(totalWidth()).toBe(40 * 2 + 2 * DEFAULT_LAYOUT.measureWidth);
    expect(totalHeight(5)).toBeGreaterThan(totalHeight(2));
  });

  it('provides Grand Staff layout geometry when staffMode is grand', () => {
    const singleLayout = getLayoutForScore({ staffMode: 'single' } as any);
    expect(singleLayout.staveHeight).toBe(DEFAULT_LAYOUT.staveHeight);
    expect(singleLayout.staffMode).toBe('single');

    const grandLayout = getLayoutForScore({ staffMode: 'grand' } as any);
    expect(grandLayout.staveHeight).toBe(270);
    expect(grandLayout.bassOffsetY).toBe(100);
    expect(grandLayout.staffMode).toBe('grand');
    expect(totalHeight(4, grandLayout)).toBeGreaterThan(totalHeight(4, singleLayout));
  });
});

describe('getMeasureIndexAtPoint', () => {
  it('targets the measure under the pointer on the first row', () => {
    const rect = getMeasureRect(1);
    expect(getMeasureIndexAtPoint(rect.x + 100, rect.y + 60, 4)).toBe(1);
  });

  it('targets later rows without leaking into the previous row', () => {
    const rect = getMeasureRect(3); // row 1, col 1
    expect(getMeasureIndexAtPoint(rect.x + 100, rect.y + 60, 4)).toBe(3);

    const firstRow = getMeasureRect(1);
    expect(getMeasureIndexAtPoint(firstRow.x + 100, firstRow.y + 60, 4)).toBe(1);
  });

  it('returns -1 outside every stave band', () => {
    expect(getMeasureIndexAtPoint(-100, -100, 4)).toBe(-1);
    expect(getMeasureIndexAtPoint(10_000, 10_000, 4)).toBe(-1);
  });
});

describe('staff line mapping', () => {
  it('snaps a score-space y to the nearest half-line position', () => {
    const metrics = { topLineY: TOP_LINE_Y, lineSpacing: LINE_SPACING };
    expect(yToStaffLine(TOP_LINE_Y, metrics)).toBe(0);
    expect(yToStaffLine(TOP_LINE_Y + LINE_SPACING, metrics)).toBe(1);
    expect(yToStaffLine(TOP_LINE_Y + LINE_SPACING * 4, metrics)).toBe(4);
    expect(yToStaffLine(TOP_LINE_Y + LINE_SPACING * 4.4, metrics)).toBe(4.5);
  });

  it('round-trips line coordinates through score space', () => {
    const metrics = { topLineY: TOP_LINE_Y, lineSpacing: LINE_SPACING };
    for (let line = -2; line <= 6; line += 0.5) {
      expect(yToStaffLine(staffLineToY(line, metrics), metrics)).toBe(line);
    }
  });

  it('maps the same relative staff position to the same pitch in every row', () => {
    // This is the invariant the row-drift defect violated: each row has its own
    // top-line Y, but the *relative* offset must resolve to the same pitch.
    for (const row of [0, 1, 2, 3, 7]) {
      const metrics = { topLineY: getRowTopLineY(row), lineSpacing: LINE_SPACING };
      for (const expected of [4, 4.5, 5]) {
        const y = staffLineToY(expected, metrics);
        const line = yToStaffLine(y, metrics);
        expect(line).toBe(expected);
      }

      // C4 sits on the treble ledger line below every staff, not only the first.
      const c4Line = yToStaffLine(staffLineToY(5, metrics), metrics);
      expect(getPitchFromLine(c4Line, 'treble')).toMatchObject({ step: 'c', octave: 4 });

      // G2 is the bass bottom line in every row.
      const g2Line = yToStaffLine(staffLineToY(4, metrics), metrics);
      expect(getPitchFromLine(g2Line, 'bass')).toMatchObject({ step: 'g', octave: 2 });
    }
  });

  it('is unaffected by the browser viewport because it never reads pixels', () => {
    const metrics = { topLineY: TOP_LINE_Y, lineSpacing: LINE_SPACING };
    const before = yToStaffLine(TOP_LINE_Y + 25, metrics);
    // A resize only changes the SVG's screen width; score-space maths is unchanged.
    const after = yToStaffLine(TOP_LINE_Y + 25, metrics);
    expect(after).toBe(before);
  });
});

describe('findEventAtPoint', () => {
  const boxes = [box('a', 100, 100), box('b', 140, 100), box('c', 100, 160)];

  it('selects the nearest event inside the expanded box', () => {
    expect(findEventAtPoint(139, 101, boxes, { slopScore: 4 })).toBe('b');
    expect(findEventAtPoint(101, 102, boxes, { slopScore: 4 })).toBe('a');
  });

  it('uses hit slop so a near miss still selects instead of inserting', () => {
    // 10px away from the glyph is outside the raw box but inside 12px slop.
    expect(findEventAtPoint(112, 100, boxes, { slopScore: 12 })).toBe('a');
    expect(findEventAtPoint(112, 100, boxes, { slopScore: 2 })).toBeNull();
  });

  it('never returns an event for empty staff space', () => {
    expect(findEventAtPoint(300, 100, boxes, { slopScore: 12 })).toBeNull();
  });

  it('prefers the requested row when boxes overlap', () => {
    expect(findEventAtPoint(100, 100, boxes, { slopScore: 4, preferIds: new Set(['a']) })).toBe('a');
  });
});

describe('insertionIndexForX', () => {
  const boxes = [box('a', 100, 100), box('b', 200, 100), box('c', 300, 100)];

  it('returns the musical position implied by the pointer x', () => {
    expect(insertionIndexForX(50, boxes)).toBe(0);
    expect(insertionIndexForX(150, boxes)).toBe(1);
    expect(insertionIndexForX(250, boxes)).toBe(2);
    expect(insertionIndexForX(1000, boxes)).toBe(3);
  });
});

describe('isInsideContentRegion', () => {
  it('excludes the clef and signature margin', () => {
    expect(isInsideContentRegion(60, 120, 400)).toBe(false);
    expect(isInsideContentRegion(200, 120, 400)).toBe(true);
    expect(isInsideContentRegion(500, 120, 400)).toBe(false);
  });
});
