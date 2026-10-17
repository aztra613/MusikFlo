import { describe, expect, it } from 'vitest';
import { INSTRUMENT_IDS, VOICES, getVoice, gmProgramFor } from './instruments';
import { InstrumentId } from '../types/music';

/** A fingerprint of everything that makes a voice sound the way it does. */
function voiceSignature(id: InstrumentId): string {
  const v = VOICES[id];
  return JSON.stringify({
    partials: v.partials.map((p) => [p.type, p.ratio, p.gain, p.detuneCents ?? 0]),
    envelope: v.envelope,
    filter: v.filter,
    noise: v.noise ?? null,
    vibrato: v.vibrato ?? null,
  });
}

describe('instrument voices', () => {
  it('covers every instrument id with a complete spec', () => {
    expect(INSTRUMENT_IDS.length).toBeGreaterThanOrEqual(6);
    for (const id of INSTRUMENT_IDS) {
      const voice = VOICES[id];
      expect(voice.id, `${id} id mismatch`).toBe(id);
      expect(voice.label.length).toBeGreaterThan(0);
      expect(voice.blurb.length).toBeGreaterThan(0);
      expect(voice.partials.length).toBeGreaterThan(0);
      expect(voice.gain).toBeGreaterThan(0);
      expect(voice.gain).toBeLessThanOrEqual(1);
      expect(voice.gmProgram).toBeGreaterThanOrEqual(1);
      expect(voice.gmProgram).toBeLessThanOrEqual(128);
    }
  });

  it('includes the Indian bansuri and a plucked guitar', () => {
    expect(INSTRUMENT_IDS).toContain('bansuri');
    expect(VOICES.bansuri.label).toMatch(/bansuri/i);
    expect(VOICES.guitar.label).toMatch(/guitar/i);
  });

  it('has a valid ADSR envelope for every voice', () => {
    for (const id of INSTRUMENT_IDS) {
      const { attack, decay, sustain, release } = VOICES[id].envelope;
      expect(attack, `${id} attack`).toBeGreaterThan(0);
      expect(decay, `${id} decay`).toBeGreaterThan(0);
      expect(sustain, `${id} sustain`).toBeGreaterThan(0);
      expect(sustain, `${id} sustain`).toBeLessThanOrEqual(1);
      expect(release, `${id} release`).toBeGreaterThan(0);
      expect(VOICES[id].filter.hz, `${id} filter`).toBeGreaterThan(100);
      expect(VOICES[id].filter.hz).toBeLessThan(20000);
    }
  });

  it('gives every instrument a distinct voice', () => {
    // Regression: the offline renderer had no guitar branch at all, so guitar
    // exported as a byte-identical copy of the piano.
    const signatures = new Map<string, InstrumentId>();
    for (const id of INSTRUMENT_IDS) {
      const signature = voiceSignature(id);
      const clash = signatures.get(signature);
      expect(clash, `${id} sounds identical to ${clash}`).toBeUndefined();
      signatures.set(signature, id);
    }
    expect(signatures.size).toBe(INSTRUMENT_IDS.length);
  });

  it('keeps guitar clearly distinct from piano', () => {
    const guitar = VOICES.guitar;
    const piano = VOICES.piano;

    expect(guitar.envelope.decay).not.toBe(piano.envelope.decay);
    expect(guitar.filter.hz).not.toBe(piano.filter.hz);
    expect(guitar.partials.map((p) => p.ratio)).not.toEqual(piano.partials.map((p) => p.ratio));
    // A pluck needs a fast filter sweep; a piano needs a longer one.
    expect(guitar.filter.envDecay).toBeLessThan(piano.filter.envDecay);
  });

  it('distinguishes the bansuri from the concert flute', () => {
    expect(voiceSignature('bansuri')).not.toBe(voiceSignature('flute'));
    // The bansuri carries noticeably more breath air.
    expect((VOICES.bansuri.noise?.gain ?? 0)).toBeGreaterThan(VOICES.flute.noise?.gain ?? 0);
    expect((VOICES.bansuri.vibrato?.depthCents ?? 0)).toBeGreaterThan(VOICES.flute.vibrato?.depthCents ?? 0);
  });

  it('uses distinct General MIDI programs', () => {
    const programs = INSTRUMENT_IDS.map(gmProgramFor);
    expect(new Set(programs).size).toBe(programs.length);
  });

  it('falls back to the piano voice for an unknown instrument', () => {
    expect(getVoice('nope' as InstrumentId)).toBe(VOICES.piano);
  });
});
