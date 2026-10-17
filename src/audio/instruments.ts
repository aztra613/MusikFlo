import { InstrumentId } from '../types/music';

/**
 * Instrument voice definitions
 * ----------------------------
 * Live playback (Tone.js) and the offline WAV renderer both build their voice
 * from the same spec in this table. That is deliberate: the previous code kept
 * the two engines separate, and the offline renderer simply had no `guitar`
 * branch at all, so guitar exported as a byte-identical copy of the piano.
 *
 * The table is free of audio-engine imports so it can also be used by the UI,
 * the project validator and the MIDI exporter.
 */

export interface VoicePartial {
  type: OscillatorType;
  /** Frequency multiple of the fundamental. Slightly detuned values add body. */
  ratio: number;
  /** Linear gain of this partial, relative to the voice. */
  gain: number;
  /** Extra detune in cents, used for gentle chorusing between partials. */
  detuneCents?: number;
}

export interface VoiceSpec {
  id: InstrumentId;
  /** Human-readable name shown in the studio and on the landing page. */
  label: string;
  /** One-line description of how the sound is made. */
  blurb: string;
  /** General MIDI program number, used by the MIDI exporter. */
  gmProgram: number;
  /** Overall voice level, linear. */
  gain: number;
  partials: VoicePartial[];
  /** Breath/air noise mixed into the voice (flutes). */
  noise?: {
    gain: number;
    /** Centre frequency of the noise band. */
    filterHz: number;
    q: number;
  };
  envelope: {
    attack: number;
    decay: number;
    sustain: number;
    release: number;
  };
  filter: {
    type: BiquadFilterType;
    /** Sustain cutoff. */
    hz: number;
    q: number;
    /** Added cutoff at note onset, decaying back to `hz` over `envDecay`. */
    envAmount: number;
    envDecay: number;
  };
  /** Pitch vibrato, in cents, fading in after `delaySec`. */
  vibrato?: {
    rateHz: number;
    depthCents: number;
    delaySec: number;
  };
  /** Chorus/detune amount, 0–1, for ensemble width. */
  chorus?: number;
}

export const VOICES: Record<InstrumentId, VoiceSpec> = {
  piano: {
    id: 'piano',
    label: 'Concert Grand Piano',
    blurb: 'Hammered attack with a long, warm decay.',
    gmProgram: 1,
    gain: 0.9,
    partials: [
      { type: 'triangle', ratio: 1, gain: 1 },
      { type: 'sine', ratio: 2, gain: 0.32 },
      { type: 'sine', ratio: 3, gain: 0.14, detuneCents: 3 },
      { type: 'sine', ratio: 4.01, gain: 0.07 },
    ],
    envelope: { attack: 0.004, decay: 1.6, sustain: 0.12, release: 1.1 },
    filter: { type: 'lowpass', hz: 5200, q: 0.6, envAmount: 4200, envDecay: 0.5 },
  },

  guitar: {
    id: 'guitar',
    label: 'Plucked Acoustic Guitar',
    blurb: 'Plucked string with a bright attack and quick decay.',
    gmProgram: 25,
    gain: 0.85,
    partials: [
      { type: 'triangle', ratio: 1, gain: 1 },
      { type: 'sawtooth', ratio: 2, gain: 0.22, detuneCents: 4 },
      { type: 'sine', ratio: 3.01, gain: 0.16 },
      { type: 'sine', ratio: 5.02, gain: 0.06 },
    ],
    envelope: { attack: 0.003, decay: 0.9, sustain: 0.05, release: 0.45 },
    // A fast filter sweep is what makes a pluck read as "plucked" rather than "struck".
    filter: { type: 'lowpass', hz: 1900, q: 1.1, envAmount: 5200, envDecay: 0.16 },
    chorus: 0.15,
  },

  strings: {
    id: 'strings',
    label: 'Warm Chamber Strings',
    blurb: 'Bowed ensemble with a slow swell and gentle detune.',
    gmProgram: 49,
    gain: 0.7,
    partials: [
      { type: 'sawtooth', ratio: 1, gain: 0.85 },
      { type: 'sawtooth', ratio: 1, gain: 0.6, detuneCents: 9 },
      { type: 'triangle', ratio: 2, gain: 0.2, detuneCents: -6 },
    ],
    envelope: { attack: 0.18, decay: 0.4, sustain: 0.78, release: 0.9 },
    filter: { type: 'lowpass', hz: 2700, q: 0.7, envAmount: 900, envDecay: 0.6 },
    vibrato: { rateHz: 4.8, depthCents: 9, delaySec: 0.45 },
    chorus: 0.45,
  },

  flute: {
    id: 'flute',
    label: 'Silver Concert Flute',
    blurb: 'Pure tone with an airy, breathy attack.',
    gmProgram: 74,
    gain: 0.8,
    partials: [
      { type: 'sine', ratio: 1, gain: 1 },
      { type: 'sine', ratio: 2, gain: 0.16 },
      { type: 'sine', ratio: 3, gain: 0.05 },
    ],
    noise: { gain: 0.1, filterHz: 2400, q: 0.9 },
    envelope: { attack: 0.075, decay: 0.2, sustain: 0.86, release: 0.35 },
    filter: { type: 'lowpass', hz: 4200, q: 0.5, envAmount: 1200, envDecay: 0.25 },
    vibrato: { rateHz: 5, depthCents: 10, delaySec: 0.28 },
  },

  bansuri: {
    id: 'bansuri',
    label: 'Indian Bansuri',
    blurb: 'Bamboo flute: hollow, breathy, with an expressive vibrato.',
    gmProgram: 73,
    gain: 0.8,
    partials: [
      { type: 'sine', ratio: 1, gain: 1 },
      { type: 'sine', ratio: 2, gain: 0.26 },
      { type: 'sine', ratio: 3, gain: 0.12, detuneCents: 5 },
      { type: 'triangle', ratio: 4, gain: 0.05 },
    ],
    // More air than a concert flute, and a wider band, which is the character
    // that makes a bansuri recognisable.
    noise: { gain: 0.22, filterHz: 1700, q: 0.6 },
    envelope: { attack: 0.1, decay: 0.25, sustain: 0.9, release: 0.45 },
    filter: { type: 'lowpass', hz: 3400, q: 0.9, envAmount: 1800, envDecay: 0.4 },
    vibrato: { rateHz: 5.6, depthCents: 22, delaySec: 0.3 },
  },

  clarinet: {
    id: 'clarinet',
    label: 'Reed Clarinet',
    blurb: 'Hollow woody reed tone built from odd harmonics.',
    gmProgram: 72,
    gain: 0.72,
    partials: [
      { type: 'square', ratio: 1, gain: 0.5 },
      { type: 'sine', ratio: 3, gain: 0.3 },
      { type: 'sine', ratio: 5, gain: 0.12 },
    ],
    noise: { gain: 0.05, filterHz: 1400, q: 0.7 },
    envelope: { attack: 0.05, decay: 0.25, sustain: 0.66, release: 0.3 },
    filter: { type: 'lowpass', hz: 2300, q: 0.8, envAmount: 1100, envDecay: 0.3 },
  },
};

/** Every instrument id, in presentation order. */
export const INSTRUMENT_IDS = Object.keys(VOICES) as InstrumentId[];

export function getVoice(id: InstrumentId): VoiceSpec {
  return VOICES[id] ?? VOICES.piano;
}

/** GM program for an instrument, used by the MIDI exporter. */
export function gmProgramFor(id: InstrumentId): number {
  return getVoice(id).gmProgram;
}
