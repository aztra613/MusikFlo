import { DETECTION, MODEL_SAMPLE_RATE } from './config';
import { assertUsableBuffer, decodeAudioFile, peakAmplitude, toModelInput } from './audioDecode';
import { loadTranscriber } from './modelRuntime';
import { countOverlappingEvents, normaliseNoteEvents } from './noteEvents';
import {
  RawNoteEvent,
  TranscriptionFailure,
  TranscriptionProgress,
  TranscriptionResult,
} from './types';

/** Thrown internally to unwind the model's frame loop when the user cancels. */
const CANCELLED = Symbol('transcription-cancelled');

/** Silence below this peak is treated as containing no playable audio. */
const SILENCE_PEAK = 0.005;

export interface TranscribeOptions {
  file: File;
  signal?: AbortSignal;
  onProgress?: (progress: TranscriptionProgress) => void;
  /**
   * Audio already decoded by the preview step. Avoids decoding the same file
   * twice; decoding is also how the preview proves the file is readable.
   */
  predecoded?: AudioBuffer;
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new TranscriptionFailure({ code: 'cancelled', message: 'Transcription cancelled.' });
  }
}

function now(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

/**
 * Decode a local audio file and estimate its note events, entirely on device.
 *
 * The model's `evaluateModel` reports processed frames through a callback, which
 * is the only cancellation hook it exposes: throwing from that callback unwinds
 * the frame loop. Cancellation is therefore documented as "stop between frames",
 * not as an instant abort of an in-flight frame.
 */
export async function transcribeAudioFile({
  file,
  signal,
  onProgress,
  predecoded,
}: TranscribeOptions): Promise<TranscriptionResult> {
  const startedAt = now();

  throwIfAborted(signal);
  onProgress?.({ stage: 'decoding', message: 'Decoding audio…' });

  const decoded = predecoded ?? (await decodeAudioFile(file));
  assertUsableBuffer(decoded);

  const peak = peakAmplitude(decoded);
  if (peak < SILENCE_PEAK) {
    throw new TranscriptionFailure({
      code: 'empty-audio',
      message: 'No clear notes were detected in this clip.',
      hint: 'It sounds silent. Try a cleaner or melody-focused recording.',
    });
  }

  const decodeMs = now() - startedAt;
  throwIfAborted(signal);

  const resampleStart = now();
  const modelInput = await toModelInput(decoded);
  const resampleMs = now() - resampleStart;
  throwIfAborted(signal);

  onProgress?.({ stage: 'loading-model', message: 'Preparing transcription engine…' });
  const modelLoadStart = now();
  const transcriber = await loadTranscriber();
  const modelLoadMs = now() - modelLoadStart;
  throwIfAborted(signal);

  onProgress?.({ stage: 'analysing', message: 'Analysing audio…', percent: 0 });

  const frames: number[][] = [];
  const onsets: number[][] = [];
  const contours: number[][] = [];
  let modelFrames = 0;
  const inferenceStart = now();

  try {
    await transcriber.evaluateModel(
      modelInput,
      (frameChunk, onsetChunk, contourChunk) => {
        frames.push(...frameChunk);
        onsets.push(...onsetChunk);
        contours.push(...contourChunk);
        modelFrames += frameChunk.length;
      },
      (fraction) => {
        // Cancellation point: throwing here unwinds the model's frame loop.
        if (signal?.aborted) throw CANCELLED;
        onProgress?.({
          stage: 'analysing',
          message: 'Analysing audio…',
          percent: Math.max(0, Math.min(1, fraction)),
        });
      }
    );
  } catch (error) {
    if (error === CANCELLED || signal?.aborted) {
      throw new TranscriptionFailure({ code: 'cancelled', message: 'Transcription cancelled.' });
    }
    throw new TranscriptionFailure({
      code: 'inference-failed',
      message: 'Transcription could not finish on this device.',
      hint: 'Try a shorter clip, or close other tabs to free memory.',
    });
  }

  const inferenceMs = now() - inferenceStart;
  throwIfAborted(signal);

  onProgress?.({ stage: 'normalising', message: 'Reading note events…' });

  const { outputToNotesPoly, addPitchBendsToNoteEvents, noteFramesToTime } = await import(
    '@spotify/basic-pitch'
  );

  let timed: Array<{ startTimeSeconds: number; durationSeconds: number; pitchMidi: number; amplitude: number }> = [];
  try {
    const detected = outputToNotesPoly(
      frames,
      onsets,
      DETECTION.onsetThreshold,
      DETECTION.frameThreshold,
      DETECTION.minNoteLengthFrames,
      DETECTION.inferOnsets
    );
    const withBends = addPitchBendsToNoteEvents(contours, detected);
    timed = noteFramesToTime(withBends);
  } catch {
    throw new TranscriptionFailure({
      code: 'inference-failed',
      message: 'The detected notes could not be read.',
      hint: 'Try a shorter or clearer clip.',
    });
  }

  const events: RawNoteEvent[] = normaliseNoteEvents(
    timed.map((note) => ({
      startSeconds: note.startTimeSeconds,
      durationSeconds: note.durationSeconds,
      midi: note.pitchMidi,
      amplitude: note.amplitude,
    })),
    { clipDurationSeconds: decoded.duration }
  );

  if (events.length === 0) {
    throw new TranscriptionFailure({
      code: 'no-notes',
      message: 'No clear notes were detected.',
      hint: 'Try a cleaner or melody-focused recording, and make sure one instrument is prominent.',
    });
  }

  onProgress?.({ stage: 'done', message: `Detected ${events.length} notes.`, percent: 1 });

  return {
    events,
    durationSeconds: decoded.duration,
    overlappingEvents: countOverlappingEvents(events),
    diagnostics: {
      decodeMs,
      resampleMs,
      modelLoadMs,
      inferenceMs,
      modelFrames,
      inputSampleRate: decoded.sampleRate,
      outputSampleRate: MODEL_SAMPLE_RATE,
    },
  };
}
