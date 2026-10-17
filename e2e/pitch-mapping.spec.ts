import { expect, test } from '@playwright/test';
import { openStudio, placeNote, selectedNotePoint, staffPoint, totalEvents, waitForSavedScore } from './helpers';
import { getMeasureRect } from '../src/score/geometry';

/**
 * Pitch mapping is the invariant the reported "pitch drifts as rows are added"
 * bug violated. Every case here reads the pitch back out of the persisted
 * score, so a wrong pitch cannot pass by looking plausible.
 */
test.describe('pitch mapping', () => {
  test.beforeEach(async ({ page }) => {
    await openStudio(page);
  });

  test('treble staff lines and adjacent spaces map to the textbook pitches', async ({ page }) => {
    const cases: Array<{ line: number; step: string; octave: number }> = [
      { line: 4, step: 'e', octave: 4 }, // bottom line
      { line: 3.5, step: 'f', octave: 4 }, // space above it
      { line: 3, step: 'g', octave: 4 },
      { line: 2, step: 'b', octave: 4 }, // middle line
      { line: 0, step: 'f', octave: 5 }, // top line
    ];

    // One bar per case keeps every placement independent within one session.
    for (let i = 0; i < cases.length - 2; i++) {
      await page.getByRole('button', { name: 'Add Bar' }).click();
    }

    for (const [index, expected] of cases.entries()) {
      await page.getByRole('button', { name: 'Note', exact: true }).click();
      const point = await staffPoint(page, { measureIndex: index, line: expected.line, xWithinMeasure: 150 });
      await page.mouse.click(point.x, point.y);
      await waitForSavedScore(page, (s) => s.measures[index]?.events.length === 1);
    }

    const score = await waitForSavedScore(page, (s) => s.measures.slice(0, 5).every((m) => m.events.length === 1));
    expect(score.measures.slice(0, 5).map((m) => `${m.events[0].step}${m.events[0].octave}`)).toEqual([
      'e4',
      'f4',
      'g4',
      'b4',
      'f5',
    ]);
  });

  test('middle C is placed on the first ledger line below the treble staff and labelled as such', async ({ page }) => {
    await page.getByRole('button', { name: 'Note', exact: true }).click();

    // C4 is one full line spacing below the bottom staff line, i.e. line 5.
    const ledger = await staffPoint(page, { measureIndex: 0, line: 5, xWithinMeasure: 150 });
    await page.mouse.move(ledger.x, ledger.y);

    // The preview must name the pitch before it is placed.
    await expect(page.getByText('C4 · Middle C')).toBeVisible();

    await page.mouse.click(ledger.x, ledger.y);
    const score = await waitForSavedScore(page, (s) => totalEvents(s) === 1);
    expect(score.measures[0].events[0]).toMatchObject({ step: 'c', octave: 4 });
  });

  test('middle C in bass clef is placed above the staff, not below it', async ({ page }) => {
    await page.locator('#clef-select').selectOption('bass');
    await expect(page.getByRole('main').getByText('Bass Clef')).toBeVisible();

    await page.getByRole('button', { name: 'Note', exact: true }).click();

    // In bass clef the top line is A3, so C4 is the ledger line just above it (line -1).
    const above = await staffPoint(page, { measureIndex: 0, line: -1, xWithinMeasure: 150 });
    await page.mouse.move(above.x, above.y);
    await expect(page.getByText('C4 · Middle C')).toBeVisible();
    await page.mouse.click(above.x, above.y);

    const score = await waitForSavedScore(page, (s) => totalEvents(s) === 1);
    expect(score.measures[0].events[0]).toMatchObject({ step: 'c', octave: 4 });

    // The bass staff bottom line G2 is a different pitch in a lower octave.
    const bottom = await staffPoint(page, { measureIndex: 1, line: 4, xWithinMeasure: 150 });
    await page.mouse.click(bottom.x, bottom.y);
    const withSecond = await waitForSavedScore(page, (s) => totalEvents(s) === 2);
    expect(withSecond.measures[1].events[0]).toMatchObject({ step: 'g', octave: 2 });
  });

  test('the same relative staff position maps to the same pitch on every row', async ({ page }) => {
    // Four bars fill two rows; adding more bars produces a third row. The
    // reported bug was that a position meaning E4 on row 1 became a different
    // pitch further down the score.
    for (let i = 0; i < 4; i++) {
      await page.getByRole('button', { name: 'Add Bar' }).click();
    }

    const measured: Array<{ row: number; pitch: string }> = [];

    for (const measureIndex of [0, 2, 4]) {
      const row = getMeasureRect(measureIndex).row;

      await page.getByRole('button', { name: 'Note', exact: true }).click();
      const point = await staffPoint(page, { measureIndex, line: 4, xWithinMeasure: 150 });
      await page.mouse.click(point.x, point.y);

      const saved = await waitForSavedScore(page, (s) => s.measures[measureIndex]?.events.length === 1);
      const event = saved.measures[measureIndex].events[0];
      measured.push({ row, pitch: `${event.step}${event.octave}` });
    }

    // Every row must agree, and all of them must be the treble bottom line E4.
    expect(measured.map((m) => m.pitch)).toEqual(['e4', 'e4', 'e4']);
    expect(new Set(measured.map((m) => m.row)).size).toBe(3);
  });

  test('placement and selection still work at minimum and maximum zoom', async ({ page }) => {
    // Measure 0 exercises the minimum zoom, measure 1 the maximum. Zoom level is
    // read back from the toolbar so the assertion cannot pass at the wrong zoom.
    for (const [index, direction, bound] of [
      [0, 'Zoom out', '70%'],
      [1, 'Zoom in', '150%'],
    ] as const) {
      await page.getByRole('button', { name: 'Reset zoom' }).click();
      for (let i = 0; i < 8; i++) {
        await page.getByRole('button', { name: direction }).click();
      }
      await expect(page.getByRole('main').getByText(bound)).toBeVisible();

      await page.getByRole('button', { name: 'Note', exact: true }).click();
      const target = await staffPoint(page, { measureIndex: index, line: 3, xWithinMeasure: 160 });
      await page.mouse.click(target.x, target.y);

      const saved = await waitForSavedScore(page, (s) => s.measures[index]?.events.length === 1);
      expect(saved.measures[index].events[0], `${direction} placement`).toMatchObject({ step: 'g', octave: 4 });

      // Selecting the same note must still work at that zoom level.
      await page.getByRole('button', { name: 'Select', exact: true }).click();
      const note = await selectedNotePoint(page);
      await page.mouse.click(note.x, note.y);
      await expect(page.locator('[data-note-id]')).toHaveCount(1);
      await expect(page.getByText(/^Selected:/)).toBeVisible();
    }
  });

  test('placement and selection survive a viewport resize', async ({ page }) => {
    await page.setViewportSize({ width: 900, height: 700 });
    await placeNote(page, { measureIndex: 0, line: 2, xWithinMeasure: 160 });
    await waitForSavedScore(page, (s) => totalEvents(s) === 1);

    await page.setViewportSize({ width: 1500, height: 900 });
    await expect(page.locator('#score-svg-target svg')).toBeVisible();

    // The rendered geometry moved, so re-read the note's position after resizing.
    const afterResize = await selectedNotePoint(page);

    await page.getByRole('button', { name: 'Select', exact: true }).click();
    await page.mouse.click(afterResize.x, afterResize.y);
    await expect(page.locator('[data-note-id]')).toHaveCount(1);

    // And a fresh placement still maps to the expected pitch.
    await page.getByRole('button', { name: 'Note', exact: true }).click();
    const second = await staffPoint(page, { measureIndex: 1, line: 4, xWithinMeasure: 160 });
    await page.mouse.click(second.x, second.y);
    const score = await waitForSavedScore(page, (s) => totalEvents(s) === 2);
    expect(score.measures[1].events[0]).toMatchObject({ step: 'e', octave: 4 });
  });
});
