import { expect, Page } from '@playwright/test';
import { DEFAULT_LAYOUT, STAFF_LINE_SPACING, getMeasureRect, getRowTopLineY } from '../src/score/geometry';
import { Score } from '../src/types/music';

/**
 * Reads the score back out of IndexedDB.
 *
 * The studio autosaves the real editor state to `musikflo_db`, so reading that
 * database verifies the persistence layer and the editor state at the same
 * time, without adding test-only markup to the application.
 */
export async function readSavedScore(page: Page): Promise<Score | null> {
  return page.evaluate(async () => {
    const open = () =>
      new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open('musikflo_db', 1);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });

    const db = await open();
    try {
      const latestId = await new Promise<string | null>((resolve) => {
        const tx = db.transaction('metadata', 'readonly');
        const req = tx.objectStore('metadata').get('latest_draft_id');
        req.onsuccess = () => resolve(req.result ? req.result.value : null);
        req.onerror = () => resolve(null);
      });
      if (!latestId) return null;

      return await new Promise<Score | null>((resolve) => {
        const tx = db.transaction('scores', 'readonly');
        const req = tx.objectStore('scores').get(latestId);
        req.onsuccess = () => resolve(req.result ?? null);
        req.onerror = () => resolve(null);
      });
    } finally {
      db.close();
    }
  });
}

/** Wait for the debounced autosave to persist a score matching `predicate`. */
export async function waitForSavedScore(page: Page, predicate: (score: Score) => boolean, timeoutMs = 8000) {
  const started = Date.now();
  let last: Score | null = null;

  while (Date.now() - started < timeoutMs) {
    last = await readSavedScore(page);
    if (last && predicate(last)) return last;
    await page.waitForTimeout(150);
  }

  throw new Error(`Saved score never matched. Last value: ${JSON.stringify(last)?.slice(0, 600)}`);
}

export function totalEvents(score: Score): number {
  return score.measures.reduce((sum, measure) => sum + measure.events.length, 0);
}

/**
 * Screen coordinates of a staff position inside a measure.
 *
 * The score viewport scrolls (long scores must stay readable), so the target is
 * scrolled into view first and the coordinates are read back afterwards. Without
 * this, clicks aimed at a lower system or at an off-screen bar silently land on
 * whatever happens to be at those screen coordinates.
 */
export async function staffPoint(
  page: Page,
  options: { measureIndex: number; line: number; xWithinMeasure: number }
) {
  const rect = getMeasureRect(options.measureIndex, DEFAULT_LAYOUT);
  const scoreX = rect.x + options.xWithinMeasure;
  const scoreY = getRowTopLineY(rect.row, DEFAULT_LAYOUT) + options.line * STAFF_LINE_SPACING;

  await page.evaluate(
    ({ sx, sy }) => {
      const svg = document.querySelector('#score-svg-target svg');
      const holder = svg?.parentElement as HTMLElement | null;
      const scroller = svg?.closest('.overflow-auto') as HTMLElement | null;
      if (!svg || !holder || !scroller) return;

      const viewBoxWidth = (svg as SVGSVGElement).viewBox?.baseVal?.width || svg.clientWidth;
      const scale = svg.getBoundingClientRect().width / viewBoxWidth;

      // Offsets are measured from the scroller's content origin, which includes
      // the wrapper padding, so scroll positions stay aligned with the score.
      const targetX = holder.offsetLeft + sx * scale;
      const targetY = holder.offsetTop + sy * scale;
      const margin = 24;

      // Only scroll when the target is actually outside the visible area: moving
      // the view unnecessarily invalidates coordinates the test already captured.
      if (targetX < scroller.scrollLeft + margin || targetX > scroller.scrollLeft + scroller.clientWidth - margin) {
        scroller.scrollLeft = Math.max(0, targetX - scroller.clientWidth / 2);
      }
      if (targetY < scroller.scrollTop + margin || targetY > scroller.scrollTop + scroller.clientHeight - margin) {
        scroller.scrollTop = Math.max(0, targetY - scroller.clientHeight / 2);
      }
    },
    { sx: scoreX, sy: scoreY }
  );

  const svg = page.locator('#score-svg-target svg');
  const box = await svg.boundingBox();
  if (!box) throw new Error('The score SVG has not been rendered');

  const viewBoxWidth = await svg.evaluate((element) => (element as SVGSVGElement).viewBox.baseVal.width);
  const scale = box.width / viewBoxWidth;
  const point = { x: box.x + scoreX * scale, y: box.y + scoreY * scale };

  const viewport = await page.viewportSize();
  if (point.y < 0 || point.y > (viewport?.height ?? 0)) {
    throw new Error(`Target staff position is outside the window: y=${point.y}`);
  }

  return point;
}

/**
 * Screen coordinates of the currently selected event, taken from the rendered
 * selection outline. Engraving justifies notes across the bar, so a note does
 * not necessarily sit where it was clicked; this reads where it actually landed.
 */
export async function selectedNotePoint(page: Page) {
  const outline = page.locator('[data-note-id]').first();
  await expect(outline).toBeVisible();
  const box = await outline.boundingBox();
  if (!box) throw new Error('The selected event has no rendered box');
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/** Place a single note with the note tool and return its real screen position. */
export async function placeNote(page: Page, options: { measureIndex: number; line: number; xWithinMeasure: number }) {
  await page.getByRole('button', { name: 'Note', exact: true }).click();
  const point = await staffPoint(page, options);
  await page.mouse.click(point.x, point.y);
  return selectedNotePoint(page);
}

/** Open the studio on a clean slate with a deterministic blank two-bar score. */
export async function openStudio(page: Page) {
  await page.addInitScript(() => {
    // Start from a blank score instead of whatever draft survived a prior test.
    indexedDB.deleteDatabase('musikflo_db');
    localStorage.clear();
  });

  await page.goto('/#studio');
  await expect(page.locator('#score-svg-target svg')).toBeVisible();
  // The canvas toolbar only renders once the studio has a score in state.
  await expect(page.getByRole('main').getByText('Treble Clef')).toBeVisible();
}

/** Relative luminance of an `rgb()` string, per WCAG. */
export function luminance(color: string): number {
  const [r, g, b] = color
    .replace(/rgba?\(|\)/g, '')
    .split(',')
    .slice(0, 3)
    .map((part) => Number(part.trim()) / 255)
    .map((channel) => (channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
}
