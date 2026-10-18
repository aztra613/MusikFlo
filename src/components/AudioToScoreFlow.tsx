import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Score } from '../types/music';
import {
  ACCEPTED_EXTENSIONS,
  DETECTION,
  FILE_INPUT_ACCEPT,
  MAX_DURATION_SECONDS,
  MAX_FILE_BYTES,
  formatBytes,
  formatDuration,
} from '../audioTranscription/config';
import { decodeAudioFile, validateFile } from '../audioTranscription/audioDecode';
import { extractMelody, suggestTempo, summariseEvents } from '../audioTranscription/noteEvents';
import { QUANTISE_GRIDS, quantiseEvents } from '../audioTranscription/quantise';
import {
  buildScoreFromTranscription,
  clampTempo,
  gridLabel,
  suggestClef,
  summariseConversion,
} from '../audioTranscription/scoreAdapter';
import { transcribeAudioFile } from '../audioTranscription/transcribe';
import { isTranscriberReady } from '../audioTranscription/modelRuntime';
import {
  QuantiseGrid,
  TranscriptionFailure,
  TranscriptionProgress,
  TranscriptionResult,
  TranscriptionSettings,
} from '../audioTranscription/types';
import { downloadBlob, exportTranscriptionMidi, safeFilename } from '../export/exporter';
import { Clef } from '../types/music';
import { ScorePreview } from './ScorePreview';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  FileAudio,
  Info,
  Loader2,
  Music4,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Upload,
  X,
} from 'lucide-react';

/**
 * Audio to sheet music — the isolated transcription workflow.
 *
 * Additive by design. It owns no application state: it hands a brand-new `Score`
 * to its parent through `onAccept`, and the parent decides how to open it. It
 * never reads or writes the composition already open, so accepting a
 * transcription cannot overwrite existing work.
 */

type Stage = 'upload' | 'preview' | 'configure' | 'processing' | 'review';

/**
 * Above this length the UI warns that analysis may take minutes.
 *
 * Measured in a production build on a CPU-only backend: 2.4 s of audio took
 * ~18.6 s, i.e. roughly 8x realtime. A GPU-accelerated browser is much faster, so
 * this is a warning rather than a hard limit.
 */
const SLOW_CLIP_SECONDS = 20;

export interface AudioToScoreFlowProps {
  /** Receives the newly built score. Must not replace unsaved work silently. */
  onAccept: (score: Score) => void;
  /** Leave the flow without producing a score. */
  onExit: () => void;
  theme: 'light' | 'dark';
  /** Rendered as an overlay inside the studio rather than as a page. */
  embedded?: boolean;
  /** Lets the parent warn about an unsaved project before accepting. */
  describeAcceptance?: (score: Score) => string;
}

const STAGE_ORDER: Stage[] = ['upload', 'preview', 'configure', 'processing', 'review'];

export const AudioToScoreFlow: React.FC<AudioToScoreFlowProps> = ({
  onAccept,
  onExit,
  theme,
  embedded = false,
  describeAcceptance,
}) => {
  const [stage, setStage] = useState<Stage>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [durationSeconds, setDurationSeconds] = useState<number | null>(null);
  const [settings, setSettings] = useState<TranscriptionSettings>({
    bpm: 120,
    timeSignature: { numerator: 4, denominator: 4 },
    grid: 'auto',
    clef: 'treble',
  });
  const [tempoWasSuggested, setTempoWasSuggested] = useState(false);
  const [clefWasSuggested, setClefWasSuggested] = useState(false);
  const [result, setResult] = useState<TranscriptionResult | null>(null);
  const [progress, setProgress] = useState<TranscriptionProgress | null>(null);
  const [error, setError] = useState<{ message: string; hint?: string } | null>(null);
  const [melodyOnly, setMelodyOnly] = useState(true);
  const [isDragging, setIsDragging] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const decodedRef = useRef<AudioBuffer | null>(null);

  // Release the object URL and any decoded audio when the flow closes.
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      decodedRef.current = null;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [objectUrl]);

  const resetInput = useCallback(() => {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    decodedRef.current = null;
    setObjectUrl(null);
    setFile(null);
    setDurationSeconds(null);
    setResult(null);
    setProgress(null);
    setError(null);
    setStage('upload');
  }, [objectUrl]);

  /** Validate and decode a chosen file. Nothing is processed or sent anywhere. */
  const handleFile = useCallback(
    async (candidate: File) => {
      setError(null);

      const invalid = validateFile(candidate);
      if (invalid) {
        setError({ message: invalid.message, hint: invalid.hint });
        return;
      }

      if (objectUrl) URL.revokeObjectURL(objectUrl);
      setFile(candidate);
      setObjectUrl(URL.createObjectURL(candidate));
      setStage('preview');
      setDurationSeconds(null);

      try {
        const decoded = await decodeAudioFile(candidate);
        decodedRef.current = decoded;

        if (decoded.duration > MAX_DURATION_SECONDS) {
          setError({
            message: 'This clip is above the current limit.',
            hint: `The limit is ${MAX_DURATION_SECONDS} seconds; this clip is ${decoded.duration.toFixed(
              1
            )} seconds. Trim it or choose a shorter file.`,
          });
          return;
        }

        setDurationSeconds(decoded.duration);
      } catch (cause) {
        decodedRef.current = null;
        setError(
          cause instanceof TranscriptionFailure
            ? { message: cause.message, hint: cause.hint }
            : { message: 'This file could not be decoded.', hint: 'Try a standard MP3 or WAV file.' }
        );
      }
    },
    [objectUrl]
  );

  const runTranscription = useCallback(async () => {
    if (!file) return;

    setError(null);
    setProgress({ stage: 'decoding', message: 'Decoding audio…' });
    setStage('processing');

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const transcription = await transcribeAudioFile({
        file,
        signal: controller.signal,
        onProgress: setProgress,
        predecoded: decodedRef.current ?? undefined,
      });

      setResult(transcription);

      // Seed review defaults from the estimate, clearly marked as suggestions.
      const summary = summariseEvents(transcription.events);
      const suggested = suggestTempo(transcription.events);
      if (suggested) {
        setSettings((current) => ({ ...current, bpm: clampTempo(suggested) }));
        setTempoWasSuggested(true);
      }
      setSettings((current) => ({ ...current, clef: suggestClef(transcription.events) }));
      setClefWasSuggested(true);

      // Only pre-select melody extraction when the clip actually contains
      // simultaneous notes, and say so in the review step.
      setMelodyOnly(summary.overlappingEvents > 0);
      setStage('review');
    } catch (cause) {
      if (cause instanceof TranscriptionFailure && cause.code === 'cancelled') {
        setProgress(null);
        setStage('configure');
        return;
      }
      setError(
        cause instanceof TranscriptionFailure
          ? { message: cause.message, hint: cause.hint }
          : { message: 'Transcription could not finish on this device.', hint: 'Try a shorter clip.' }
      );
      setProgress(null);
      setStage('configure');
    } finally {
      abortRef.current = null;
    }
  }, [file]);

  const handleCancel = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  /* ---------------------- derived transcription views ---------------------- */

  const rawEvents = result?.events ?? [];
  const noteSummary = useMemo(() => summariseEvents(rawEvents), [rawEvents]);
  // Only genuine simultaneities trigger the warning; a legato tail does not.
  const polyphonic = noteSummary.significantOverlaps > 0;

  /** What we will actually notate: the estimate, optionally reduced to a melody. */
  const melody = useMemo(
    () => (rawEvents.length > 0 ? extractMelody(rawEvents) : { events: [], removedCount: 0, trimmedCount: 0 }),
    [rawEvents]
  );

  const notatedEvents = useMemo(() => {
    // With no genuine simultaneity there is nothing to reduce. With one, the
    // user's explicit choice decides whether the lower notes are removed or the
    // score is built from the raw events (which the quantiser then reconciles
    // into a single line, disclosed in the summary below).
    return polyphonic && melodyOnly ? melody.events : rawEvents;
  }, [polyphonic, melodyOnly, melody, rawEvents]);

  const report = useMemo(
    () => (notatedEvents.length > 0 ? quantiseEvents(notatedEvents, settings) : null),
    [notatedEvents, settings]
  );

  const candidateScore = useMemo(
    () =>
      report && file
        ? buildScoreFromTranscription({ report, settings, sourceName: file.name })
        : null,
    [report, settings, file]
  );

  const conversion = useMemo(
    () => (report ? summariseConversion(notatedEvents, report, settings.timeSignature) : null),
    [report, notatedEvents, settings.timeSignature]
  );

  const handleAccept = useCallback(() => {
    if (candidateScore) onAccept(candidateScore);
  }, [candidateScore, onAccept]);

  const downloadRawMidi = useCallback(() => {
    if (!result || !file) return;
    const blob = exportTranscriptionMidi(result.events, settings.bpm);
    downloadBlob(blob, safeFilename(file.name.replace(/\.[^.]+$/, ''), 'transcription', 'mid'));
  }, [result, file, settings.bpm]);

  /* ----------------------------- presentation ----------------------------- */

  const totalSeconds = durationSeconds;
  const stageIndex = STAGE_ORDER.indexOf(stage);

  return (
    <div
      className={
        embedded
          ? 'flex flex-col w-full max-w-3xl max-h-[90vh] overflow-hidden rounded-2xl bg-surface-raised border border-border shadow-2xl'
          : 'flex flex-col w-full max-w-3xl mx-auto'
      }
      role="region"
      aria-label="Convert audio to sheet music"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-4 px-6 py-4 border-b border-border bg-surface">
        <div className="flex items-start gap-2.5">
          <span className="w-8 h-8 rounded-lg bg-primary-soft text-primary flex items-center justify-center shrink-0">
            <Music4 size={17} aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-base font-bold text-text-primary">Convert audio to sheet music</h2>
            <p className="text-xs text-text-secondary mt-0.5">
              Turn a short recording into editable notation.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onExit}
          className="p-1 rounded-md text-text-muted hover:text-text-primary hover:bg-app-bg transition-colors"
          aria-label="Close audio to sheet music"
        >
          <X size={18} />
        </button>
      </div>

      {/* Progress rail */}
      <ol className="flex items-center gap-1 px-6 py-2 border-b border-border bg-app-bg text-[11px] text-text-muted">
        {STAGE_ORDER.map((step, index) => {
          const active = index === stageIndex;
          const done = index < stageIndex;
          return (
            <li key={step} className="flex items-center gap-1">
              <span
                className={`px-1.5 py-0.5 rounded ${
                  active
                    ? 'bg-primary-soft text-primary font-semibold'
                    : done
                      ? 'text-text-primary'
                      : 'text-text-muted'
                }`}
                aria-current={active ? 'step' : undefined}
              >
                {index + 1}. {step === 'processing' ? 'Analyse' : step.charAt(0).toUpperCase() + step.slice(1)}
              </span>
              {index < STAGE_ORDER.length - 1 && <span aria-hidden="true">·</span>}
            </li>
          );
        })}
      </ol>

      <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-5">
        {/* Errors are announced and never include a stack trace. */}
        {error && (
          <div role="alert" className="flex items-start gap-2.5 p-3 rounded-lg bg-danger-bg border border-danger/40">
            <AlertTriangle size={15} className="text-danger mt-0.5 shrink-0" aria-hidden="true" />
            <div className="text-xs">
              <p className="font-semibold text-danger">{error.message}</p>
              {error.hint && <p className="text-text-secondary mt-0.5">{error.hint}</p>}
            </div>
          </div>
        )}

        {/* ---------------------------- 1. Upload ---------------------------- */}
        {stage === 'upload' && (
          <div className="flex flex-col gap-4">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              onDragOver={(event) => {
                event.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(event) => {
                event.preventDefault();
                setIsDragging(false);
                const dropped = event.dataTransfer.files?.[0];
                // A drop only chooses the file; it never starts processing.
                if (dropped) void handleFile(dropped);
              }}
              className={`flex flex-col items-center justify-center gap-2 p-8 rounded-xl border-2 border-dashed transition-colors text-center ${
                isDragging ? 'border-primary bg-primary-soft' : 'border-border bg-app-bg hover:border-primary/60'
              }`}
            >
              <Upload size={22} className="text-primary" aria-hidden="true" />
              <span className="text-sm font-semibold text-text-primary">Choose an MP3 or WAV file</span>
              <span className="text-xs text-text-muted">
                or drag a file here · up to {Math.round(MAX_FILE_BYTES / (1024 * 1024))} MiB and{' '}
                {MAX_DURATION_SECONDS} seconds
              </span>
            </button>

            <input
              ref={inputRef}
              type="file"
              accept={FILE_INPUT_ACCEPT}
              className="hidden"
              aria-label="Audio file"
              onChange={(event) => {
                const chosen = event.target.files?.[0];
                event.target.value = '';
                if (chosen) void handleFile(chosen);
              }}
            />

            <div className="flex items-start gap-2.5 p-3 rounded-lg bg-app-bg border border-border">
              <ShieldCheck size={15} className="text-success mt-0.5 shrink-0" aria-hidden="true" />
              <p className="text-xs text-text-secondary leading-relaxed">
                Your audio is analysed on this device and is <strong className="text-text-primary">not uploaded</strong> to a
                MusikFlo server. The transcription model itself is downloaded once from this site, which is separate from
                your recording.
              </p>
            </div>

            <div className="flex items-start gap-2.5 p-3 rounded-lg bg-app-bg border border-border">
              <Info size={15} className="text-text-muted mt-0.5 shrink-0" aria-hidden="true" />
              <p className="text-xs text-text-secondary leading-relaxed">
                Best results usually come from a clear, melody-focused recording. Mixed songs contain overlapping
                instruments and may produce missing or extra notes. The result is an estimate — review it before
                exporting. Accepted formats: {ACCEPTED_EXTENSIONS.join(', ')}.
              </p>
            </div>
          </div>
        )}

        {/* ---------------------------- 2. Preview --------------------------- */}
        {stage === 'preview' && file && (
          <div className="flex flex-col gap-4">
            <div className="p-4 rounded-xl bg-app-bg border border-border">
              <div className="flex items-start gap-3">
                <FileAudio size={18} className="text-primary mt-0.5 shrink-0" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-text-primary truncate" title={file.name}>
                    {file.name}
                  </p>
                  <p className="text-xs text-text-muted mt-0.5">
                    {formatBytes(file.size)}
                    {totalSeconds !== null && ` · ${formatDuration(totalSeconds)}`}
                    {totalSeconds === null && ' · decoding…'}
                  </p>
                </div>
              </div>

              {objectUrl && (
                <audio
                  controls
                  src={objectUrl}
                  className="w-full mt-3"
                  aria-label={`Audio preview of ${file.name}`}
                />
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="px-3 py-2 text-xs font-medium rounded-lg border border-border bg-surface hover:bg-app-bg text-text-primary transition-colors"
              >
                Replace file
              </button>
              <button
                type="button"
                onClick={resetInput}
                className="px-3 py-2 text-xs font-medium rounded-lg border border-border bg-surface hover:bg-app-bg text-text-secondary transition-colors"
              >
                Remove
              </button>
              <input
                ref={inputRef}
                type="file"
                accept={FILE_INPUT_ACCEPT}
                className="hidden"
                aria-label="Replace audio file"
                onChange={(event) => {
                  const chosen = event.target.files?.[0];
                  event.target.value = '';
                  if (chosen) void handleFile(chosen);
                }}
              />
            </div>
          </div>
        )}

        {/* --------------------------- 3. Configure -------------------------- */}
        {stage === 'configure' && (
          <div className="flex flex-col gap-4">
            <div className="flex items-start gap-2.5 p-3 rounded-lg bg-primary-soft border border-primary/20">
              <Info size={15} className="text-primary mt-0.5 shrink-0" aria-hidden="true" />
              <p className="text-xs text-primary leading-relaxed">
                Melody-focused transcription. Settings below shape the notation; you can change them again after
                analysing without re-running the model.
              </p>
            </div>

            <div className="flex items-start gap-2.5 p-3 rounded-lg bg-surface border border-brass/30">
              <Sparkles size={15} className="text-brass mt-0.5 shrink-0" aria-hidden="true" />
              <p className="text-xs text-text-secondary leading-relaxed">
                <strong className="text-text-primary">Vocal, solo, or Indian classical (raga) audio:</strong> Set the Tempo (BPM) to match your song's pulse, and select <strong className="text-text-primary">Eighth notes</strong> or <strong className="text-text-primary">Quarter notes</strong> in the Rhythm grid to filter out vibrato, pitch glides (gamakas/meend), and microtonal jitter.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="flex flex-col gap-1.5 text-xs">
                <span className="font-semibold text-text-secondary">Tempo (BPM)</span>
                <input
                  type="number"
                  min={40}
                  max={240}
                  value={settings.bpm}
                  onChange={(event) =>
                    setSettings((current) => ({
                      ...current,
                      bpm: clampTempo(Number(event.target.value) || current.bpm),
                    }))
                  }
                  className="px-2 py-1.5 rounded-md bg-app-bg border border-border text-text-primary"
                />
                <span className="text-[11px] text-text-muted">
                  {tempoWasSuggested ? 'Estimated from the recording; adjust if it sounds wrong.' : 'Used for all notation timing.'}
                </span>
              </label>

              <label className="flex flex-col gap-1.5 text-xs">
                <span className="font-semibold text-text-secondary">Time signature</span>
                <select
                  value={`${settings.timeSignature.numerator}/${settings.timeSignature.denominator}`}
                  onChange={(event) => {
                    const [numerator, denominator] = event.target.value.split('/').map(Number);
                    setSettings((current) => ({ ...current, timeSignature: { numerator, denominator } }));
                  }}
                  className="px-2 py-1.5 rounded-md bg-app-bg border border-border text-text-primary"
                >
                  {['4/4', '3/4', '2/4', '2/2', '6/8', '3/8', '5/4'].map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
                <span className="text-[11px] text-text-muted">
                  Not detected automatically — MusikFlo does not claim meter inference.
                </span>
              </label>

              <label className="flex flex-col gap-1.5 text-xs">
                <span className="font-semibold text-text-secondary">Rhythm grid</span>
                <select
                  value={settings.grid}
                  onChange={(event) =>
                    setSettings((current) => ({ ...current, grid: event.target.value as QuantiseGrid }))
                  }
                  className="px-2 py-1.5 rounded-md bg-app-bg border border-border text-text-primary"
                >
                  {QUANTISE_GRIDS.map((grid) => (
                    <option key={grid.id} value={grid.id}>
                      {grid.label} — {grid.description}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1.5 text-xs">
                <span className="font-semibold text-text-secondary">Clef</span>
                <select
                  value={settings.clef}
                  onChange={(event) => {
                    setClefWasSuggested(false);
                    setSettings((current) => ({ ...current, clef: event.target.value as Clef }));
                  }}
                  className="px-2 py-1.5 rounded-md bg-app-bg border border-border text-text-primary"
                >
                  <option value="treble">Treble</option>
                  <option value="bass">Bass</option>
                </select>
                <span className="text-[11px] text-text-muted">
                  {clefWasSuggested ? 'Suggested from the detected range.' : 'Chosen by you.'}
                </span>
              </label>
            </div>

            {/* Measured: the model ran at roughly 8x realtime on a CPU-only
                backend, so long clips are worth an honest warning up front. */}
            {durationSeconds !== null && durationSeconds > SLOW_CLIP_SECONDS && (
              <div className="flex items-start gap-2.5 p-3 rounded-lg bg-warning-bg border border-warning/40">
                <AlertTriangle size={15} className="text-warning mt-0.5 shrink-0" aria-hidden="true" />
                <p className="text-xs text-text-secondary leading-relaxed">
                  This clip is {formatDuration(durationSeconds)} long. Analysis runs entirely on this device, and on
                  devices without graphics acceleration it can take several minutes. You can cancel at any point, or
                  choose a shorter clip for a quicker result.
                </p>
              </div>
            )}
          </div>
        )}

        {/* -------------------------- 4. Processing -------------------------- */}
        {stage === 'processing' && (
          <div className="flex flex-col gap-4" aria-live="polite">
            <div className="flex items-center gap-3">
              <Loader2 size={18} className="text-primary animate-spin shrink-0" aria-hidden="true" />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-text-primary" role="status">
                  {progress?.message ?? 'Preparing…'}
                </p>
                <p className="text-xs text-text-muted mt-0.5">
                  {progress?.stage === 'loading-model' && !isTranscriberReady()
                    ? 'The model is downloaded once, then reused in this tab.'
                    : 'Running on this device. Nothing is uploaded.'}
                </p>
              </div>
            </div>

            {/* Only shown where the runtime reports a measurable percentage. */}
            {typeof progress?.percent === 'number' ? (
              <div
                className="w-full h-2 rounded-full bg-app-bg border border-border overflow-hidden"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(progress.percent * 100)}
                aria-label="Analysing audio"
              >
                <div
                  className="h-full bg-primary transition-[width] duration-200"
                  style={{ width: `${Math.round(progress.percent * 100)}%` }}
                />
              </div>
            ) : (
              <div className="w-full h-2 rounded-full bg-app-bg border border-border overflow-hidden">
                <div className="h-full w-1/3 bg-primary/60 animate-pulse" />
              </div>
            )}

            <button
              type="button"
              onClick={handleCancel}
              className="self-start px-3 py-2 text-xs font-medium rounded-lg border border-border bg-surface hover:bg-app-bg text-text-primary transition-colors"
            >
              Cancel
            </button>
          </div>
        )}

        {/* ----------------------------- 5. Review --------------------------- */}
        {stage === 'review' && result && (
          <div className="flex flex-col gap-4">
            {polyphonic && (
              <div className="flex items-start gap-2.5 p-3 rounded-lg bg-warning-bg border border-warning/40">
                <AlertTriangle size={15} className="text-warning mt-0.5 shrink-0" aria-hidden="true" />
                <div className="text-xs text-text-secondary leading-relaxed">
                  <p className="font-semibold text-warning">
                    This recording holds notes that sound together ({noteSummary.significantOverlaps} of{' '}
                    {noteSummary.noteCount}).
                  </p>
                  <p className="mt-1">
                    The score editor writes one line of music, so it cannot represent a complete multi-voice
                    arrangement. Nothing is removed unless you choose to. Your options:
                  </p>
                  <div className="mt-2 flex flex-col gap-1.5">
                    <label className="flex items-start gap-2">
                      <input
                        type="radio"
                        name="polyphony"
                        className="mt-0.5 accent-primary"
                        checked={melodyOnly}
                        onChange={() => setMelodyOnly(true)}
                      />
                      <span>
                        <strong className="text-text-primary">Simplify to a single melody line</strong> — keeps the highest
                        note where several sound together, and cuts the lower note where a higher one begins.
                      </span>
                    </label>
                    <label className="flex items-start gap-2">
                      <input
                        type="radio"
                        name="polyphony"
                        className="mt-0.5 accent-primary"
                        checked={!melodyOnly}
                        onChange={() => setMelodyOnly(false)}
                      />
                      <span>
                        <strong className="text-text-primary">Keep every detected note</strong> — notes that sound together
                        cannot be notated here, so the score will show a shortened, single line. Download the raw
                        transcription as MIDI instead if you need the full timing.
                      </span>
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* Detected note summary */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <Stat label="Detected notes" value={String(noteSummary.noteCount)} />
              <Stat label="Notated notes" value={String(notatedEvents.length)} />
              <Stat label="Measures" value={conversion ? String(conversion.measures) : '—'} />
              <Stat label="Bars per staff" value={`${settings.timeSignature.numerator}/${settings.timeSignature.denominator}`} />
            </div>

            {candidateScore && <ScorePreview score={candidateScore} theme={theme} zoom={0.8} />}

            {/* Honest conversion summary */}
            {conversion && (
              <div className="p-3 rounded-lg bg-app-bg border border-border text-xs text-text-secondary leading-relaxed">
                <p className="font-semibold text-text-primary mb-1">What the conversion did</p>
                <ul className="list-disc list-inside space-y-0.5">
                  <li>
                    Rhythm snapped to <strong className="text-text-primary">{gridLabel(report?.gridTicks ?? 240)}</strong> at{' '}
                    {settings.bpm} BPM; mean timing change {conversion.meanTimingErrorMs.toFixed(0)} ms (worst{' '}
                    {conversion.maxTimingErrorMs.toFixed(0)} ms).
                  </li>
                  {conversion.simplified ? (
                    <li>Some note lengths or onsets had to be rounded to the grid — the notation is an approximation.</li>
                  ) : (
                    <li>Every detected onset landed exactly on the selected grid.</li>
                  )}
                  {conversion.truncatedNotes > 0 && (
                    <li>
                      {conversion.truncatedNotes} note{conversion.truncatedNotes === 1 ? '' : 's'} shortened because they
                      would otherwise cross a barline.
                    </li>
                  )}
                  {conversion.insertedRests > 0 && (
                    <li>{conversion.insertedRests} rests added so every bar is complete.</li>
                  )}
                  {conversion.droppedEvents > 0 && (
                    <li className="text-danger">
                      {conversion.droppedEvents} detected notes were beyond the {settings.timeSignature.numerator}/
                      {settings.timeSignature.denominator} measure limit and are not in the score.
                    </li>
                  )}
                  {polyphonic && (
                    <li>
                      Melody line reduction: {melody.trimmedCount} note
                      {melody.trimmedCount === 1 ? '' : 's'} shortened where a later note began
                      {melody.removedCount > 0 && <>, {melody.removedCount} lower note{melody.removedCount === 1 ? '' : 's'} removed</>}
                      .
                    </li>
                  )}
                </ul>
              </div>
            )}

            {/* Re-quantise without re-running inference */}
            <details className="p-3 rounded-lg bg-app-bg border border-border text-xs">
              <summary className="font-semibold text-text-primary cursor-pointer">
                Adjust tempo, meter, grid or clef
              </summary>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                <label className="flex flex-col gap-1">
                  <span className="font-semibold text-text-secondary">Tempo (BPM)</span>
                  <input
                    type="number"
                    min={40}
                    max={240}
                    value={settings.bpm}
                    onChange={(event) =>
                      setSettings((current) => ({
                        ...current,
                        bpm: clampTempo(Number(event.target.value) || current.bpm),
                      }))
                    }
                    className="px-2 py-1.5 rounded-md bg-surface border border-border text-text-primary"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="font-semibold text-text-secondary">Time signature</span>
                  <select
                    value={`${settings.timeSignature.numerator}/${settings.timeSignature.denominator}`}
                    onChange={(event) => {
                      const [numerator, denominator] = event.target.value.split('/').map(Number);
                      setSettings((current) => ({ ...current, timeSignature: { numerator, denominator } }));
                    }}
                    className="px-2 py-1.5 rounded-md bg-surface border border-border text-text-primary"
                  >
                    {['4/4', '3/4', '2/4', '2/2', '6/8', '3/8', '5/4'].map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1">
                  <span className="font-semibold text-text-secondary">Rhythm grid</span>
                  <select
                    value={settings.grid}
                    onChange={(event) =>
                      setSettings((current) => ({ ...current, grid: event.target.value as QuantiseGrid }))
                    }
                    className="px-2 py-1.5 rounded-md bg-surface border border-border text-text-primary"
                  >
                    {QUANTISE_GRIDS.map((grid) => (
                      <option key={grid.id} value={grid.id}>
                        {grid.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1">
                  <span className="font-semibold text-text-secondary">Clef</span>
                  <select
                    value={settings.clef}
                    onChange={(event) => setSettings((current) => ({ ...current, clef: event.target.value as Clef }))}
                    className="px-2 py-1.5 rounded-md bg-surface border border-border text-text-primary"
                  >
                    <option value="treble">Treble</option>
                    <option value="bass">Bass</option>
                  </select>
                </label>
              </div>
            </details>

            <p className="text-[11px] text-text-muted leading-relaxed">
              Diagnostics: {DETECTION.minNoteLengthFrames}-frame minimum note · decode{' '}
              {Math.round(result.diagnostics.decodeMs)} ms · resample {Math.round(result.diagnostics.resampleMs)} ms · model{' '}
              {Math.round(result.diagnostics.modelLoadMs)} ms · inference {Math.round(result.diagnostics.inferenceMs)} ms ·{' '}
              {result.diagnostics.inputSampleRate} Hz → {result.diagnostics.outputSampleRate} Hz.
            </p>
          </div>
        )}
      </div>

      {/* Footer actions */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-3 border-t border-border bg-surface">
        <div className="flex items-center gap-2">
          {stage !== 'upload' && stage !== 'processing' && (
            <button
              type="button"
              onClick={() => setStage(stage === 'review' ? 'configure' : 'upload')}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-border bg-surface hover:bg-app-bg text-text-secondary transition-colors"
            >
              <ArrowLeft size={13} />
              Back
            </button>
          )}
          {stage === 'review' && (
            <button
              type="button"
              onClick={downloadRawMidi}
              className="px-3 py-2 text-xs font-medium rounded-lg border border-border bg-surface hover:bg-app-bg text-text-primary transition-colors"
              title="Download every detected note with its original timing, as MIDI"
            >
              Download raw MIDI
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {stage === 'preview' && (
            <button
              type="button"
              onClick={() => setStage('configure')}
              disabled={durationSeconds === null || !!error}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-primary text-white hover:bg-primary-hover disabled:opacity-40 transition-colors"
            >
              Continue
              <ArrowRight size={13} />
            </button>
          )}

          {stage === 'configure' && (
            <button
              type="button"
              onClick={() => void runTranscription()}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-primary text-white hover:bg-primary-hover transition-colors"
            >
              <Music4 size={13} />
              Transcribe audio
            </button>
          )}

          {stage === 'review' && (
            <>
              <button
                type="button"
                onClick={() => {
                  resetInput();
                  setResult(null);
                }}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-border bg-surface hover:bg-app-bg text-text-secondary transition-colors"
              >
                <RotateCcw size={13} />
                Start over
              </button>
              <button
                type="button"
                onClick={handleAccept}
                disabled={!candidateScore}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-primary text-white hover:bg-primary-hover disabled:opacity-40 transition-colors"
              >
                <CheckCircle2 size={13} />
                Open as new score
              </button>
            </>
          )}
        </div>
      </div>

      {stage === 'review' && describeAcceptance && candidateScore && (
        <p className="px-6 pb-4 -mt-1 text-[11px] text-text-muted">{describeAcceptance(candidateScore)}</p>
      )}
    </div>
  );
};

const Stat: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="p-2.5 rounded-lg bg-app-bg border border-border">
    <span className="block text-[10px] uppercase tracking-wider text-text-muted font-semibold">{label}</span>
    <span className="block text-sm font-bold text-text-primary font-mono">{value}</span>
  </div>
);
