import MidiWriter from 'midi-writer-js';
import { jsPDF } from 'jspdf';
import { Score, getEventTicks, TICKS_PER_QUARTER } from '../types/music';
import { audioEngine } from '../audio/audioEngine';
import { gmProgramFor } from '../audio/instruments';
import { PRINT_NOTATION_PALETTE, renderScoreInto } from '../score/renderScore';
import { DEFAULT_LAYOUT, totalHeight, totalWidth } from '../score/geometry';

/** Warm score paper used by the PDF page and by the engraved raster. */
const PRINT_PAPER = '#FFFDF7';

/** Accidental count for each key signature the score model can hold. */
const KEY_SIGNATURE_FIFTHS: Record<string, number> = {
  C: 0,
  G: 1,
  D: 2,
  A: 3,
  E: 4,
  B: 5,
  'F#': 6,
  'C#': 7,
  F: -1,
  Bb: -2,
  Eb: -3,
  Ab: -4,
  Db: -5,
  Gb: -6,
  Cb: -7,
  Am: 0,
  Em: 1,
  Bm: 2,
  Dm: -1,
  Gm: -2,
  Cm: -3,
  Fm: -4,
};

export function keySignatureFifths(key: string | undefined): number {
  if (!key) return 0;
  return KEY_SIGNATURE_FIFTHS[key] ?? 0;
}

/** Strip characters that are unsafe or awkward in download filenames. */
export function safeFilename(title: string, fallback: string, extension: string): string {
  const base = (title || '').trim().replace(/[\\/:*?"<>|\u0000-\u001f]/g, '').replace(/\s+/g, ' ').slice(0, 80);
  return `${base || fallback}.${extension}`;
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Export the score as a Standard MIDI File.
 *
 * A rest is encoded as a single zero-velocity note whose *duration* carries the
 * silence. Two details matter here:
 *  - the velocity must be the string '0': midi-writer-js uses `velocity || 50`,
 *    so a numeric 0 silently becomes a *sounding* note;
 *  - `wait` must not be set, because the duration already advances the track and
 *    adding a wait would move the timeline twice per rest.
 */
export function exportToMidi(score: Score): Blob {
  const track = new MidiWriter.Track();
  track.setTempo(score.tempo || 100);
  track.addTrackName(score.title || 'MusikFlo Composition');

  // Program change comes from the voice table, so MIDI cannot disagree with the
  // instrument the score actually plays.
  track.addEvent(new MidiWriter.ProgramChangeEvent({ instrument: gmProgramFor(score.instrument) }));

  score.measures.forEach((measure) => {
    measure.events.forEach((note) => {
      const duration = note.dotted ? `d${note.duration}` : note.duration;

      if (note.isRest) {
        track.addEvent(new MidiWriter.NoteEvent({ pitch: ['C4'], duration, velocity: '0' }));
        return;
      }

      const accidental = note.accidental === '#' ? '#' : note.accidental === 'b' ? 'b' : '';
      track.addEvent(
        new MidiWriter.NoteEvent({ pitch: [`${note.step.toUpperCase()}${accidental}${note.octave}`], duration, velocity: 85 })
      );
    });
  });

  const bytes = new MidiWriter.Writer([track]).buildFile();
  return new Blob([bytes], { type: 'audio/midi' });
}

/** Export the score as MusicXML 3.1. */
export function exportToMusicXml(score: Score): string {
  const sanitize = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const fifths = keySignatureFifths(score.keySignature);

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 3.1 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">
<score-partwise version="3.1">
  <work>
    <work-title>${sanitize(score.title || 'Untitled')}</work-title>
  </work>
  <identification>
    <creator type="composer">${sanitize(score.composer || 'Anonymous')}</creator>
    <encoding>
      <software>MusikFlo Composition Studio</software>
      <encoding-date>${new Date().toISOString().slice(0, 10)}</encoding-date>
    </encoding>
  </identification>
  <part-list>
    <score-part id="P1">
      <part-name>${sanitize(score.instrument.toUpperCase())}</part-name>
    </score-part>
  </part-list>
  <part id="P1">
`;

  score.measures.forEach((measure, mIdx) => {
    xml += `    <measure number="${mIdx + 1}">\n`;

    if (mIdx === 0) {
      xml += `      <attributes>
        <divisions>${TICKS_PER_QUARTER}</divisions>
        <key>
          <fifths>${fifths}</fifths>
        </key>
        <time>
          <beats>${score.timeSignature.numerator}</beats>
          <beat-type>${score.timeSignature.denominator}</beat-type>
        </time>
        <clef>
          <sign>${score.clef === 'treble' ? 'G' : 'F'}</sign>
          <line>${score.clef === 'treble' ? 2 : 4}</line>
        </clef>
      </attributes>
      <direction placement="above">
        <sound tempo="${score.tempo}"/>
      </direction>\n`;
    }

    measure.events.forEach((note) => {
      const ticks = getEventTicks(note);
      const noteTypeMap: Record<string, string> = {
        '1': 'whole',
        '2': 'half',
        '4': 'quarter',
        '8': 'eighth',
        '16': '16th',
      };

      xml += `      <note>\n`;
      if (note.isRest) {
        xml += `        <rest/>\n`;
      } else {
        const alter = note.accidental === '#' ? 1 : note.accidental === 'b' ? -1 : 0;
        xml += `        <pitch>
          <step>${note.step.toUpperCase()}</step>
          ${alter !== 0 ? `<alter>${alter}</alter>` : ''}
          <octave>${note.octave}</octave>
        </pitch>\n`;
        if (note.accidental) {
          xml += `        <accidental>${
            note.accidental === '#' ? 'sharp' : note.accidental === 'b' ? 'flat' : 'natural'
          }</accidental>\n`;
        }
      }

      xml += `        <duration>${ticks}</duration>\n`;
      xml += `        <type>${noteTypeMap[note.duration] || 'quarter'}</type>\n`;
      if (note.dotted) {
        xml += `        <dot/>\n`;
      }
      xml += `      </note>\n`;
    });

    xml += `    </measure>\n`;
  });

  xml += `  </part>
</score-partwise>`;

  return xml;
}

export function exportToProjectJson(score: Score): Blob {
  return new Blob([JSON.stringify(score, null, 2)], { type: 'application/json' });
}

/** Standard duration names in the MIDI writer's own tick space. */
const WRITER_TICKS_PER_QUARTER = 128;

const DURATION_BEATS: Array<{ beats: number; value: string }> = [
  { beats: 4, value: '1' },
  { beats: 3, value: 'd2' },
  { beats: 2, value: '2' },
  { beats: 1.5, value: 'd4' },
  { beats: 1, value: '4' },
  { beats: 0.75, value: 'd8' },
  { beats: 0.5, value: '8' },
  { beats: 0.375, value: 'd16' },
  { beats: 0.25, value: '16' },
  { beats: 0.125, value: '32' },
];

function nearestDurationValue(seconds: number, bpm: number): string {
  const beats = (seconds * bpm) / 60;
  let best = DURATION_BEATS[DURATION_BEATS.length - 1];
  let bestError = Infinity;
  for (const candidate of DURATION_BEATS) {
    const error = Math.abs(candidate.beats - beats);
    if (error < bestError) {
      bestError = error;
      best = candidate;
    }
  }
  return best.value;
}

function midiToNoteName(midi: number): string {
  const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  return `${names[((midi % 12) + 12) % 12]}${Math.floor(midi / 12) - 1}`;
}

/**
 * Export raw transcription note events as MIDI, preserving detected onsets.
 *
 * MIDI can express notes that sound together, so this is the honest way to keep a
 * polyphonic transcription even though the score editor can only notate one line.
 * Onsets are preserved exactly; note lengths are rounded to the nearest standard
 * MIDI duration because the format's duration field is a value name, not a tick
 * count. Written against a structural type so this module stays decoupled from
 * the transcription feature.
 */
export function exportTranscriptionMidi(
  events: ReadonlyArray<{ startSeconds: number; durationSeconds: number; midi: number }>,
  bpm: number
): Blob {
  const track = new MidiWriter.Track();
  track.setTempo(bpm || 120);
  track.addTrackName('MusikFlo transcription (raw)');

  const ticksPerSecond = ((bpm || 120) / 60) * WRITER_TICKS_PER_QUARTER;

  for (const event of events) {
    track.addEvent(
      new MidiWriter.NoteEvent({
        pitch: [midiToNoteName(event.midi)],
        duration: nearestDurationValue(event.durationSeconds, bpm || 120),
        velocity: 80,
        startTick: Math.max(0, Math.round(event.startSeconds * ticksPerSecond)),
      })
    );
  }

  const bytes = new MidiWriter.Writer([track]).buildFile();
  return new Blob([bytes], { type: 'audio/midi' });
}

export async function exportScoreToWav(score: Score, filename: string): Promise<void> {
  const wavBlob = await audioEngine.renderToWav(score);
  downloadBlob(wavBlob, filename);
}

/**
 * Render the score to a PDF.
 *
 * The notation is engraved a second time through the canvas backend of the
 * shared renderer, using a fixed print palette. Two bugs are fixed by that:
 *
 *  - the previous version serialised the editor's SVG into an `<img>` and
 *    rasterised it, but VexFlow registers its music fonts (Bravura/Academico) on
 *    the live document, which a standalone SVG cannot see — so every glyph
 *    (clefs, time signatures, noteheads) vanished and the score area was blank;
 *  - it also reused the on-screen colours, so in dark mode the near-white
 *    notation ink was invisible on white PDF paper.
 */
export async function exportScoreToPdf(score: Score, filename: string): Promise<void> {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  doc.setFillColor(255, 253, 247);
  doc.rect(0, 0, pageWidth, pageHeight, 'F');

  doc.setTextColor(25, 37, 34);
  doc.setFont('times', 'bold');
  doc.setFontSize(22);
  doc.text(score.title || 'Untitled Composition', pageWidth / 2, 48, { align: 'center' });

  doc.setFont('times', 'italic');
  doc.setFontSize(11);
  doc.text(score.composer ? `Composed by ${score.composer}` : 'MusikFlo Studio', pageWidth / 2, 65, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(116, 129, 124);
  doc.text(
    `${score.clef === 'treble' ? 'Treble Clef' : 'Bass Clef'}   ·   Time Signature: ${score.timeSignature.numerator}/${
      score.timeSignature.denominator
    }   ·   Tempo: ${score.tempo || 100} BPM   ·   Key: ${score.keySignature || 'C'}`,
    pageWidth / 2,
    80,
    { align: 'center' }
  );

  const { canvas, width, height } = renderScoreToCanvas(score);
  if (!canvas) {
    throw new Error('The score could not be engraved for PDF export. Try again once the notation has rendered.');
  }

  const imageData = canvas.toDataURL('image/png');
  const maxRenderW = pageWidth - 60;
  const maxRenderH = pageHeight - 130;
  const aspect = width / Math.max(1, height);

  let renderW = maxRenderW;
  let renderH = renderW / aspect;
  if (renderH > maxRenderH) {
    renderH = maxRenderH;
    renderW = renderH * aspect;
  }

  // 'FAST' (Deflate) keeps the file small: the raster is line art, which
  // compresses extremely well. Uncompressed it would be several megabytes.
  doc.addImage(imageData, 'PNG', (pageWidth - renderW) / 2, 95, renderW, renderH, undefined, 'FAST');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(150, 160, 155);
  doc.text('Engraved with MusikFlo — Sheet Music Studio & Composer', 30, pageHeight - 20);

  doc.save(filename);
}

/**
 * Engrave the score into an offscreen canvas using the print palette.
 * Exported so tests can assert the raster actually contains notation.
 */
export function renderScoreToCanvas(
  score: Score,
  pixelRatio = 2.5
): { canvas: HTMLCanvasElement | null; width: number; height: number } {
  const width = totalWidth(DEFAULT_LAYOUT);
  const height = totalHeight(score.measures.length, DEFAULT_LAYOUT);

  const host = document.createElement('div');
  const rendered = renderScoreInto(host, {
    score,
    palette: PRINT_NOTATION_PALETTE,
    backend: 'canvas',
    pixelRatio,
    // Bake the paper colour into the raster so the score never prints onto a
    // transparent background.
    background: PRINT_PAPER,
  });

  return { canvas: rendered.canvas, width, height };
}
