import MidiWriter from 'midi-writer-js';
import { jsPDF } from 'jspdf';
import { Score, getEventTicks, TICKS_PER_QUARTER } from '../types/music';
import { audioEngine } from '../audio/audioEngine';
import { gmProgramFor } from '../audio/instruments';
import { PRINT_NOTATION_PALETTE, renderScoreInto } from '../score/renderScore';
import { DEFAULT_LAYOUT, getLayoutForScore, totalHeight, totalWidth } from '../score/geometry';

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
 * Supports multi-track export when Grand Staff (Treble + Bass) is active.
 */
export function exportToMidi(score: Score): Blob {
  const tracks: any[] = [];

  const trebleTrack = new MidiWriter.Track();
  trebleTrack.setTempo(score.tempo || 100);
  trebleTrack.addTrackName((score.title || 'MusikFlo Composition') + (score.staffMode === 'grand' ? ' - Treble' : ''));
  trebleTrack.addEvent(new MidiWriter.ProgramChangeEvent({ instrument: gmProgramFor(score.instrument) }));

  score.measures.forEach((measure) => {
    measure.events.forEach((note) => {
      const duration = note.dotted ? `d${note.duration}` : note.duration;

      if (note.isRest) {
        trebleTrack.addEvent(new MidiWriter.NoteEvent({ pitch: ['C4'], duration, velocity: '0' }));
        return;
      }

      const accidental = note.accidental === '#' ? '#' : note.accidental === 'b' ? 'b' : '';
      trebleTrack.addEvent(
        new MidiWriter.NoteEvent({ pitch: [`${note.step.toUpperCase()}${accidental}${note.octave}`], duration, velocity: 85 })
      );
    });
  });
  tracks.push(trebleTrack);

  if (score.staffMode === 'grand') {
    const bassTrack = new MidiWriter.Track();
    bassTrack.setTempo(score.tempo || 100);
    bassTrack.addTrackName((score.title || 'MusikFlo Composition') + ' - Bass');
    bassTrack.addEvent(new MidiWriter.ProgramChangeEvent({ instrument: gmProgramFor(score.instrument) }));

    score.measures.forEach((measure) => {
      (measure.bassEvents ?? []).forEach((note) => {
        const duration = note.dotted ? `d${note.duration}` : note.duration;

        if (note.isRest) {
          bassTrack.addEvent(new MidiWriter.NoteEvent({ pitch: ['C3'], duration, velocity: '0' }));
          return;
        }

        const accidental = note.accidental === '#' ? '#' : note.accidental === 'b' ? 'b' : '';
        bassTrack.addEvent(
          new MidiWriter.NoteEvent({ pitch: [`${note.step.toUpperCase()}${accidental}${note.octave}`], duration, velocity: 85 })
        );
      });
    });
    tracks.push(bassTrack);
  }

  const bytes = new MidiWriter.Writer(tracks).buildFile();
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
/**
 * Distribute rows evenly across pages, avoiding orphan rows on the last page.
 * Exported so unit tests can verify the pagination logic.
 */
export function computePdfPageRowBatches(totalRowCount: number, targetPerPage = 4): number[][] {
  if (totalRowCount <= 0) return [[]];
  if (totalRowCount <= targetPerPage + 1) {
    return [Array.from({ length: totalRowCount }, (_, i) => i)];
  }

  const pageCount = Math.ceil(totalRowCount / targetPerPage);
  const rowsPerPage = Math.ceil(totalRowCount / pageCount);

  const pages: number[][] = [];
  let row = 0;
  for (let p = 0; p < pageCount; p++) {
    const pageRows: number[] = [];
    const count = p === pageCount - 1 ? totalRowCount - row : Math.min(rowsPerPage, totalRowCount - row);
    for (let i = 0; i < count; i++) {
      pageRows.push(row++);
    }
    if (pageRows.length > 0) {
      pages.push(pageRows);
    }
  }
  return pages;
}

/**
 * Render the score to a multi-page, publication-grade printable PDF in standard
 * Portrait A4 format.
 *
 * Rather than cramming an entire multi-system score onto one page (which reduces
 * 16-32 measure scores to unreadable microscopic strips), this paginates the score
 * into comfortable 3–5 system batches per page. Every system spans the full printable
 * width of the page, ensuring crystal-clear readability on a music stand or piano.
 */
export async function exportScoreToPdf(score: Score, filename: string): Promise<void> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth(); // 595.28 pt
  const pageHeight = doc.internal.pageSize.getHeight(); // 841.89 pt

  const marginX = 36; // 0.5 inch margins
  const printableWidth = pageWidth - marginX * 2; // 523.28 pt

  const layout = getLayoutForScore(score);
  const { canvas, width } = renderScoreToCanvas(score, 2.5);
  if (!canvas) {
    throw new Error('The score could not be engraved for PDF export. Try again once the notation has rendered.');
  }

  const pixelRatio = canvas.width / Math.max(1, width);
  const scale = printableWidth / Math.max(1, width);
  const rowHeightPt = layout.staveHeight * scale;

  const totalRowCount = Math.ceil(Math.max(1, score.measures.length) / layout.measuresPerRow);
  const targetPerPage = score.staffMode === 'grand' ? 2 : 4;
  const pageRowBatches = computePdfPageRowBatches(totalRowCount, targetPerPage);
  const totalPages = pageRowBatches.length;

  pageRowBatches.forEach((pageRows, pageIndex) => {
    if (pageIndex > 0) {
      doc.addPage();
    }

    // Warm cream paper background
    doc.setFillColor(255, 253, 247);
    doc.rect(0, 0, pageWidth, pageHeight, 'F');

    const isFirstPage = pageIndex === 0;

    if (isFirstPage) {
      // Primary Title & Meta Header (Page 1)
      doc.setTextColor(25, 37, 34);
      doc.setFont('times', 'bold');
      doc.setFontSize(22);
      doc.text(score.title || 'Untitled Composition', pageWidth / 2, 44, { align: 'center' });

      doc.setFont('times', 'italic');
      doc.setFontSize(11);
      doc.setTextColor(60, 75, 70);
      doc.text(
        score.composer ? `Composed by ${score.composer}` : 'MusikFlo Studio',
        pageWidth / 2,
        60,
        { align: 'center' }
      );

      const clefDesc =
        score.staffMode === 'grand'
          ? 'Grand Staff (Piano 𝄞 + 𝄢)'
          : score.clef === 'treble'
            ? 'Treble Clef'
            : 'Bass Clef';

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(116, 129, 124);
      doc.text(
        `${clefDesc}   ·   Time Signature: ${score.timeSignature.numerator}/${
          score.timeSignature.denominator
        }   ·   Tempo: ${score.tempo || 100} BPM   ·   Key: ${score.keySignature || 'C'}`,
        pageWidth / 2,
        74,
        { align: 'center' }
      );
    } else {
      // Running Header (Pages 2+)
      doc.setFont('times', 'italic');
      doc.setFontSize(10);
      doc.setTextColor(70, 85, 80);
      doc.text(score.title || 'Untitled Composition', marginX, 34);

      if (score.composer) {
        doc.setFont('times', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(120, 130, 125);
        doc.text(score.composer, pageWidth - marginX, 34, { align: 'right' });
      }

      doc.setDrawColor(220, 225, 222);
      doc.setLineWidth(0.5);
      doc.line(marginX, 40, pageWidth - marginX, 40);
    }

    if (pageRows.length > 0) {
      const rStart = pageRows[0];
      const rowCount = pageRows.length;
      const yScoreStart = layout.startY + rStart * layout.staveHeight;
      const yScoreHeight = rowCount * layout.staveHeight;

      const sX = 0;
      const sY = Math.round(yScoreStart * pixelRatio);
      const sW = canvas.width;
      const sH = Math.min(canvas.height - sY, Math.round(yScoreHeight * pixelRatio));

      const pageCanvas = document.createElement('canvas');
      pageCanvas.width = sW;
      pageCanvas.height = sH;
      const pctx = pageCanvas.getContext('2d');
      if (pctx) {
        pctx.fillStyle = PRINT_PAPER;
        pctx.fillRect(0, 0, sW, sH);
        pctx.drawImage(canvas, sX, sY, sW, sH, 0, 0, sW, sH);
      }

      const renderW = printableWidth;
      const renderH = rowCount * rowHeightPt;
      const renderY = isFirstPage ? 88 : 50;

      doc.addImage(pageCanvas.toDataURL('image/png'), 'PNG', marginX, renderY, renderW, renderH, undefined, 'FAST');
    }

    // Professional Publishing Footer
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(150, 160, 155);
    doc.text('Engraved with MusikFlo — Sheet Music Studio & Composer', marginX, pageHeight - 20);
    doc.text(`Page ${pageIndex + 1} of ${totalPages}`, pageWidth - marginX, pageHeight - 20, { align: 'right' });
  });

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
  const layout = getLayoutForScore(score);
  const width = totalWidth(layout);
  const height = totalHeight(score.measures.length, layout);

  const host = document.createElement('div');
  const rendered = renderScoreInto(host, {
    score,
    palette: PRINT_NOTATION_PALETTE,
    layout,
    backend: 'canvas',
    pixelRatio,
    // Bake the paper colour into the raster so the score never prints onto a
    // transparent background.
    background: PRINT_PAPER,
  });

  return { canvas: rendered.canvas, width, height };
}
