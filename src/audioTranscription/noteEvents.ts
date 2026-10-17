import { RawNoteEvent } from './types';

/**
 * Normalising estimated note events.
 *
 * Pure functions only, so the interesting behaviour (sorting, rejecting broken
 * values, detecting simultaneous notes, and reducing to a melody) is unit
 * testable without an audio device or the model.
 */

/** Lowest and highest MIDI notes the score model can represent sensibly. */
const MIDI_MIN = 21; // A0
const MIDI_MAX = 108; // C8

export interface NormaliseOptions {
  /** Clip duration; events past this point are discarded as model artefacts. */
  clipDurationSeconds?: number;
}

/**
 * Sort events by onset, drop impossible values, and clamp anything that runs
 * past the end of the clip. Timing is preserved exactly as inferred.
 */
export function normaliseNoteEvents(
  events: Array<{ startSeconds: number; durationSeconds: number; midi: number; amplitude?: number }>,
  options: NormaliseOptions = {}
): RawNoteEvent[] {
  const limit = options.clipDurationSeconds;

  return events
    .filter(
      (event) =>
        Number.isFinite(event.startSeconds) &&
        Number.isFinite(event.durationSeconds) &&
        Number.isFinite(event.midi) &&
        event.durationSeconds > 0 &&
        event.startSeconds >= 0 &&
        event.midi >= MIDI_MIN &&
        event.midi <= MIDI_MAX
    )
    .map((event) => {
      const startSeconds = Math.max(0, event.startSeconds);
      const unclampedEnd = startSeconds + event.durationSeconds;
      const endSeconds = limit !== undefined ? Math.min(unclampedEnd, limit) : unclampedEnd;

      return {
        startSeconds,
        durationSeconds: Math.max(0.01, endSeconds - startSeconds),
        endSeconds,
        midi: Math.round(event.midi),
        confidence: clamp01(event.amplitude ?? 1),
      };
    })
    .filter((event) => event.durationSeconds > 0)
    .sort((a, b) => a.startSeconds - b.startSeconds || a.midi - b.midi);
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

/**
 * How many events sound at the same time as another event.
 *
 * The score model stores events sequentially and cannot express simultaneous
 * onsets, so this count is what drives the "melody only" decision shown during
 * review. Nothing is dropped based on it without the user choosing.
 */
export function countOverlappingEvents(events: RawNoteEvent[]): number {
  const ordered = events
    .map((event, index) => ({ event, index }))
    .sort((a, b) => a.event.startSeconds - b.event.startSeconds);

  const overlapping = new Set<number>();
  let active: Array<{ event: RawNoteEvent; index: number }> = [];

  for (const item of ordered) {
    // Retire notes that have already finished before this one starts.
    active = active.filter((candidate) => candidate.event.endSeconds > item.event.startSeconds + 1e-6);

    if (active.length > 0) {
      overlapping.add(item.index);
      active.forEach((candidate) => overlapping.add(candidate.index));
    }

    active.push(item);
  }

  return overlapping.size;
}

export interface MelodyExtractionResult {
  events: RawNoteEvent[];
  /** Events removed because a higher note was sounding at the same time. */
  removedCount: number;
  /** Events shortened because a later note began while they were sounding. */
  trimmedCount: number;
}

/**
 * Reduce polyphonic output to a single melodic line.
 *
 * Overlapping notes are grouped into clusters; the highest note in each cluster
 * wins, and clusters are trimmed so the result is strictly monophonic. This is
 * an explicit, documented reduction — it is only ever applied when the user
 * chooses "melody only", never silently.
 */
export function extractMelody(events: RawNoteEvent[]): MelodyExtractionResult {
  if (events.length === 0) return { events: [], removedCount: 0, trimmedCount: 0 };

  const sorted = [...events].sort((a, b) => a.startSeconds - b.startSeconds || b.midi - a.midi);
  const kept: RawNoteEvent[] = [];
  let removedCount = 0;
  let trimmedCount = 0;

  for (const event of sorted) {
    const previous = kept[kept.length - 1];

    if (!previous || event.startSeconds >= previous.endSeconds - 1e-6) {
      kept.push({ ...event });
      continue;
    }

    // Overlaps the previous note: keep the higher pitch, and cut the shorter one
    // off at the moment the next note starts so the line stays monophonic.
    if (event.midi > previous.midi) {
      previous.durationSeconds = Math.max(0.01, event.startSeconds - previous.startSeconds);
      previous.endSeconds = event.startSeconds;
      trimmedCount++;
      kept.push({ ...event });
    } else {
      removedCount++;
    }
  }

  return { events: kept.filter((event) => event.durationSeconds > 0.01), removedCount, trimmedCount };
}

/**
 * Overlap long enough to be a real simultaneity rather than the natural tail of
 * one note decaying into the next.
 *
 * Measured on a legato fixture: a plucked melody whose tones ring 10% past their
 * written length produced 160 ms overlaps, which are not a chord. A chord holds
 * for a large fraction of the note.
 */
export const SIGNIFICANT_OVERLAP_SECONDS = 0.15;
export const SIGNIFICANT_OVERLAP_FRACTION = 0.3;

/**
 * Count events that genuinely sound together, ignoring legato tails.
 *
 * This — not {@link countOverlappingEvents} — is what drives the "this recording
 * contains simultaneous notes" warning. `countOverlappingEvents` stays useful as a
 * raw diagnostic.
 */
export function countSignificantOverlaps(
  events: RawNoteEvent[],
  minimumSeconds = SIGNIFICANT_OVERLAP_SECONDS,
  minimumFraction = SIGNIFICANT_OVERLAP_FRACTION
): number {
  const significant = new Set<number>();
  const ordered = events
    .map((event, index) => ({ event, index }))
    .sort((a, b) => a.event.startSeconds - b.event.startSeconds);

  let active: Array<{ event: RawNoteEvent; index: number }> = [];

  for (const item of ordered) {
    active = active.filter((candidate) => candidate.event.endSeconds > item.event.startSeconds + 1e-6);

    for (const candidate of active) {
      const overlap = Math.min(candidate.event.endSeconds, item.event.endSeconds) - item.event.startSeconds;
      const shorter = Math.min(candidate.event.durationSeconds, item.event.durationSeconds);
      if (overlap >= minimumSeconds && overlap >= shorter * minimumFraction) {
        significant.add(item.index);
        significant.add(candidate.index);
      }
    }

    active.push(item);
  }

  return significant.size;
}

/** Median onset-to-onset interval, in seconds. Used to pick a rhythm grid. */
export function medianOnsetInterval(events: RawNoteEvent[]): number | null {
  if (events.length < 3) return null;

  const gaps: number[] = [];
  for (let i = 1; i < events.length; i++) {
    const gap = events[i].startSeconds - events[i - 1].startSeconds;
    if (gap > 0.02) gaps.push(gap);
  }
  if (gaps.length === 0) return null;

  gaps.sort((a, b) => a - b);
  const middle = Math.floor(gaps.length / 2);
  return gaps.length % 2 === 0 ? (gaps[middle - 1] + gaps[middle]) / 2 : gaps[middle];
}

/** Suggested tempo from the median onset interval, clamped to a musical range. */
export function suggestTempo(events: RawNoteEvent[]): number | null {
  const interval = medianOnsetInterval(events);
  if (interval === null) return null;

  // Treat the median interval as a beat and round to a sane tempo.
  const bpm = 60 / interval;
  const rounded = Math.round(bpm);
  if (rounded < 40) return Math.round(rounded * 2);
  if (rounded > 200) return Math.round(rounded / 2);
  return rounded;
}

/** Summary used by the review screen. */
export interface NoteSummary {
  noteCount: number;
  distinctPitches: number;
  lowestMidi: number | null;
  highestMidi: number | null;
  /** Any amount of overlap, including legato tails. Diagnostic only. */
  overlappingEvents: number;
  /** Overlaps large enough to be genuine simultaneities. Drives the warning. */
  significantOverlaps: number;
}

export function summariseEvents(events: RawNoteEvent[]): NoteSummary {
  if (events.length === 0) {
    return {
      noteCount: 0,
      distinctPitches: 0,
      lowestMidi: null,
      highestMidi: null,
      overlappingEvents: 0,
      significantOverlaps: 0,
    };
  }

  const pitches = events.map((event) => event.midi);
  return {
    noteCount: events.length,
    distinctPitches: new Set(pitches).size,
    lowestMidi: Math.min(...pitches),
    highestMidi: Math.max(...pitches),
    overlappingEvents: countOverlappingEvents(events),
    significantOverlaps: countSignificantOverlaps(events),
  };
}
