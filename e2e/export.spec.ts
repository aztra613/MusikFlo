import { expect, test, type Page } from '@playwright/test';
import { mkdirSync, readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { openStudio, placeNote, waitForSavedScore, totalEvents } from './helpers';

const OUT = 'scratch';

/** Audio statistics that expose timbre differences between instruments. */
function wavStats(bytes: Buffer) {
  let sum = 0;
  let crossings = 0;
  let prev = 0;
  let peak = 0;
  let count = 0;
  const histogram = new Array(64).fill(0);

  for (let i = 44; i + 3 < bytes.length; i += 4) {
    const sample = bytes.readInt16LE(i);
    sum += Math.abs(sample);
    peak = Math.max(peak, Math.abs(sample));
    if ((sample >= 0 && prev < 0) || (sample < 0 && prev >= 0)) crossings++;
    prev = sample;
    count++;
    histogram[Math.min(63, Math.abs(sample) >> 10)]++;
  }

  return {
    bytes: bytes.length,
    meanAbs: Math.round(sum / Math.max(1, count)),
    peak,
    crossings,
    seconds: Number((count / 2 / 44100).toFixed(2)),
    /** Coarse amplitude distribution: a cheap, robust timbre fingerprint. */
    histogram: histogram.join(','),
  };
}

/** Undo PNG-style per-row filtering (PDF Predictor 10/11). */
function unfilterRows(src: Buffer, width: number, height: number, channels: number) {
  const stride = width * channels;
  const out = Buffer.alloc(stride * height);

  const paeth = (a: number, b: number, c: number) => {
    const p = a + b - c;
    const pa = Math.abs(p - a);
    const pb = Math.abs(p - b);
    const pc = Math.abs(p - c);
    return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
  };

  for (let y = 0; y < height; y++) {
    const filter = src[y * (stride + 1)];
    const rowStart = y * (stride + 1) + 1;
    for (let x = 0; x < stride; x++) {
      const value = src[rowStart + x];
      const left = x >= channels ? out[y * stride + x - channels] : 0;
      const up = y > 0 ? out[(y - 1) * stride + x] : 0;
      const upLeft = y > 0 && x >= channels ? out[(y - 1) * stride + x - channels] : 0;

      let restored: number;
      switch (filter) {
        case 0:
          restored = value;
          break;
        case 1:
          restored = value + left;
          break;
        case 2:
          restored = value + up;
          break;
        case 3:
          restored = value + ((left + up) >> 1);
          break;
        default:
          restored = value + paeth(left, up, upLeft);
      }

      out[y * stride + x] = restored & 0xff;
    }
  }

  return out;
}

/** Share of the raster that is paper, staff lines, or dark notation ink. */
function inkCoverage(pixels: Buffer) {
  let paper = 0;
  let staffLines = 0;
  let ink = 0;
  let total = 0;

  for (let i = 0; i + 2 < pixels.length; i += 3) {
    const lum = 0.2126 * pixels[i] + 0.7152 * pixels[i + 1] + 0.0722 * pixels[i + 2];
    total++;
    if (lum > 245) paper++;
    else if (lum >= 110) staffLines++;
    else ink++;
  }

  return {
    paper: paper / total,
    staffLines: staffLines / total,
    ink: ink / total,
  };
}

/**
 * Pull the embedded score raster back out of the PDF.
 *
 * jsPDF writes the image as an XObject whose dictionary carries the size, the
 * filter and — for `FAST` compression — a PNG-style predictor, so the samples
 * have to be read back through both the Deflate and row-filter stages.
 */
function extractPdfImage(pdf: Buffer) {
  const latin = pdf.toString('latin1');
  const imageAt = latin.indexOf('/Subtype /Image');
  expect(imageAt, 'the PDF contains no image object').toBeGreaterThan(-1);

  const streamAt = latin.indexOf('stream', imageAt);
  const dict = latin.slice(imageAt, streamAt);
  const width = Number(/\/Width (\d+)/.exec(dict)?.[1]);
  const height = Number(/\/Height (\d+)/.exec(dict)?.[1]);
  const length = Number(/\/Length (\d+)/.exec(dict)?.[1]);
  const isFlate = /\/Filter\s*\/FlateDecode/.test(dict);
  const predictor = Number(/\/Predictor (\d+)/.exec(dict)?.[1] ?? 0);

  expect(width, 'image width missing from the PDF').toBeGreaterThan(0);
  expect(height, 'image height missing from the PDF').toBeGreaterThan(0);
  expect(length, 'image length missing from the PDF').toBeGreaterThan(0);

  const dataStart = streamAt + 'stream'.length + (latin[streamAt + 6] === '\r' ? 2 : 1);
  const raw = pdf.subarray(dataStart, dataStart + length);
  let samples = isFlate ? inflateSync(raw) : raw;

  // PNG predictors (10 = none, 11 = sub, 12 = up, ...) prefix each row with a
  // filter byte. Ignoring it shifts every row and decodes as garbage.
  if (predictor >= 10) {
    const expectedWithFilters = height * (width * 3 + 1);
    expect(samples.length, 'predictor data size mismatch').toBe(expectedWithFilters);
    samples = unfilterRows(samples, width, height, 3);
  } else {
    expect(samples.length).toBe(width * height * 3);
  }

  return { width, height, compressed: isFlate, pixels: samples };
}

async function exportFrom(page: Page, menuLabel: RegExp, path: string) {
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page
      .getByRole('button', { name: /Export/ })
      .click()
      .then(() => page.getByRole('menuitem', { name: menuLabel }).click()),
  ]);
  await download.saveAs(path);
  return readFileSync(path);
}

test.describe('audio and print export', () => {
  test.beforeEach(async ({ page }) => {
    mkdirSync(OUT, { recursive: true });
    await openStudio(page);
  });

  test('every instrument renders a distinct WAV, including guitar and bansuri', async ({ page }) => {
    await placeNote(page, { measureIndex: 0, line: 4, xWithinMeasure: 150 });
    await waitForSavedScore(page, (s) => totalEvents(s) === 1);

    const instruments = ['piano', 'guitar', 'strings', 'flute', 'bansuri', 'clarinet'] as const;
    const rendered: Record<string, ReturnType<typeof wavStats>> = {};

    for (const instrument of instruments) {
      await page.locator('#instrument-select').selectOption(instrument);
      // Confirm the score really switched before exporting.
      await expect(page.locator('#instrument-select')).toHaveValue(instrument);

      const wav = await exportFrom(page, /Audio/, `${OUT}/${instrument}.wav`);
      expect(wav.toString('ascii', 0, 4)).toBe('RIFF');
      expect(wav.toString('ascii', 8, 12)).toBe('WAVE');
      expect(wav.length).toBeGreaterThan(10000);
      rendered[instrument] = wavStats(wav);
    }

    // Regression: guitar used to fall through to the piano branch, producing a
    // byte-identical file, and flute was only marginally different.
    expect(rendered.guitar.histogram).not.toBe(rendered.piano.histogram);
    expect(rendered.guitar.crossings).not.toBe(rendered.piano.crossings);

    // Every instrument must be audibly its own voice.
    const fingerprints = instruments.map((id) => rendered[id].histogram);
    expect(new Set(fingerprints).size, `duplicate voices: ${instruments.join(', ')}`).toBe(instruments.length);

    // And every render must actually contain sound.
    for (const id of instruments) {
      expect(rendered[id].peak, `${id} is silent`).toBeGreaterThan(500);
    }
  });

  test('the PDF contains real notation even in dark mode', async ({ page }) => {
    // Dark mode is the case that used to export near-white ink onto white paper.
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.reload();
    await expect(page.locator('#score-svg-target svg')).toBeVisible();
    await expect(page.locator('html')).toHaveClass(/dark/);

    await placeNote(page, { measureIndex: 0, line: 4, xWithinMeasure: 150 });
    await placeNote(page, { measureIndex: 0, line: 2, xWithinMeasure: 280 });
    await waitForSavedScore(page, (s) => totalEvents(s) === 2);

    const pdf = await exportFrom(page, /PDF/, `${OUT}/score.pdf`);
    expect(pdf.toString('ascii', 0, 5)).toBe('%PDF-');

    const image = extractPdfImage(pdf);
    const coverage = inkCoverage(image.pixels);

    // The engraved canvas is the score size at 2.5x.
    expect(image.width).toBe(Math.round(840 * 2.5));
    expect(image.height).toBeGreaterThan(300);

    // These three bounds together reject every broken outcome: an all-black or
    // misdecoded raster fails the paper share, a blank page fails the staff-line
    // and ink shares, and missing glyphs fail the ink share.
    expect(coverage.paper, 'score paper should dominate the raster').toBeGreaterThan(0.6);
    expect(coverage.staffLines, 'no staff lines in the PDF image').toBeGreaterThan(0.004);
    expect(coverage.staffLines).toBeLessThan(0.25);
    expect(coverage.ink, 'no dark notation ink in the PDF image').toBeGreaterThan(0.0002);
    expect(coverage.ink, 'the image is mostly ink, which means decoding failed').toBeLessThan(0.2);
  });

  test('the PDF export reports success and never silently writes a blank page', async ({ page }) => {
    await placeNote(page, { measureIndex: 0, line: 4, xWithinMeasure: 150 });
    await waitForSavedScore(page, (s) => totalEvents(s) === 1);

    const pdf = await exportFrom(page, /PDF/, `${OUT}/single.pdf`);
    // A header-only PDF would be a few kilobytes; a page with the score raster
    // embedded is far larger.
    expect(pdf.length).toBeGreaterThan(20_000);
    await expect(page.getByText('PDF score downloaded.')).toBeVisible();
  });
});
