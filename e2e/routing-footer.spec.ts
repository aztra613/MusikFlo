import { expect, test } from '@playwright/test';
import { FOOTER_LINKS } from '../src/routing/routes';

test.describe('footer navigation and legal routes', () => {
  test('every footer link is a real destination with its own content', async ({ page }) => {
    await page.goto('/#home');

    for (const link of FOOTER_LINKS) {
      await page.getByRole('contentinfo').getByRole('link', { name: link.label, exact: true }).click();

      // The URL and the rendered page must agree, and the page must have content.
      await expect(page).toHaveURL(new RegExp(`#${link.route}$`));
      const heading = page.getByRole('heading', { level: 1 });
      await expect(heading).toBeVisible();
      await expect(heading).not.toHaveText('');
    }
  });

  test('a legal route survives a direct refresh on a static host', async ({ page }) => {
    // Deep-linking and refreshing must work without a server-side rewrite.
    await page.goto('/#privacy');
    await expect(page.getByRole('heading', { level: 1, name: 'Privacy' })).toBeVisible();

    await page.reload();
    await expect(page.getByRole('heading', { level: 1, name: 'Privacy' })).toBeVisible();
    await expect(page.getByRole('contentinfo').getByText('MusikFlo · v1.0')).toBeVisible();
  });

  test('browser back and forward move between legal pages and the landing page', async ({ page }) => {
    await page.goto('/#home');
    await page.getByRole('contentinfo').getByRole('link', { name: 'Terms', exact: true }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Terms of use' })).toBeVisible();

    await page.getByRole('contentinfo').getByRole('link', { name: 'Security', exact: true }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Security' })).toBeVisible();

    await page.goBack();
    await expect(page.getByRole('heading', { level: 1, name: 'Terms of use' })).toBeVisible();

    await page.goForward();
    await expect(page.getByRole('heading', { level: 1, name: 'Security' })).toBeVisible();
  });

  test('an unknown hash resolves to the landing page instead of a blank view', async ({ page }) => {
    await page.goto('/#not-a-real-route');
    await expect(page.getByRole('heading', { level: 1, name: /Turn a note into a melody/ })).toBeVisible();
  });

  test('landing section links scroll to their sections', async ({ page }) => {
    await page.goto('/#home');
    // The wide-screen and narrow-screen navs are both in the DOM; use whichever
    // one this viewport actually shows.
    const nav = page.getByRole('navigation', { name: /sections/i }).filter({ visible: true }).first();
    await nav.getByRole('link', { name: 'How it works' }).click();
    await expect(page).toHaveURL(/#how-it-works$/);
    await expect(page.locator('#how-it-works')).toBeInViewport();
  });

  test('the studio is reachable without a login and shows no cloud or account claims', async ({ page }) => {
    await page.goto('/#studio');
    await expect(page.locator('#score-svg-target svg')).toBeVisible();

    // Truthfulness: nothing may claim cloud saving, sign-in or sharing.
    const body = (await page.locator('body').innerText()).toLowerCase();
    for (const forbidden of ['sign in', 'log in', 'sign up', 'cloud', 'sync', 'shared with', 'account']) {
      expect(body, `unexpected claim: ${forbidden}`).not.toContain(forbidden);
    }

    // The save state is exposed at every width, including via its accessible name.
    await expect(page.getByRole('status').first()).toHaveAttribute(
      'aria-label',
      /Save status: (Saved in this browser|Saving…|Unsaved changes|Could not save)/
    );
  });

  test('privacy copy does not claim compositions are uploaded', async ({ page }) => {
    await page.goto('/#privacy');
    const body = (await page.locator('body').innerText()).toLowerCase();
    expect(body).toContain('never uploaded to us');
    expect(body).toContain('indexeddb');
    expect(body).not.toContain('uploaded to our servers');
  });
});

test.describe('legal page reading layout', () => {
  test('legal text keeps a readable editorial measure', async ({ page }) => {
    await page.goto('/#licenses');
    const column = page.locator('main > div').first();
    const box = (await column.boundingBox())!;
    // Around 60-70 characters per line; 3rem max width keeps lines readable.
    expect(box.width).toBeLessThanOrEqual(768);
  });

  test('the studio footer is not pushed into the editing viewport', async ({ page }) => {
    await page.goto('/#studio');
    await expect(page.locator('#score-svg-target svg')).toBeVisible();
    // The studio keeps its transport dock at the bottom and does not render the
    // site footer inside the workspace.
    await expect(page.getByRole('contentinfo', { name: /Playback transport/ })).toBeVisible();
    await expect(page.locator('footer').getByText('MusikFlo · v1.0')).toHaveCount(0);
  });
});
