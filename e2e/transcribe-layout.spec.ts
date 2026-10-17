import { expect, test } from '@playwright/test';

/**
 * Mobile/tablet layout for the transcription route.
 *
 * Runs in the mobile project. Deliberately does not start inference: the cost is
 * covered by the desktop acceptance suite, and a phone-sized viewport is here to
 * prove the flow reflows without clipping or horizontal overflow.
 */
test.describe('transcribe layout', () => {
  test('the audio flow reflows without horizontal overflow', async ({ page }) => {
    await page.goto('/#transcribe');

    await expect(page.getByRole('heading', { name: /Convert audio to sheet music/i })).toBeVisible();
    await expect(page.getByText(/not uploaded/i)).toBeVisible();

    // The drop zone is a real button, so it is keyboard-activatable on touch devices.
    const dropZone = page.getByRole('button', { name: /Choose an MP3 or WAV file/ });
    await expect(dropZone).toBeVisible();

    const box = (await dropZone.boundingBox())!;
    // Comfortable touch target.
    expect(box.height).toBeGreaterThan(80);

    // No horizontal page overflow.
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    expect(overflow, 'page scrolls horizontally').toBeLessThanOrEqual(1);

    // Footer and theme control remain reachable on a small screen.
    await expect(page.getByRole('contentinfo').getByText('MusikFlo · v1.0')).toBeVisible();
  });

  test('the flow survives a chosen file and can be reset on a small screen', async ({ page }) => {
    await page.goto('/#transcribe');
    await page.locator('input[type=file]').first().setInputFiles('e2e/fixtures/melody.wav');

    await expect(page.getByText('melody.wav')).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('audio')).toHaveCount(1);

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    expect(overflow, 'page scrolls horizontally after choosing a file').toBeLessThanOrEqual(1);

    await page.getByRole('button', { name: 'Remove' }).click();
    await expect(page.getByRole('button', { name: /Choose an MP3 or WAV file/ })).toBeVisible();
  });

  test('the studio exposes a transcription action on a small screen', async ({ page }) => {
    await page.addInitScript(() => {
      indexedDB.deleteDatabase('musikflo_db');
      localStorage.clear();
    });
    await page.goto('/#studio');
    await expect(page.locator('#score-svg-target svg')).toBeVisible();

    // The narrow-screen toolbar carries the entry point when the top bar collapses.
    await expect(page.getByRole('button', { name: 'Transcribe audio' }).last()).toBeVisible();
  });
});
