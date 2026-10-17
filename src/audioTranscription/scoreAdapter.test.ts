import { describe, expect, it } from 'vitest';
import { TICKS_PER_QUARTER, getMeasureCapacityTicks, validateMeasure } from '../types/music';
import { RawNoteEvent, TranscriptionSettings } from './types';
import { quantiseEvents, notationForTicks } from './quantise';
import {
  buildScoreFromTranscription,
  clampTempo,
  gridLabel,
  midiToPitch,
  suggestClef,
  summariseConversion,
  titleFromFileName,
} from './scoreAdapter';

function note(startSeconds: number, durationSeconds: number, midi = 60): RawNoteEvent {
  return {
    startSeconds,
    durationSeconds,
    endSeconds: startSeconds + durationSeconds,
    midi,
    confidence: 0.9,
  };
}

const SETTINGS: TranscriptionSettings = {
  bpm: 120,
  timeSignature: { numerator: 4, denominator: 4 },
  grid: '16',
  clef: 'treble',
};

describe('midiToPitch', () => {
  it('writes naturals without an accidental', () => {
    expect(midiToPitch(60, 'C')).toEqual({ step: 'c', octave: 4 });
    expect(midiToPitch(72, 'C')).toEqual({ step: 'c', octave: 5 });
    expect(midiToPitch(67, 'C')).toEqual({ step: 'g', octave: 4 });
  });

  it('uses sharps in sharp keys', () => {
    expect(midiToPitch(61, 'G')).toEqual({ step: 'c', octave: 4, accidental: '#' });
    expect(midiToPitch(66, 'D')).toEqual({ step: 'f', octave: 4, accidental: '#' });
  });

  it('uses flats in flat keys, as a musician would expect', () => {
    expect(midiToPitch(61, 'F')).toEqual({ step: 'd', octave: 4, accidental: 'b' });
    expect(midiToPitch(70, 'Bb')).toEqual({ step: 'b', octave: 4, accidental: 'b' });
    expect(midiToPitch(68, 'Eb')).toEqual({ step: 'a', octave: 4, accidental: 'b' });
  });

  it('handles the octave boundary below middle C', () => {
    expect(midiToPitch(59, 'C')).toEqual({ step: 'b', octave: 3 });
    expect(midiToPitch(48, 'C')).toEqual({ step: 'c', octave: 3 });
  });
});

describe('suggestClef', () => {
  it('suggests a bass staff for low material', () => {
    expect(suggestClef([note(0, 0.5, 43), note(0.5, 0.5, 45), note(1, 0.5, 47)])).toBe('bass');
  });

  it('suggests a treble staff for high material', () => {
    expect(suggestClef([note(0, 0.5, 67), note(0.5, 0.5, 69), note(1, 0.5, 72)])).toBe('treble');
  });

  it('defaults to treble with no events', () => {
    expect(suggestClef([])).toBe('treble');
  });
});

describe('clampTempo and labels', () => {
  it('clamps to the transport range', () => {
    expect(clampTempo(10)).toBe(40);
    expect(clampTempo(400)).toBe(240);
    expect(clampTempo(118.4)).toBe(118);
  });

  it('describes the grid in plain language', () => {
    expect(gridLabel(240)).toBe('sixteenth notes');
    expect(gridLabel(480)).toBe('eighth notes');
    expect(gridLabel(960)).toBe('quarter notes');
  });
});

describe('titleFromFileName', () => {
  it('strips the extension and falls back when there is no name', () => {
    expect(titleFromFileName('my melody.wav')).toBe('my melody');
    expect(titleFromFileName('clip.MP3')).toBe('clip');
    expect(titleFromFileName('   .wav')).toBe('Transcribed audio');
  });
});

describe('buildScoreFromTranscription', () => {
  it('produces a valid, complete score that passes the studio validator', () => {
    const events = [note(0, 0.5, 60), note(0.5, 0.5, 62), note(1, 0.5, 64), note(1.5, 0.5, 67)];
    const report = quantiseEvents(events, SETTINGS);
    const score = buildScoreFromTranscription({ report, settings: SETTINGS, sourceName: 'melody.wav' });

    expect(score.title).toBe('melody');
    expect(score.tempo).toBe(120);
    expect(score.composer).toBe('Transcribed from audio');
    expect(score.measures.length).toBeGreaterThan(0);

    score.measures.forEach((measure, index) => {
      const validation = validateMeasure(measure, index, SETTINGS.timeSignature);
      expect(validation.status, `measure ${index + 1} should be complete`).toBe('complete');
    });
  });

  it('creates fresh identifiers so it can never collide with the open project', () => {
    const report = quantiseEvents([note(0, 0.5, 60)], SETTINGS);
    const first = buildScoreFromTranscription({ report, settings: SETTINGS, sourceName: 'a.wav' });
    const second = buildScoreFromTranscription({ report, settings: SETTINGS, sourceName: 'a.wav' });

    expect(first.id).not.toBe(second.id);
    const firstIds = first.measures.flatMap((m) => [m.id, ...m.events.map((e) => e.id)]);
    const secondIds = second.measures.flatMap((m) => [m.id, ...m.events.map((e) => e.id)]);
    expect(firstIds.some((id) => secondIds.includes(id))).toBe(false);
  });

  it('writes rests as rests and notes with an exact notation value', () => {
    // A gap between two notes must become a rest, not a silently shifted note.
    const report = quantiseEvents([note(0, 0.5, 60), note(1, 0.5, 62)], SETTINGS);
    const score = buildScoreFromTranscription({ report, settings: SETTINGS, sourceName: 'gaps.wav' });

    const allEvents = score.measures.flatMap((m) => m.events);
    const rests = allEvents.filter((e) => e.isRest);
    const notes = allEvents.filter((e) => !e.isRest);

    expect(rests.length).toBeGreaterThan(0);
    expect(notes).toHaveLength(2);
    expect(notes.map((n) => n.step)).toEqual(['c', 'd']);

    for (const event of allEvents) {
      expect(['1', '2', '4', '8', '16']).toContain(event.duration);
      const ticks =
        TICKS_PER_QUARTER *
        (event.duration === '1' ? 4 : event.duration === '2' ? 2 : event.duration === '4' ? 1 : event.duration === '8' ? 0.5 : 0.25) *
        (event.dotted ? 1.5 : 1);
      expect(notationForTicks(ticks), `${event.duration}${event.dotted ? 'd' : ''}`).not.toBeNull();
    }
  });

  it('uses the chosen clef and meter rather than inferring them silently', () => {
    const settings: TranscriptionSettings = { ...SETTINGS, clef: 'bass', timeSignature: { numerator: 3, denominator: 4 } };
    const report = quantiseEvents([note(0, 0.5, 48), note(0.5, 0.5, 50), note(1, 0.5, 52)], settings);
    const score = buildScoreFromTranscription({ report, settings, sourceName: 'low.wav' });

    expect(score.clef).toBe('bass');
    expect(score.timeSignature).toEqual({ numerator: 3, denominator: 4 });
    expect(getMeasureCapacityTicks(score.timeSignature)).toBe(TICKS_PER_QUARTER * 3);
  });

  it('always returns at least one measure', () => {
    const score = buildScoreFromTranscription({
      report: quantiseEvents([], SETTINGS),
      settings: SETTINGS,
      sourceName: 'empty.wav',
    });
    expect(score.measures.length).toBeGreaterThanOrEqual(1);
  });
});

describe('summariseConversion', () => {
  it('discloses quantisation, polyphony and truncation', () => {
    const events = [note(0, 1, 60), note(0.2, 1, 64), note(0.9, 0.5, 67)];
    const report = quantiseEvents(events, SETTINGS);
    const summary = summariseConversion(events, report, SETTINGS.timeSignature);

    expect(summary.polyphonic).toBe(true);
    expect(summary.noteSummary.noteCount).toBe(3);
    expect(summary.beatsPerBar).toBe(4);
    expect(summary.measures).toBe(report.measures.length);
    expect(summary.meanTimingErrorMs).toBeGreaterThanOrEqual(0);
  });

  it('reports a monophonic line as such', () => {
    const events = [note(0, 0.5, 60), note(0.5, 0.5, 62)];
    const report = quantiseEvents(events, SETTINGS);
    expect(summariseConversion(events, report, SETTINGS.timeSignature).polyphonic).toBe(false);
  });
});
