import { expect, test, type Page } from '@playwright/test';
import { openStudio, placeNote, readSavedScore, totalEvents, waitForSavedScore } from './helpers';
import { readFileSync } from 'node:fs';

/**
 * Audio-to-sheet-music acceptance tests.
 *
 * The transcription tests run real inference in the production build: the model
 * downloads from our own origin and the notes are read back out of IndexedDB, so
 * a wrong pitch or a missing handoff cannot pass. The fixtures are synthesised by
 * `scripts/make-audio-fixtures.mjs`, so their reference pitches are known exactly.
 *
 * Inference is CPU-bound here (no GPU in headless Chromium) at roughly 8x
 * realtime, which is why these tests have long timeouts.
 */

const MELODY_PITCHES = ['c4', 'd4', 'e4', 'g4'];
const INFERENCE_TIMEOUT = 240_000;

/** Node-side WAV synthesis, so no large binary fixtures need committing. */
function makeWav(seconds: number, sampleRate = 44100): Buffer {
  const samples = Math.floor(seconds * sampleRate);
  const buffer = Buffer.alloc(44 + samples * 2);
  buffer.write('RIFF', 0, 'ascii');
  buffer.writeUInt32LE(36 + samples * 2, 4);
  buffer.write('WAVE', 8, 'ascii');
  buffer.write('fmt ', 12, 'ascii');
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36, 'ascii');
  buffer.writeUInt32LE(samples * 2, 40);
  for (let i = 0; i < samples; i++) {
    buffer.writeInt16LE(Math.round(Math.sin((2 * Math.PI * 440 * i) / sampleRate) * 12000), 44 + i * 2);
  }
  return buffer;
}

/** The flow renders as a dialog in the studio and as a region on its own page. */
function flowRoot(page: Page) {
  return page
    .getByRole('dialog', { name: /Convert audio to sheet music/i })
    .or(page.getByRole('region', { name: /Convert audio to sheet music/i }))
    .first();
}

async function uploadFixture(page: Page, fixture: string) {
  // Scoped to the flow: the studio top bar has its own project-import file input.
  await flowRoot(page).locator('input[type=file]').first().setInputFiles(`e2e/fixtures/${fixture}`);
  await expect(flowRoot(page).getByText(fixture)).toBeVisible();
}

async function runTranscription(page: Page) {
  const flow = flowRoot(page);
  await flow.getByRole('button', { name: 'Continue' }).click();
  await flow.getByRole('button', { name: 'Transcribe audio' }).click();
  await expect(flow.getByText(/What the conversion did/i)).toBeVisible({ timeout: INFERENCE_TIMEOUT });
}

/**
 * Accept the transcription and read the accepted project back from storage.
 *
 * Waits for the *transcribed* project by title: accepting first flushes the
 * composition that was already open, so a "has any notes" predicate could read
 * the preserved project instead of the new one.
 */
async function acceptAndRead(page: Page, expectedTitle: string) {
  await flowRoot(page).getByRole('button', { name: /Open as new score/i }).click();
  await expect(page.locator('#score-svg-target svg')).toBeVisible({ timeout: 30_000 });
  return waitForSavedScore(page, (score) => score.title === expectedTitle);
}

function pitchSequence(score: Awaited<ReturnType<typeof readSavedScore>>) {
  return (score?.measures ?? [])
    .flatMap((measure) => measure.events)
    .filter((event) => !event.isRest)
    .map((event) => `${event.step}${event.accidental ?? ''}${event.octave}`);
}

test.describe('audio to sheet music', () => {
  test('is reachable from the landing page and the studio without signing in', async ({ page }) => {
    await page.goto('/#home');
    // The primary actions must still be present and unchanged.
    await expect(page.getByRole('button', { name: /Start composing/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Try a sample/ })).toBeVisible();

    await page.getByRole('button', { name: /Convert audio to sheet music/ }).click();
    await expect(page).toHaveURL(/#transcribe$/);
    await expect(page.getByRole('heading', { name: /Convert audio to sheet music/i })).toBeVisible();

    // No login, account or cloud copy anywhere in the flow.
    const body = (await page.locator('body').innerText()).toLowerCase();
    for (const forbidden of ['sign in', 'log in', 'sign up', 'create account', 'cloud']) {
      expect(body, `unexpected claim: ${forbidden}`).not.toContain(forbidden);
    }

    // The studio exposes its own entry point.
    await openStudio(page);
    await expect(page.getByRole('button', { name: 'Transcribe audio' }).first()).toBeVisible();
  });

  test('does not download the model until a transcription is started', async ({ page }) => {
    const requests: string[] = [];
    page.on('request', (request) => requests.push(request.url()));

    await page.goto('/#home');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await openStudio(page);

    // Ordinary use must not pay for the transcription runtime.
    expect(requests.filter((url) => /model\/model\.json|group1-shard/.test(url))).toHaveLength(0);

    await page.goto('/#transcribe');
    await expect(page.getByText(/Your audio is analysed on this device/)).toBeVisible();
    expect(
      requests.filter((url) => /model\/model\.json/.test(url)),
      'model loaded before a clip was chosen'
    ).toHaveLength(0);

    // A real clip, because a silent one is rejected before the model is needed.
    await uploadFixture(page, 'melody.wav');
    await flowRoot(page).getByRole('button', { name: 'Continue' }).click();
    expect(
      requests.filter((url) => /model\/model\.json/.test(url)),
      'model loaded before transcription was started'
    ).toHaveLength(0);

    await flowRoot(page).getByRole('button', { name: 'Transcribe audio' }).click();

    // The model is fetched on demand, from this site rather than a CDN.
    await expect
      .poll(() => requests.filter((url) => /model\/model\.json/.test(url)).length, { timeout: 60_000 })
      .toBeGreaterThan(0);
    expect(requests.filter((url) => /cdn\.jsdelivr|unpkg|cdnjs/.test(url))).toHaveLength(0);
  });

  test('rejects unsupported, empty and oversized files with accurate guidance', async ({ page }) => {
    await page.goto('/#transcribe');

    // Unsupported type.
    await page.locator('input[type=file]').first().setInputFiles({
      name: 'notes.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('this is not audio'),
    });
    await expect(page.getByText(/not supported/i)).toBeVisible();
    await expect(page.getByText(/MP3 or WAV/).first()).toBeVisible();

    // Empty file.
    await page.locator('input[type=file]').first().setInputFiles({
      name: 'empty.wav',
      mimeType: 'audio/wav',
      buffer: Buffer.alloc(0),
    });
    await expect(page.getByText(/That file is empty/)).toBeVisible();

    // Oversized file (above the 20 MiB pilot limit).
    await page.locator('input[type=file]').first().setInputFiles({
      name: 'huge.wav',
      mimeType: 'audio/wav',
      buffer: Buffer.alloc(21 * 1024 * 1024),
    });
    await expect(page.getByText(/above the current limit/i)).toBeVisible();
    await expect(page.getByText(/The limit is 20 MiB/)).toBeVisible();

    // The flow stays usable afterwards.
    await expect(page.getByRole('button', { name: /Choose an MP3 or WAV file/ })).toBeVisible();
  });

  test('rejects a clip that is longer than the limit without starting work', async ({ page }) => {
    await page.goto('/#transcribe');

    // 70 seconds, just above the 60-second pilot ceiling.
    await page.locator('input[type=file]').first().setInputFiles({
      name: 'long.wav',
      mimeType: 'audio/wav',
      buffer: makeWav(70),
    });

    await expect(page.getByText(/above the current limit/i)).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/60 seconds/)).toBeVisible();
    // Continue stays disabled, so inference can never start.
    await expect(page.getByRole('button', { name: 'Continue' })).toBeDisabled();
  });

  test('transcribes a WAV into the expected pitches and opens it as a new score', async ({ page }) => {
    test.setTimeout(INFERENCE_TIMEOUT + 60_000);

    const nonGet: string[] = [];
    page.on('request', (request) => {
      if (request.method() !== 'GET') nonGet.push(`${request.method()} ${request.url()}`);
    });

    await page.goto('/#transcribe');
    await uploadFixture(page, 'melody.wav');
    await expect(page.locator('audio')).toHaveCount(1);

    await runTranscription(page);

    // Review states the detected count and keeps the estimate clearly labelled.
    await expect(page.getByText(/What the conversion did/i)).toBeVisible();
    await expect(page.getByText(/DETECTED NOTES/i)).toBeVisible();

    const score = await acceptAndRead(page, 'melody');

    // The reference melody is C4 D4 E4 G4 as quarter notes.
    expect(pitchSequence(score)).toEqual(MELODY_PITCHES);
    expect(score.title).toBe('melody');
    expect(score.clef).toBe('treble');
    expect(score.composer).toBe('Transcribed from audio');
    // Tempo is an estimate from the recording (100 BPM fixture).
    expect(score.tempo).toBeGreaterThanOrEqual(90);
    expect(score.tempo).toBeLessThanOrEqual(112);

    // Every bar must satisfy the studio's own rhythmic validation.
    score.measures.forEach((measure) => {
      const filled = measure.events.reduce((sum, event) => {
        const base = { '1': 4, '2': 2, '4': 1, '8': 0.5, '16': 0.25 }[event.duration] ?? 1;
        return sum + base * (event.dotted ? 1.5 : 1);
      }, 0);
      expect(filled).toBeCloseTo(4, 6);
    });

    // Privacy: the audio never left the page.
    expect(nonGet, `unexpected requests: ${nonGet.join(', ')}`).toHaveLength(0);
  });

  test('transcribes an MP3 identically, proving MP3 decoding works', async ({ page }) => {
    test.setTimeout(INFERENCE_TIMEOUT + 60_000);

    await page.goto('/#transcribe');
    await uploadFixture(page, 'melody.mp3');

    // The preview confirms the browser decoded the MP3 (duration shown, not "decoding…").
    await expect(page.getByText(/0:0\d/)).toBeVisible({ timeout: 30_000 });

    await runTranscription(page);
    const score = await acceptAndRead(page, 'melody');

    expect(pitchSequence(score)).toEqual(MELODY_PITCHES);
  });

  test('reports genuinely simultaneous notes and never flattens them silently', async ({ page }) => {
    test.setTimeout(INFERENCE_TIMEOUT + 60_000);

    await page.goto('/#transcribe');
    await uploadFixture(page, 'chord.wav');
    await runTranscription(page);

    // A real chord must raise the warning and offer an explicit choice.
    const flow = flowRoot(page);
    await expect(flow.getByText(/The score editor writes one line of music/i)).toBeVisible();
    const melodyOption = flow.locator('input[name="polyphony"]').first();
    const allNotesOption = flow.locator('input[name="polyphony"]').nth(1);
    await expect(melodyOption).toBeChecked();

    // The disclosure must state what the reduction did.
    await expect(flow.getByText(/Melody line reduction: \d+ note/)).toBeVisible();

    // Choosing to keep everything changes the notated result and says so.
    await allNotesOption.check();
    await expect(flow.getByText(/shortened/i).first()).toBeVisible();

    // The raw timing is always available, because the score cannot hold it.
    await expect(flow.getByRole('button', { name: /Download raw MIDI/i })).toBeVisible();

    // Melody-only output is the single highest note of the chord.
    await melodyOption.check();
    const score = await acceptAndRead(page, 'chord');
    expect(pitchSequence(score)).toEqual(['g4']);
  });

  test('cancelling stops the work and returns to a safe state', async ({ page }) => {
    test.setTimeout(INFERENCE_TIMEOUT + 60_000);

    await page.goto('/#transcribe');
    await uploadFixture(page, 'melody.wav');
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByRole('button', { name: 'Transcribe audio' }).click();

    // Wait until analysis is genuinely under way, then cancel.
    await expect(page.getByText(/Analysing audio|Preparing transcription engine/)).toBeVisible({ timeout: 120_000 });
    await page.getByRole('button', { name: 'Cancel' }).click();

    // Back at configure, with no error and no partial result.
    await expect(page.getByRole('button', { name: 'Transcribe audio' })).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText(/What the conversion did/i)).toHaveCount(0);
    await expect(page.getByRole('alert')).toHaveCount(0);

    // The flow still works afterwards: the ordinary studio is unaffected.
    await openStudio(page);
    await expect(page.locator('#score-svg-target svg')).toBeVisible();
  });

  test('accepting a transcription preserves the composition already open', async ({ page }) => {
    test.setTimeout(INFERENCE_TIMEOUT + 90_000);

    // Native confirms are accepted rather than dismissed.
    page.on('dialog', (dialog) => void dialog.accept());

    await openStudio(page);
    await placeNote(page, { measureIndex: 0, line: 4, xWithinMeasure: 150 });
    const original = await waitForSavedScore(page, (score) => totalEvents(score) === 1);
    const originalTitle = original.title;

    await page.getByRole('button', { name: 'Transcribe audio' }).first().click();
    await expect(page.getByRole('dialog', { name: /Convert audio to sheet music/i })).toBeVisible();

    // Transcribing happens in an overlay, so the editor is never unmounted.
    await uploadFixture(page, 'melody.wav');
    await runTranscription(page);
    const transcribed = await acceptAndRead(page, 'melody');

    expect(transcribed.id).not.toBe(original.id);
    expect(transcribed.title).toBe('melody');

    // The previous composition is still stored and reachable from Recent.
    await page.getByRole('button', { name: 'Recent' }).click();
    const recentMenu = page.getByRole('menu');
    await expect(recentMenu.getByRole('menuitem').filter({ hasText: originalTitle }).first()).toBeVisible();

    await recentMenu.getByRole('menuitem').filter({ hasText: originalTitle }).first().click();

    // Re-opening it restores the actual notes, not an empty shell.
    const restored = await waitForSavedScore(page, (score) => score.title === originalTitle);
    expect(totalEvents(restored)).toBe(1);
    expect(pitchSequence(restored)).toEqual(pitchSequence(original));
  });

  test('the transcribed score is editable and exportable', async ({ page }) => {
    test.setTimeout(INFERENCE_TIMEOUT + 60_000);

    await page.goto('/#transcribe');
    await uploadFixture(page, 'melody.wav');
    await runTranscription(page);
    await acceptAndRead(page, 'melody');

    // Existing editing still works on a transcribed score: selecting an existing
    // note must not insert another one.
    await page.getByRole('button', { name: 'Select', exact: true }).click();
    const outline = page.locator('[data-note-id]');
    if ((await outline.count()) > 0) {
      const box = (await outline.first().boundingBox())!;
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      await expect(page.getByText(/^Selected:/)).toBeVisible();
      expect(totalEvents(await waitForSavedScore(page, () => true))).toBe(4);
    }

    // Existing exporters still produce a file for the transcribed score.
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page
        .getByRole('button', { name: /Export/ })
        .click()
        .then(() => page.getByRole('menuitem', { name: /MIDI/ }).click()),
    ]);
    const path = await download.path();
    const bytes = readFileSync(path!);
    expect(bytes.toString('ascii', 0, 4)).toBe('MThd');
  });

  test('leaving the flow does not delete saved compositions', async ({ page }) => {
    await openStudio(page);
    await placeNote(page, { measureIndex: 0, line: 4, xWithinMeasure: 150 });
    const saved = await waitForSavedScore(page, (score) => totalEvents(score) === 1);

    await page.getByRole('button', { name: 'Transcribe audio' }).first().click();
    await expect(page.getByRole('dialog', { name: /Convert audio to sheet music/i })).toBeVisible();
    await page.getByRole('button', { name: 'Close audio to sheet music' }).click();

    // The composition is untouched after closing the overlay.
    const stillThere = await waitForSavedScore(page, (score) => score.id === saved.id);
    expect(totalEvents(stillThere)).toBe(1);

    // And the transcription route can be left without side effects.
    await page.goto('/#transcribe');
    await page.getByRole('button', { name: 'Close audio to sheet music' }).click();
    await expect(page.getByRole('heading', { level: 1, name: /Turn a note into a melody/ })).toBeVisible();
  });

  test('the transcription route survives a direct refresh on a static host', async ({ page }) => {
    await page.goto('/#transcribe');
    await expect(page.getByRole('heading', { name: /Convert audio to sheet music/i })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('heading', { name: /Convert audio to sheet music/i })).toBeVisible();
    await expect(page.getByRole('contentinfo').getByText('MusikFlo · v1.0')).toBeVisible();
  });
});
