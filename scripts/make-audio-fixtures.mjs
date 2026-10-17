/**
 * Generate the audio fixtures used by the transcription tests.
 *
 * The clips are synthesised here from pure sine partials, so they are original
 * test material with no third-party licensing attached, and the reference
 * pitches/timings are known exactly.
 *
 * Outputs (e2e/fixtures):
 *   melody.wav          reference melody, 44.1 kHz mono (forces the pipeline to resample)
 *   melody.mp3          the same melody encoded with the Playwright-bundled FFmpeg
 *   silence.wav         near-silent clip, to exercise the "no notes detected" path
 *   chord.wav           simultaneous notes, to exercise overlap handling
 */
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'e2e', 'fixtures');
mkdirSync(outDir, { recursive: true });

const SAMPLE_RATE = 44100;
const BPM = 100;
const QUARTER = 60 / BPM;

/** MIDI note numbers for the reference melody: C4 D4 E4 G4. */
export const MELODY_MIDI = [60, 62, 64, 67];

function midiToHz(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/** A short plucked-string-like tone: fundamental plus two decaying partials. */
function renderTone(samples, startSec, durationSec, midi, amplitude = 0.6) {
  const start = Math.floor(startSec * SAMPLE_RATE);
  const length = Math.floor(durationSec * SAMPLE_RATE);
  const base = midiToHz(midi);

  for (let i = 0; i < length; i++) {
    const t = i / SAMPLE_RATE;
    const index = start + i;
    if (index >= samples.length) break;

    // Percussive envelope with a short attack and exponential decay.
    const attack = Math.min(1, t / 0.01);
    const decay = Math.exp(-2.2 * t);
    const envelope = attack * decay;

    const value =
      Math.sin(2 * Math.PI * base * t) * 1.0 +
      Math.sin(2 * Math.PI * base * 2 * t) * 0.35 * Math.exp(-4 * t) +
      Math.sin(2 * Math.PI * base * 3 * t) * 0.12 * Math.exp(-6 * t);

    samples[index] += value * envelope * amplitude;
  }
}

function writeWav(path, samples) {
  const dataBytes = samples.length * 2;
  const buffer = Buffer.alloc(44 + dataBytes);

  buffer.write('RIFF', 0, 'ascii');
  buffer.writeUInt32LE(36 + dataBytes, 4);
  buffer.write('WAVE', 8, 'ascii');
  buffer.write('fmt ', 12, 'ascii');
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(1, 22); // mono
  buffer.writeUInt32LE(SAMPLE_RATE, 24);
  buffer.writeUInt32LE(SAMPLE_RATE * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36, 'ascii');
  buffer.writeUInt32LE(dataBytes, 40);

  for (let i = 0; i < samples.length; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    buffer.writeInt16LE(Math.round(clamped * 32767), 44 + i * 2);
  }

  writeFileSync(path, buffer);
  return buffer.length;
}

// --- melody.wav -----------------------------------------------------------------
const melodySamples = new Float32Array(Math.floor((QUARTER * 4 + 0.6) * SAMPLE_RATE));
MELODY_MIDI.forEach((midi, index) => {
  renderTone(melodySamples, index * QUARTER, QUARTER * 1.1, midi);
});
const wavPath = join(outDir, 'melody.wav');
const wavBytes = writeWav(wavPath, melodySamples);
console.log(`melody.wav      ${(wavBytes / 1024).toFixed(0)} KiB — C4 D4 E4 G4 quarter notes at ${BPM} BPM`);

// --- silence.wav ----------------------------------------------------------------
const silenceSamples = new Float32Array(Math.floor(1.5 * SAMPLE_RATE));
for (let i = 0; i < silenceSamples.length; i++) {
  // Very low-level noise so it is not a bit-exact all-zero stream.
  silenceSamples[i] = (Math.random() - 0.5) * 0.0004;
}
const silenceBytes = writeWav(join(outDir, 'silence.wav'), silenceSamples);
console.log(`silence.wav     ${(silenceBytes / 1024).toFixed(0)} KiB — near-silent`);

// --- chord.wav ------------------------------------------------------------------
// C4 + E4 + G4 sounding together: the score model cannot represent this, so the
// feature has to detect and report the overlap rather than flatten it silently.
const chordSamples = new Float32Array(Math.floor(2 * SAMPLE_RATE));
for (const midi of [60, 64, 67]) {
  renderTone(chordSamples, 0.1, 1.4, midi, 0.45);
}
const chordBytes = writeWav(join(outDir, 'chord.wav'), chordSamples);
console.log(`chord.wav       ${(chordBytes / 1024).toFixed(0)} KiB — simultaneous C4+E4+G4`);

// --- melody.mp3 -----------------------------------------------------------------
// Encoded with `@breezystack/lamejs`, a pure-JS LAME port. It is a dev-only
// dependency: it exists solely to produce this test fixture and is never shipped
// in the app bundle. Playwright's bundled FFmpeg is a stripped build without a
// WAV demuxer, so it cannot be used here.
const mp3Path = join(outDir, 'melody.mp3');
const mp3Bytes = await encodeMp3(melodySamples);
writeFileSync(mp3Path, mp3Bytes);
console.log(`melody.mp3      ${(mp3Bytes.length / 1024).toFixed(0)} KiB — same melody, 128 kbps`);

async function encodeMp3(samples) {
  const { Mp3Encoder } = await import('@breezystack/lamejs');

  const encoder = new Mp3Encoder(1, SAMPLE_RATE, 128);
  const pcm = new Int16Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    pcm[i] = Math.round(clamped * 32767);
  }

  const chunks = [];
  const BLOCK = 1152;
  for (let i = 0; i < pcm.length; i += BLOCK) {
    const encoded = encoder.encodeBuffer(pcm.subarray(i, i + BLOCK));
    if (encoded.length > 0) chunks.push(Buffer.from(encoded));
  }
  const flushed = encoder.flush();
  if (flushed.length > 0) chunks.push(Buffer.from(flushed));

  return Buffer.concat(chunks);
}
