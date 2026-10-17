import type { BasicPitch } from '@spotify/basic-pitch';
import { MODEL_URL } from './config';
import { TranscriptionFailure } from './types';

/**
 * Lazy loading of the transcription runtime.
 *
 * The model library pulls in TensorFlow.js, which is several megabytes, so it is
 * imported with a dynamic `import()` and only when the user actually starts a
 * transcription. Ordinary landing-page and studio use never downloads it.
 *
 * The model graph is served from this application's own `public/model` directory
 * (copied from the pinned package at build time), never from a third-party CDN.
 *
 * Note on progress: the loader does not expose download percentages, so the UI
 * shows an indeterminate "preparing" state for this stage rather than inventing
 * one. The analysing stage reports a real percentage, because the model's
 * `evaluateModel` reports processed frames.
 */

type ModelFactory = typeof import('@spotify/basic-pitch');

let runtimePromise: Promise<ModelFactory> | null = null;
let modelPromise: Promise<BasicPitch> | null = null;

/** Import the runtime once per tab; later calls reuse the same module instance. */
function loadRuntime(): Promise<ModelFactory> {
  if (!runtimePromise) {
    runtimePromise = import('@spotify/basic-pitch').catch((error) => {
      runtimePromise = null;
      throw new TranscriptionFailure({
        code: 'model-load-failed',
        message: 'The transcription engine could not be loaded.',
        hint: error instanceof Error ? error.message : undefined,
      });
    });
  }
  return runtimePromise;
}

/** Load (and cache) the model graph. Subsequent calls reuse the loaded model. */
export async function loadTranscriber(): Promise<BasicPitch> {
  if (modelPromise) return modelPromise;

  modelPromise = (async () => {
    const { BasicPitch: BasicPitchClass } = await loadRuntime();

    try {
      const transcriber = new BasicPitchClass(MODEL_URL);
      // The constructor kicks off `tf.loadGraphModel`; awaiting the model is what
      // actually resolves the download and compilation.
      await transcriber.model;
      return transcriber;
    } catch (error) {
      throw new TranscriptionFailure({
        code: 'model-load-failed',
        message: 'The transcription model could not be loaded.',
        hint:
          error instanceof Error && error.message
            ? `${error.message} Check your connection and try again.`
            : 'Check your connection and try again.',
      });
    }
  })().catch((error) => {
    modelPromise = null;
    if (error instanceof TranscriptionFailure) throw error;
    throw new TranscriptionFailure({
      code: 'model-load-failed',
      message: 'The transcription engine could not be loaded.',
      hint: error instanceof Error ? error.message : undefined,
    });
  });

  return modelPromise;
}

/** True once a model is loaded and can be reused without another download. */
export function isTranscriberReady(): boolean {
  return modelPromise !== null;
}

/** Drop the cached model reference (used when the user cancels or closes). */
export function releaseTranscriber(): void {
  modelPromise = null;
}
