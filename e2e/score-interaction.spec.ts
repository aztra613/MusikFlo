import { expect, test } from '@playwright/test';
import { openStudio, placeNote, selectedNotePoint, staffPoint, totalEvents, waitForSavedScore } from './helpers';

/**
 * Browser-level verification of the pointer/tool contracts. These are the
 * scenarios a TypeScript compile cannot prove: which event a click selects,
 * whether a click inserts, and whether deletion removes exactly one event.
 */
test.describe('score editor tools', () => {
  test.beforeEach(async ({ page }) => {
    await openStudio(page);
  });

  test('note tool places exactly one note on empty staff', async ({ page }) => {
    await page.getByRole('button', { name: 'Note', exact: true }).click();

    const point = await staffPoint(page, { measureIndex: 0, line: 4, xWithinMeasure: 150 });
    await page.mouse.click(point.x, point.y);

    const score = await waitForSavedScore(page, (s) => totalEvents(s) === 1);
    expect(score.measures[0].events).toHaveLength(1);
    expect(score.measures[0].events[0].isRest).toBeFalsy();
    // Vertical position is exact: clicking the bottom line of a treble staff is E4.
    expect(score.measures[0].events[0]).toMatchObject({ step: 'e', octave: 4 });
  });

  test('clicking an existing note with the note tool selects it instead of duplicating', async ({ page }) => {
    const note = await placeNote(page, { measureIndex: 0, line: 4, xWithinMeasure: 150 });
    await waitForSavedScore(page, (s) => totalEvents(s) === 1);

    // Click the note where it actually rendered: this must select, not add a note.
    await page.mouse.click(note.x, note.y);
    await expect(page.getByText(/^Selected:/)).toBeVisible();

    await page.waitForTimeout(1200); // longer than the autosave debounce
    const score = await waitForSavedScore(page, (s) => totalEvents(s) === 1);
    expect(totalEvents(score)).toBe(1);
  });

  test('select tool never inserts a note, even on empty staff', async ({ page }) => {
    await page.getByRole('button', { name: 'Select', exact: true }).click();

    const point = await staffPoint(page, { measureIndex: 0, line: 2, xWithinMeasure: 200 });
    await page.mouse.click(point.x, point.y);
    await page.waitForTimeout(1200);

    const score = await waitForSavedScore(page, (s) => typeof s.id === 'string');
    expect(totalEvents(score)).toBe(0);
  });

  test('select tool selects a note and clicking empty space clears the selection', async ({ page }) => {
    const note = await placeNote(page, { measureIndex: 0, line: 4, xWithinMeasure: 140 });
    await waitForSavedScore(page, (s) => totalEvents(s) === 1);

    await page.getByRole('button', { name: 'Select', exact: true }).click();
    await page.mouse.click(note.x, note.y);
    await expect(page.getByText(/^Selected:/)).toBeVisible();

    const empty = await staffPoint(page, { measureIndex: 1, line: 1, xWithinMeasure: 200 });
    await page.mouse.click(empty.x, empty.y);
    await expect(page.locator('[data-note-id]')).toHaveCount(0);
    await expect(page.getByText(/^Selected:/)).toHaveCount(0);
  });

  test('rest tool inserts exactly one rest and no sounding note', async ({ page }) => {
    await page.getByRole('button', { name: 'Rest', exact: true }).click();

    const point = await staffPoint(page, { measureIndex: 0, line: 2, xWithinMeasure: 160 });
    await page.mouse.click(point.x, point.y);

    const score = await waitForSavedScore(page, (s) => totalEvents(s) === 1);
    expect(score.measures[0].events[0].isRest).toBe(true);
  });

  test('eraser deletes the clicked event and does nothing on empty staff', async ({ page }) => {
    await placeNote(page, { measureIndex: 0, line: 4, xWithinMeasure: 150 });
    await waitForSavedScore(page, (s) => totalEvents(s) === 1);

    await page.getByRole('button', { name: 'Erase', exact: true }).click();

    // Empty staff with the eraser must not insert anything.
    const empty = await staffPoint(page, { measureIndex: 1, line: 2, xWithinMeasure: 200 });
    await page.mouse.click(empty.x, empty.y);
    await page.waitForTimeout(1000);
    expect(totalEvents(await waitForSavedScore(page, (s) => totalEvents(s) === 1))).toBe(1);

    // Clicking the note itself deletes exactly that event. Its position is read
    // now rather than earlier, because the selection outline reports where the
    // note is currently rendered.
    const note = await selectedNotePoint(page);
    await page.mouse.click(note.x, note.y);
    await waitForSavedScore(page, (s) => totalEvents(s) === 0);
  });

  test('a selected note can be deleted with the visible action and with the keyboard', async ({ page }) => {
    // Visible delete action: the canvas popover and the inspector both expose it.
    await placeNote(page, { measureIndex: 0, line: 4, xWithinMeasure: 150 });
    await waitForSavedScore(page, (s) => totalEvents(s) === 1);
    await expect(page.getByRole('button', { name: /Delete note/ })).toHaveCount(2);
    await page.getByRole('button', { name: /Delete note/ }).first().click();
    await waitForSavedScore(page, (s) => totalEvents(s) === 0);

    // Keyboard delete. Selection is restored by clicking the note on the canvas,
    // which leaves focus on the document rather than on a toolbar button.
    const note = await placeNote(page, { measureIndex: 1, line: 2, xWithinMeasure: 150 });
    await waitForSavedScore(page, (s) => totalEvents(s) === 1);
    await page.getByRole('button', { name: 'Select', exact: true }).click();
    await page.mouse.click(note.x, note.y);
    await expect(page.getByText(/^Selected:/)).toBeVisible();

    await page.keyboard.press('Delete');
    await waitForSavedScore(page, (s) => totalEvents(s) === 0);

    // Backspace must work too.
    await placeNote(page, { measureIndex: 0, line: 3, xWithinMeasure: 120 });
    await waitForSavedScore(page, (s) => totalEvents(s) === 1);
    await page.getByRole('button', { name: 'Select', exact: true }).click();
    const again = await selectedNotePoint(page);
    await page.mouse.click(again.x, again.y);
    await page.keyboard.press('Backspace');
    await waitForSavedScore(page, (s) => totalEvents(s) === 0);
  });

  test('undo and redo restore insertions and deletions', async ({ page }) => {
    await placeNote(page, { measureIndex: 0, line: 4, xWithinMeasure: 150 });
    await waitForSavedScore(page, (s) => totalEvents(s) === 1);

    await page.getByRole('button', { name: /Delete note/ }).first().click();
    await waitForSavedScore(page, (s) => totalEvents(s) === 0);

    await page.keyboard.press('Control+z');
    await waitForSavedScore(page, (s) => totalEvents(s) === 1);

    await page.keyboard.press('Control+Shift+z');
    await waitForSavedScore(page, (s) => totalEvents(s) === 0);
  });

  test('keyboard shortcuts do not fire while typing in a text field', async ({ page }) => {
    await placeNote(page, { measureIndex: 0, line: 4, xWithinMeasure: 150 });
    await waitForSavedScore(page, (s) => totalEvents(s) === 1);

    // Rename the score: Backspace must edit the text, not delete the note.
    await page.getByRole('button', { name: 'Untitled Composition' }).click();
    const input = page.getByRole('textbox', { name: 'Score title' });
    await input.press('Backspace');

    await page.waitForTimeout(1200);
    const score = await waitForSavedScore(page, (s) => totalEvents(s) === 1);
    expect(totalEvents(score)).toBe(1);
  });

  test('editing while playing stops playback so the playhead cannot point at stale notes', async ({ page }) => {
    await placeNote(page, { measureIndex: 0, line: 4, xWithinMeasure: 150 });
    const second = await staffPoint(page, { measureIndex: 0, line: 2, xWithinMeasure: 280 });
    await page.mouse.click(second.x, second.y);
    await waitForSavedScore(page, (s) => totalEvents(s) === 2);

    await page.getByRole('button', { name: 'Play score' }).click();
    await expect(page.getByRole('button', { name: 'Stop playback' })).toBeVisible();

    const third = await staffPoint(page, { measureIndex: 1, line: 2, xWithinMeasure: 150 });
    await page.mouse.click(third.x, third.y);

    await expect(page.getByRole('button', { name: 'Play score' })).toBeVisible();
  });
});
