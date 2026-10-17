/**
 * Shared score layout + pointer geometry
 * --------------------------------------
 * Coordinate model
 *
 * 1. **Score space** — SVG user units. VexFlow renders into it, note bounding
 *    boxes are reported in it, and the stave geometry (`Stave.getYForLine`) is
 *    expressed in it. This module only ever reasons in score space.
 *
 * 2. **Display space** — pixels on screen. The score SVG declares
 *    `viewBox="0 0 W H"` and is displayed at `width = W * zoom`, so the single
 *    source of scaling is the SVG viewBox. There is no CSS transform and no
 *    second `zoom` factor, which is why screen→score conversion must go through
 *    the SVG's own transformation matrix instead of dividing by `zoom`.
 *
 * 3. **Overlays** — HTML elements absolutely positioned inside a wrapper that is
 *    exactly `W * zoom` × `H * zoom`, so an overlay for score coordinate `c` is
 *    placed at `c * zoom`. Because the SVG viewBox scale is exactly `zoom`, the
 *    overlay and the notation always agree.
 */

export const MEASURES_PER_ROW = 2;
export const MEASURE_WIDTH = 380;
export const STAVE_HEIGHT = 170;
export const START_X = 40;
export const START_Y = 40;

/** VexFlow's default distance between adjacent staff lines, in score units. */
export const STAFF_LINE_SPACING = 10;
/** VexFlow's default `spaceAboveStaffLn`: the gap above line 0, in line units. */
export const SPACE_ABOVE_STAFF = 4;

export interface ScoreLayout {
  measuresPerRow: number;
  measureWidth: number;
  staveHeight: number;
  startX: number;
  startY: number;
}

export const DEFAULT_LAYOUT: ScoreLayout = {
  measuresPerRow: MEASURES_PER_ROW,
  measureWidth: MEASURE_WIDTH,
  staveHeight: STAVE_HEIGHT,
  startX: START_X,
  startY: START_Y,
};

export interface MeasureRect {
  index: number;
  row: number;
  col: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export function totalRows(measureCount: number, layout: ScoreLayout = DEFAULT_LAYOUT): number {
  return Math.ceil(Math.max(1, measureCount) / layout.measuresPerRow);
}

export function totalWidth(layout: ScoreLayout = DEFAULT_LAYOUT): number {
  return layout.startX * 2 + layout.measuresPerRow * layout.measureWidth;
}

export function totalHeight(measureCount: number, layout: ScoreLayout = DEFAULT_LAYOUT): number {
  return layout.startY + totalRows(measureCount, layout) * layout.staveHeight + 60;
}

export function getMeasureRect(index: number, layout: ScoreLayout = DEFAULT_LAYOUT): MeasureRect {
  const row = Math.floor(index / layout.measuresPerRow);
  const col = index % layout.measuresPerRow;
  return {
    index,
    row,
    col,
    x: layout.startX + col * layout.measureWidth,
    y: layout.startY + row * layout.staveHeight,
    width: layout.measureWidth,
    height: layout.staveHeight,
  };
}

export function getRowOf(index: number, layout: ScoreLayout = DEFAULT_LAYOUT): number {
  return Math.floor(index / layout.measuresPerRow);
}

/** Vertical band (top-most staff line) of a row, in score space. */
export function getRowTopLineY(row: number, layout: ScoreLayout = DEFAULT_LAYOUT): number {
  return layout.startY + row * layout.staveHeight + SPACE_ABOVE_STAFF * STAFF_LINE_SPACING;
}

/**
 * Which measure owns a score-space point, or -1.
 * Uses the row band so a click above/below a stave never leaks into a neighbour.
 */
export function getMeasureIndexAtPoint(
  x: number,
  y: number,
  measureCount: number,
  layout: ScoreLayout = DEFAULT_LAYOUT
): number {
  for (let i = 0; i < measureCount; i++) {
    const rect = getMeasureRect(i, layout);
    const top = rect.y - SPACE_ABOVE_STAFF * STAFF_LINE_SPACING - 10;
    const bottom = rect.y + layout.staveHeight - 20;
    if (x >= rect.x && x <= rect.x + rect.width && y >= top && y <= bottom) {
      return i;
    }
  }
  return -1;
}

/* -------------------------------------------------------------------------- */
/* Stave metrics + staff line mapping                                          */
/* -------------------------------------------------------------------------- */

export interface StaveMetrics {
  /** Y of the top staff line (line 0) in score space. */
  topLineY: number;
  /** Distance between adjacent staff lines in score space. */
  lineSpacing: number;
}

/**
 * Snap a score-space Y to the nearest staff position and return it as a VexFlow
 * line coordinate (0 = top line, 4 = bottom line, 0.5 = one diatonic step).
 */
export function yToStaffLine(y: number, metrics: StaveMetrics): number {
  const steps = (y - metrics.topLineY) / (metrics.lineSpacing / 2);
  return Math.round(steps) / 2;
}

/** Inverse of {@link yToStaffLine}: the score-space Y of a staff line coordinate. */
export function staffLineToY(line: number, metrics: StaveMetrics): number {
  return metrics.topLineY + line * metrics.lineSpacing;
}

/* -------------------------------------------------------------------------- */
/* Event hit testing                                                           */
/* -------------------------------------------------------------------------- */

export interface EventBox {
  id: string;
  /** Score-space bounding box of the rendered event, including modifiers. */
  x: number;
  y: number;
  width: number;
  height: number;
  /** Score-space x of the notehead/glyph centre, used for insertion ordering. */
  centerX: number;
  /** Score-space y of the notehead/glyph centre. */
  centerY: number;
}

export interface HitTestOptions {
  /**
   * Extra hit padding in *screen* pixels. Converted to score units by the caller
   * using the measured scale so the touch target stays constant on screen at
   * every zoom level.
   */
  slopScore: number;
  /** When several boxes contain the point, prefer these ids (e.g. the current row). */
  preferIds?: ReadonlySet<string>;
}

function expandedContains(box: EventBox, x: number, y: number, slop: number): boolean {
  return (
    x >= box.x - slop &&
    x <= box.x + box.width + slop &&
    y >= box.y - slop &&
    y <= box.y + box.height + slop
  );
}

/**
 * Nearest event under a score-space point. Ranks by preferred-row first and then
 * by centre distance, so overlapping boxes resolve deterministically instead of
 * by map insertion order.
 */
export function findEventAtPoint(
  x: number,
  y: number,
  boxes: readonly EventBox[],
  options: HitTestOptions
): string | null {
  let bestId: string | null = null;
  let bestRank = Infinity;
  let bestDistance = Infinity;

  for (const box of boxes) {
    if (!expandedContains(box, x, y, options.slopScore)) continue;

    const rank = options.preferIds?.has(box.id) ? 0 : 1;
    const distance = Math.hypot(x - box.centerX, y - box.centerY);

    if (rank < bestRank || (rank === bestRank && distance < bestDistance)) {
      bestRank = rank;
      bestDistance = distance;
      bestId = box.id;
    }
  }

  return bestId;
}

/**
 * Musical insertion position for a score-space x coordinate: the number of
 * existing events whose glyph centre lies to the left of the pointer.
 */
export function insertionIndexForX(x: number, boxes: readonly EventBox[]): number {
  return boxes.filter((box) => box.centerX < x).length;
}

/** True when a score-space x sits inside the usable note area of a measure. */
export function isInsideContentRegion(x: number, noteStartX: number, measureRight: number): boolean {
  return x >= noteStartX && x <= measureRight;
}
