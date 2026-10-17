import { expect, test, type Page } from '@playwright/test';
import { contrastRatio, openStudio, placeNote, staffPoint, totalEvents, waitForSavedScore } from './helpers';

/** All stroke/fill colours actually painted inside the score SVG. */
async function scorePaintedColors(page: Page) {
  return page.evaluate(() => {
    const svg = document.querySelector('#score-svg-target svg');
    if (!svg) return { strokes: [] as string[], fills: [] as string[] };

    const strokes = new Set<string>();
    const fills = new Set<string>();

    svg.querySelectorAll('*').forEach((element) => {
      const computed = getComputedStyle(element);
      if (computed.stroke && computed.stroke !== 'none') strokes.add(computed.stroke);
      if (computed.fill && computed.fill !== 'none') fills.add(computed.fill);
    });

    return { strokes: [...strokes], fills: [...fills] };
  });
}

function paperColor(page: Page) {
  return page.evaluate(() => getComputedStyle(document.querySelector('.bg-paper') as Element).backgroundColor);
}

const DARK_STAFF = 'rgb(132, 149, 139)'; // #84958B

test.describe('notation rendering and theme', () => {
  test.use({ colorScheme: 'dark' });

  test.beforeEach(async ({ page }) => {
    await openStudio(page);
  });

  test('stays legible in dark mode: staff lines are drawn in the pale sage token', async ({ page }) => {
    await expect(page.locator('html')).toHaveClass(/dark/);
    await placeNote(page, { measureIndex: 0, line: 4, xWithinMeasure: 150 });
    await waitForSavedScore(page, (s) => totalEvents(s) === 1);

    const { strokes } = await scorePaintedColors(page);

    // The staff-line colour must actually be painted. Before the fix VexFlow's
    // default black stroke reached the SVG and the staff effectively vanished.
    expect(strokes, `painted strokes: ${strokes.join(', ')}`).toContain(DARK_STAFF);

    // And it must genuinely contrast with the dark score paper.
    expect(contrastRatio(DARK_STAFF, await paperColor(page))).toBeGreaterThan(4);

    // No pure-black notation ink should remain on the dark surface.
    expect(strokes).not.toContain('rgb(0, 0, 0)');
  });

  test('theme switching restyles the score without altering the music', async ({ page }) => {
    await placeNote(page, { measureIndex: 0, line: 4, xWithinMeasure: 150 });
    const before = await waitForSavedScore(page, (s) => totalEvents(s) === 1);

    await page.getByRole('button', { name: /Switch to (light|dark) mode/ }).click();
    await expect(page.locator('html')).not.toHaveClass(/dark/);

    const after = await waitForSavedScore(page, (s) => totalEvents(s) === 1);

    // Same pitch, same duration, same measure geometry: only colour changed.
    const shape = (score: typeof before) =>
      score.measures.map((m) => m.events.map((e) => `${e.step}${e.octave}/${e.duration}/${e.isRest ?? false}`));
    expect(shape(after)).toEqual(shape(before));
    expect(after.measures).toHaveLength(before.measures.length);

    const { strokes } = await scorePaintedColors(page);
    expect(strokes, `painted strokes: ${strokes.join(', ')}`).not.toContain(DARK_STAFF);
    expect(contrastRatio('rgb(154, 167, 159)', await paperColor(page))).toBeGreaterThan(2);
  });

  test('playback drives the playhead and then clears it', async ({ page }) => {
    await placeNote(page, { measureIndex: 0, line: 4, xWithinMeasure: 150 });
    const second = await staffPoint(page, { measureIndex: 0, line: 2, xWithinMeasure: 260 });
    await page.mouse.click(second.x, second.y);
    await waitForSavedScore(page, (s) => totalEvents(s) === 2);

    await page.getByRole('button', { name: 'Play score' }).click();

    // The playhead is rendered from the real scheduled audio timeline.
    await expect(page.locator('.bg-playhead').first()).toBeVisible();

    await page.getByRole('button', { name: 'Stop playback' }).click();
    await expect(page.locator('.bg-playhead')).toHaveCount(0);
  });
});

test.describe('theme persistence', () => {
  test('the chosen theme survives a reload', async ({ browser }) => {
    // Deliberately no storage-clearing init script here: persistence is the point.
    const page = await browser.newPage();
    await page.goto('/#studio');
    await expect(page.locator('#score-svg-target svg')).toBeVisible();

    const startedDark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
    await page.getByRole('button', { name: /Switch to (light|dark) mode/ }).click();
    const toggled = await page.evaluate(() => document.documentElement.classList.contains('dark'));
    expect(toggled).toBe(!startedDark);

    await page.reload();
    await expect(page.locator('#score-svg-target svg')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.classList.contains('dark'))).toBe(toggled);

    await page.close();
  });
});

test.describe('landing page motion', () => {
  test('the primary action is immediately usable and enters the studio', async ({ page }) => {
    await page.goto('/#home');
    const cta = page.getByRole('button', { name: /Start composing/ });
    await expect(cta).toBeVisible();
    await cta.click();
    await expect(page.locator('#score-svg-target svg')).toBeVisible();
  });

  test('reduced motion leaves content at rest', async ({ browser }) => {
    const page = await browser.newPage({ reducedMotion: 'reduce' });
    await page.goto('/#home');

    const heading = page.getByRole('heading', { level: 1 });
    await expect(heading).toBeVisible();
    const transform = await heading.evaluate((element) => getComputedStyle(element).transform);
    expect(transform === 'none' || transform === 'matrix(1, 0, 0, 1, 0, 0)').toBe(true);

    // Feature sections are revealed without translation as well.
    await page.locator('#features').scrollIntoViewIfNeeded();
    const features = page.locator('#features');
    await expect(features.getByText(/Built for intuitive music creation/)).toBeVisible();

    await page.close();
  });

  test('the footer is present on the landing page', async ({ page }) => {
    await page.goto('/#home');
    const footer = page.getByRole('contentinfo');
    await expect(footer.getByText('MusikFlo · v1.0')).toBeVisible();
    await expect(footer.getByText(/Product of Aztras AI Tech Solutions, Chennai, India\./)).toBeVisible();
  });
});
