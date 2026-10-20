import { describe, expect, it } from 'vitest';
import {
  computePdfPageRowBatches,
  exportToMidi,
  exportToMusicXml,
  keySignatureFifths,
  safeFilename,
} from './exporter';
import { Score, TICKS_PER_QUARTER, getEventTicks } from '../types/music';

function baseScore(events: Score['measures'][number]['events'], extra: Partial<Score> = {}): Score {
  return {
    id: 's',
    title: 'Test < & "Song"',
    composer: 'Anon',
    clef: 'treble',
    timeSignature: { numerator: 4, denominator: 4 },
    keySignature: 'C',
    tempo: 120,
    instrument: 'piano',
    createdAt: 0,
    updatedAt: 0,
    measures: [{ id: 'm1', events }],
    ...extra,
  };
}

/** Minimal Standard MIDI File reader: total delta ticks and note-on counts. */
function readMidi(bytes: Uint8Array) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const header = String.fromCharCode(...bytes.slice(0, 4));
  // MThd header: 0-3 id, 4-7 length, 8-9 format, 10-11 track count, 12-13 division.
  const trackCount = view.getUint16(10, false);
  const ticksPerQuarter = view.getInt16(12, false);

  let offset = 14;
  let totalTicks = 0;
  let soundingNotes = 0;
  let silentNotes = 0;

  while (offset < bytes.length) {
    const chunkId = String.fromCharCode(...bytes.slice(offset, offset + 4));
    const length = view.getUint32(offset + 4, false);
    const start = offset + 8;
    const end = start + length;

    if (chunkId === 'MTrk') {
      let cursor = start;
      let runningStatus = 0;

      while (cursor < end) {
        // Variable-length delta time.
        let delta = 0;
        let byte = bytes[cursor++];
        while (byte & 0x80) {
          delta = (delta << 7) | (byte & 0x7f);
          byte = bytes[cursor++];
        }
        delta = (delta << 7) | byte;
        totalTicks += delta;

        let status = bytes[cursor];
        if (status & 0x80) {
          cursor++;
          runningStatus = status;
        } else {
          status = runningStatus;
        }

        const type = status & 0xf0;

        if (status === 0xff) {
          cursor++; // meta type
          let len = 0;
          let lenByte = bytes[cursor++];
          while (lenByte & 0x80) {
            len = (len << 7) | (lenByte & 0x7f);
            lenByte = bytes[cursor++];
          }
          len = (len << 7) | lenByte;
          cursor += len;
        } else if (type === 0x90 || type === 0x80) {
          const velocity = bytes[cursor + 1];
          if (type === 0x90 && velocity > 0) soundingNotes++;
          else silentNotes++;
          cursor += 2;
        } else if (type === 0xc0 || type === 0xd0) {
          cursor += 1;
        } else {
          cursor += 2;
        }
      }
    }

    offset = end;
  }

  return { header, trackCount, ticksPerQuarter, totalTicks, soundingNotes, silentNotes };
}

describe('keySignatureFifths', () => {
  it('maps major and minor keys to their accidental count', () => {
    expect(keySignatureFifths('C')).toBe(0);
    expect(keySignatureFifths('G')).toBe(1);
    expect(keySignatureFifths('D')).toBe(2);
    expect(keySignatureFifths('F')).toBe(-1);
    expect(keySignatureFifths('Bb')).toBe(-2);
    expect(keySignatureFifths('Eb')).toBe(-3);
    expect(keySignatureFifths('Gm')).toBe(-2);
  });

  it('falls back to C major for an unknown key', () => {
    expect(keySignatureFifths('Zz')).toBe(0);
    expect(keySignatureFifths(undefined)).toBe(0);
  });
});

describe('safeFilename', () => {
  it('removes characters that are unsafe in filenames', () => {
    expect(safeFilename('My <Song> "1"', 'fallback', 'mid')).toBe('My Song 1.mid');
  });

  it('falls back when the title is empty or unusable', () => {
    expect(safeFilename('   ', 'musikflo-score', 'pdf')).toBe('musikflo-score.pdf');
    expect(safeFilename('///', 'musikflo-score', 'pdf')).toBe('musikflo-score.pdf');
  });
});

describe('exportToMusicXml', () => {
  it('writes the selected key signature instead of always exporting C major', () => {
    expect(exportToMusicXml(baseScore([], { keySignature: 'D' }))).toContain('<fifths>2</fifths>');
    expect(exportToMusicXml(baseScore([], { keySignature: 'Eb' }))).toContain('<fifths>-3</fifths>');
    expect(exportToMusicXml(baseScore([], { keySignature: 'C' }))).toContain('<fifths>0</fifths>');
  });

  it('escapes XML metacharacters in the title', () => {
    const xml = exportToMusicXml(baseScore([]));
    expect(xml).toContain('<work-title>Test &lt; &amp; "Song"</work-title>');
    expect(xml).not.toContain('Test < &');
  });

  it('emits pitch, accidental, dot and duration for notes and rests', () => {
    const xml = exportToMusicXml(
      baseScore([
        { id: 'a', step: 'f', octave: 5, duration: '4', accidental: '#' },
        { id: 'b', step: 'c', octave: 4, duration: '4', dotted: true },
        { id: 'c', step: 'c', octave: 4, duration: '8', isRest: true },
      ])
    );

    expect(xml).toContain('<step>F</step>');
    expect(xml).toContain('<alter>1</alter>');
    expect(xml).toContain('<accidental>sharp</accidental>');
    expect(xml).toContain('<dot/>');
    expect(xml).toContain('<rest/>');
    expect(xml).toContain(`<duration>${TICKS_PER_QUARTER}</duration>`);
    expect(xml).toContain(`<duration>${TICKS_PER_QUARTER * 1.5}</duration>`);
  });

  it('declares the clef matching the score', () => {
    expect(exportToMusicXml(baseScore([], { clef: 'bass' }))).toContain('<sign>F</sign>');
    expect(exportToMusicXml(baseScore([], { clef: 'bass' }))).toContain('<line>4</line>');
  });
});

/** jsdom's Blob has no arrayBuffer(), so read it through FileReader. */
function blobToBytes(blob: Blob): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(blob);
  });
}

describe('exportToMidi', () => {
  const bytesOf = async (score: Score) => blobToBytes(exportToMidi(score));

  it('is a well-formed single-track file', async () => {
    const parsed = readMidi(await bytesOf(baseScore([{ id: 'a', step: 'e', octave: 4, duration: '4' }])));
    expect(parsed.header).toBe('MThd');
    expect(parsed.trackCount).toBe(1);
    expect(parsed.soundingNotes).toBe(1);
  });

  it('advances the same amount of time for a rest as for a sounding note', async () => {
    // Regression: encoding a rest as a zero-velocity note *with* a `wait` value
    // advanced the track twice per rest, silently stretching every export.
    const withNote = readMidi(await bytesOf(baseScore([{ id: 'a', step: 'e', octave: 4, duration: '2' }])));
    const withRest = readMidi(await bytesOf(baseScore([{ id: 'a', step: 'e', octave: 4, duration: '2', isRest: true }])));

    expect(withRest.totalTicks).toBe(withNote.totalTicks);
    expect(withRest.soundingNotes).toBe(0);
  });

  it('keeps total duration independent of how the rhythm is notated', async () => {
    const fourQuarters = readMidi(
      await bytesOf(
        baseScore([
          { id: 'a', step: 'c', octave: 4, duration: '4' },
          { id: 'b', step: 'c', octave: 4, duration: '4' },
          { id: 'c', step: 'c', octave: 4, duration: '4' },
          { id: 'd', step: 'c', octave: 4, duration: '4' },
        ])
      )
    );
    const oneWhole = readMidi(await bytesOf(baseScore([{ id: 'a', step: 'c', octave: 4, duration: '1' }])));

    expect(fourQuarters.totalTicks).toBe(oneWhole.totalTicks);
  });

  it('accounts for dotted values as 1.5x their base duration', async () => {
    const plain = readMidi(await bytesOf(baseScore([{ id: 'a', step: 'c', octave: 4, duration: '4' }])));
    const dotted = readMidi(await bytesOf(baseScore([{ id: 'a', step: 'c', octave: 4, duration: '4', dotted: true }])));

    expect(dotted.totalTicks).toBe(plain.totalTicks * 1.5);
  });

  it('converts the file tick space back to the score tick space exactly', async () => {
    const events: Score['measures'][number]['events'] = [
      { id: 'a', step: 'e', octave: 4, duration: '2' },
      { id: 'b', step: 'c', octave: 4, duration: '8', isRest: true },
    ];
    const parsed = readMidi(await bytesOf(baseScore(events)));

    // ticksPerQuarter is the file's own division; convert back to score ticks.
    const scoreTicks = parsed.totalTicks * (TICKS_PER_QUARTER / parsed.ticksPerQuarter);
    const expectedTicks = events.reduce((sum, event) => sum + getEventTicks(event), 0);

    expect(parsed.ticksPerQuarter).toBeGreaterThan(0);
    expect(scoreTicks).toBeCloseTo(expectedTicks, 6);
  });

  it('exports multiple tracks for Grand Staff scores in exportToMidi', async () => {
    const score: Score = baseScore(
      [{ id: 't1', step: 'c', octave: 5, duration: '4' }],
      {
        staffMode: 'grand',
        measures: [
          {
            id: 'm1',
            events: [{ id: 't1', step: 'c', octave: 5, duration: '4' }],
            bassEvents: [{ id: 'b1', step: 'c', octave: 3, duration: '4' }],
          },
        ],
      }
    );

    const midi = readMidi(await bytesOf(score));
    expect(midi.trackCount).toBe(2);
    expect(midi.soundingNotes).toBe(2);
  });
});

describe('computePdfPageRowBatches', () => {
  it('fits short scores (<= 5 rows) onto a single page', () => {
    expect(computePdfPageRowBatches(1)).toEqual([[0]]);
    expect(computePdfPageRowBatches(3)).toEqual([[0, 1, 2]]);
    expect(computePdfPageRowBatches(5)).toEqual([[0, 1, 2, 3, 4]]);
  });

  it('balances multi-page scores without creating single-row orphan pages', () => {
    // 6 rows (12 measures) -> 2 pages of 3 rows each
    expect(computePdfPageRowBatches(6)).toEqual([
      [0, 1, 2],
      [3, 4, 5],
    ]);

    // 8 rows (16 measures) -> 2 pages of 4 rows each
    expect(computePdfPageRowBatches(8)).toEqual([
      [0, 1, 2, 3],
      [4, 5, 6, 7],
    ]);

    // 16 rows (32 measures, typical 1-2 min transcription) -> 4 pages of 4 rows each
    const sixteen = computePdfPageRowBatches(16);
    expect(sixteen.length).toBe(4);
    expect(sixteen.every((page) => page.length === 4)).toBe(true);
    expect(sixteen.flat()).toEqual(Array.from({ length: 16 }, (_, i) => i));
  });

  it('balances Grand Staff pagination with targetPerPage = 2', () => {
    // 4 rows in Grand Staff -> 2 pages of 2 rows each
    expect(computePdfPageRowBatches(4, 2)).toEqual([
      [0, 1],
      [2, 3],
    ]);
  });
});
