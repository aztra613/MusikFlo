/**
 * Audio-to-sheet-music — configuration and guardrails.
 *
 * These are pilot limits, not permanent product guarantees. They are deliberately
 * collected here so they can be revised against measured browser performance
 * without hunting through the feature.
 */

/** Source file size ceiling. */
export const MAX_FILE_BYTES = 20 * 1024 * 1024; // 20 MiB

/** Decoded duration ceiling. */
export const MAX_DURATION_SECONDS = 60;

/** File extensions offered in the picker and accepted for validation. */
export const ACCEPTED_EXTENSIONS = ['.mp3', '.wav'] as const;

/** `accept` attribute for the file input. */
export const FILE_INPUT_ACCEPT = '.mp3,.wav,audio/mpeg,audio/wav,audio/x-wav,audio/wave';

/**
 * Sample rate the transcription model requires. Audio is resampled to this
 * before inference; the model rejects anything else.
 */
export const MODEL_SAMPLE_RATE = 22050;

/** Model graph location, served as a pinned static asset from our own origin. */
export const MODEL_URL = `${import.meta.env.BASE_URL}model/model.json`;

/** Note-detection thresholds passed to the model's post-processing. */
export const DETECTION = {
  onsetThreshold: 0.5,
  frameThreshold: 0.3,
  /** Minimum note length in model frames (~11.6 ms each). */
  minNoteLengthFrames: 6,
  inferOnsets: true,
} as const;

/** Highest number of measures a transcription may produce before truncation. */
export const MAX_TRANSCRIPTION_MEASURES = 64;

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KiB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;
}

export function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  return `${minutes}:${String(rest).padStart(2, '0')}`;
}
