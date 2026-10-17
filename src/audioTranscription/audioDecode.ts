import { MAX_DURATION_SECONDS, MAX_FILE_BYTES, MODEL_SAMPLE_RATE } from './config';
import { TranscriptionFailure } from './types';

/**
 * Audio decoding and model-input preparation.
 *
 * Everything here runs on the user's device. No audio bytes leave the page: the
 * file is read into memory, decoded by the browser's own Web Audio decoder, and
 * resampled to what the model expects.
 */

/** Cheap checks before decoding. Returns null when the file is acceptable. */
export function validateFile(file: File): TranscriptionFailure | null {
  const lowerName = file.name.toLowerCase();
  const looksSupported =
    lowerName.endsWith('.mp3') || lowerName.endsWith('.wav') ||
    file.type === 'audio/mpeg' || file.type === 'audio/wav' || file.type === 'audio/x-wav' ||
    file.type === 'audio/wave' || file.type === 'audio/mp3';

  if (!looksSupported) {
    return new TranscriptionFailure({
      code: 'unsupported-type',
      message: 'That file type is not supported.',
      hint: 'Choose an MP3 or WAV file.',
    });
  }

  if (file.size === 0) {
    return new TranscriptionFailure({
      code: 'decode-failed',
      message: 'That file is empty.',
      hint: 'Choose a recording that contains audio.',
    });
  }

  if (file.size > MAX_FILE_BYTES) {
    return new TranscriptionFailure({
      code: 'too-large',
      message: 'This clip is above the current limit.',
      hint: `The limit is ${Math.round(MAX_FILE_BYTES / (1024 * 1024))} MiB; this file is ${(
        file.size / (1024 * 1024)
      ).toFixed(1)} MiB. Trim it or choose a shorter file.`,
    });
  }

  return null;
}

/** Decode a file with the browser's Web Audio decoder. */
export async function decodeAudioFile(file: File, context?: AudioContext): Promise<AudioBuffer> {
  const bytes = await file.arrayBuffer();

  const decoders = context ?? new AudioContext();
  try {
    // decodeAudioData detaches the buffer it is given, so pass a copy.
    const buffer = await decoders.decodeAudioData(bytes.slice(0));
    return buffer;
  } catch {
    throw new TranscriptionFailure({
      code: 'decode-failed',
      message: 'This file could not be decoded.',
      hint: 'Try a standard MP3 or WAV file.',
    });
  } finally {
    if (!context) {
      void decoders.close();
    }
  }
}

/** Reject clips that are silent or too long, and clips with no audio at all. */
export function assertUsableBuffer(buffer: AudioBuffer): void {
  if (!buffer.length || buffer.numberOfChannels === 0) {
    throw new TranscriptionFailure({
      code: 'empty-audio',
      message: 'That file does not contain any audio.',
      hint: 'Choose a recording that contains sound.',
    });
  }

  if (buffer.duration > MAX_DURATION_SECONDS) {
    throw new TranscriptionFailure({
      code: 'too-long',
      message: 'This clip is above the current limit.',
      hint: `The limit is ${MAX_DURATION_SECONDS} seconds; this clip is ${buffer.duration.toFixed(
        1
      )} seconds. Trim it or choose a shorter file.`,
    });
  }
}

/** Peak absolute sample value, used to detect silent input. */
export function peakAmplitude(buffer: AudioBuffer): number {
  let peak = 0;
  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    const data = buffer.getChannelData(channel);
    for (let i = 0; i < data.length; i++) {
      const value = Math.abs(data[i]);
      if (value > peak) peak = value;
    }
  }
  return peak;
}

/**
 * Downmix to mono and resample to the model's rate.
 *
 * `OfflineAudioContext` performs both: a one-channel destination makes Web Audio
 * downmix the input, and rendering at `sampleRate` resamples it.
 */
export async function toModelInput(buffer: AudioBuffer): Promise<Float32Array> {
  const frames = Math.max(1, Math.ceil((buffer.duration || 0.01) * MODEL_SAMPLE_RATE));

  if (buffer.numberOfChannels === 1 && buffer.sampleRate === MODEL_SAMPLE_RATE) {
    // Already in the required format; copy so the caller owns the memory.
    return new Float32Array(buffer.getChannelData(0));
  }

  const offline = new OfflineAudioContext(1, frames, MODEL_SAMPLE_RATE);
  const source = offline.createBufferSource();
  source.buffer = buffer;
  source.connect(offline.destination);
  source.start();

  const rendered = await offline.startRendering();
  return new Float32Array(rendered.getChannelData(0));
}
