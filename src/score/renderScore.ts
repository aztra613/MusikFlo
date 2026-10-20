import {
  Accidental as VexAccidental,
  Beam,
  Clef as VexClef,
  Dot,
  Formatter,
  KeySignature as VexKeySignature,
  Renderer,
  Stave,
  StaveConnector,
  StaveNote,
  TimeSignature as VexTimeSignature,
} from 'vexflow';
import { Clef, Score, ScoreNote } from '../types/music';
import { toVexflowKey } from '../utils/notationUtils';
import {
  DEFAULT_LAYOUT,
  EventBox,
  GRAND_BASS_OFFSET_Y,
  ScoreLayout,
  STAFF_LINE_SPACING,
  getMeasureRect,
  totalHeight,
  totalWidth,
} from './geometry';

/**
 * Shared score renderer
 * ---------------------
 * One engraving routine, two backends (SVG for the editor, canvas for export).
 *
 * This exists because the PDF export used to serialise the editor's SVG into an
 * `<img>` and rasterise that. VexFlow registers its music fonts (Bravura,
 * Academico) on the *live document's* font registry as data-URI FontFaces, and a
 * standalone SVG loaded through `<img>` cannot see them — so every glyph
 * (clefs, time signatures, noteheads) disappeared from the export. Drawing
 * through a real canvas renderer uses the page's fonts and can also be given a
 * fixed print palette, which fixes the other half of that bug: in dark mode the
 * near-white notation ink was invisible on white PDF paper.
 */

export interface NotationPalette {
  /** Noteheads, stems, clefs, signatures. */
  ink: string;
  /** Staff lines, ledger lines, barlines. */
  staffLine: string;
  /** Playback indication. */
  playhead: string;
  /** Selected note. */
  selection: string;
}

export const LIGHT_NOTATION_PALETTE: NotationPalette = {
  ink: '#192522',
  staffLine: '#9AA79F',
  playhead: '#236D63',
  selection: '#A9701F',
};

export const DARK_NOTATION_PALETTE: NotationPalette = {
  ink: '#F2F5F0',
  // Pale desaturated sage, clearly visible on the dark score surface.
  staffLine: '#84958B',
  playhead: '#83C9B8',
  selection: '#E0B05D',
};

/** Palette used for printed/exported output, regardless of the UI theme. */
export const PRINT_NOTATION_PALETTE: NotationPalette = LIGHT_NOTATION_PALETTE;

export interface RenderedEvent {
  id: string;
  measureIndex: number;
  index: number;
  staff?: 'treble' | 'bass';
  box: EventBox;
}

export interface RenderedScore {
  events: RenderedEvent[];
  /** Top staff line of each measure, indexed by measure. */
  measureTopLines: number[];
  /** Bass staff top line (in Grand Staff mode), indexed by measure. */
  measureBassTopLines?: number[];
  /** X where note content starts in each measure, indexed by measure. */
  noteStartXs: number[];
  svg: SVGSVGElement | null;
  canvas: HTMLCanvasElement | null;
}

export interface RenderScoreOptions {
  score: Score;
  palette: NotationPalette;
  /** SVG for the live editor; canvas for raster export. */
  backend?: 'svg' | 'canvas';
  /** Device-pixel multiplier for the canvas backend, for crisp print output. */
  pixelRatio?: number;
  /** Opaque background painted behind the notation (canvas backend only). */
  background?: string;
  /** Per-event style override, used on screen for selection and playback. */
  emphasizeEvent?: (
    event: ScoreNote,
    measureIndex: number,
    eventIndex: number
  ) => { fillStyle: string; strokeStyle: string } | undefined;
  layout?: ScoreLayout;
}

export function renderScoreInto(container: HTMLDivElement, options: RenderScoreOptions): RenderedScore {
  const {
    score,
    palette,
    backend = 'svg',
    pixelRatio = 1,
    background,
    emphasizeEvent,
    layout = DEFAULT_LAYOUT,
  } = options;

  container.innerHTML = '';

  const width = totalWidth(layout);
  const height = totalHeight(score.measures.length, layout);

  const events: RenderedEvent[] = [];
  const measureTopLines: number[] = [];
  const measureBassTopLines: number[] = [];
  const noteStartXs: number[] = [];
  let svg: SVGSVGElement | null = null;
  let canvas: HTMLCanvasElement | null = null;

  function applyStaveStyles(stave: Stave) {
    stave.setDefaultLedgerLineStyle({ strokeStyle: palette.staffLine, lineWidth: 1.5 });
    stave.getModifiers().forEach((modifier) => {
      const isGlyph =
        modifier instanceof VexClef || modifier instanceof VexTimeSignature || modifier instanceof VexKeySignature;
      modifier.setStyle(
        isGlyph
          ? { fillStyle: palette.ink, strokeStyle: palette.ink }
          : { fillStyle: palette.staffLine, strokeStyle: palette.staffLine, lineWidth: 1.5 }
      );
    });
  }

  function renderVoice(
    context: ReturnType<Renderer['getContext']>,
    stave: Stave,
    notes: ScoreNote[],
    clef: Clef,
    mIdx: number,
    staff?: 'treble' | 'bass'
  ) {
    if (notes.length === 0) return;
    const pairs: Array<{ event: ScoreNote; vfNote: StaveNote }> = [];

    notes.forEach((note, eIdx) => {
      let duration = note.duration;
      if (note.isRest) duration += 'r';

      try {
        const staveNote = new StaveNote({ clef, keys: [toVexflowKey(note)], duration });

        if (note.accidental && !note.isRest) {
          staveNote.addModifier(new VexAccidental(note.accidental), 0);
        }
        if (note.dotted) {
          staveNote.addModifier(new Dot(), 0);
        }

        staveNote.setStyle(emphasizeEvent?.(note, mIdx, eIdx) ?? { fillStyle: palette.ink, strokeStyle: palette.ink });

        pairs.push({ event: note, vfNote: staveNote });
      } catch (err) {
        console.warn('VexFlow note parsing warning:', err);
      }
    });

    if (pairs.length === 0) return;

    try {
      const vfNotes = pairs.map((pair) => pair.vfNote);
      const beams = Beam.generateBeams(vfNotes);

      Formatter.FormatAndDraw(context, stave, vfNotes);

      beams.forEach((beam) => {
        beam.setStyle({ fillStyle: palette.ink, strokeStyle: palette.ink });
        beam.setContext(context).draw();
      });

      pairs.forEach(({ event, vfNote }, index) => {
        const ys = vfNote.getYs();
        const noteheadY = ys && ys[0] !== undefined ? ys[0] : stave.getYForLine(2);
        const noteheadX = vfNote.getAbsoluteX();
        const glyphWidth = vfNote.getGlyphWidth() || 12;

        events.push({
          id: event.id,
          measureIndex: mIdx,
          index,
          staff,
          box: {
            id: event.id,
            x: noteheadX - glyphWidth / 2 - 6,
            y: noteheadY - 13,
            width: glyphWidth + 12,
            height: 26,
            centerX: noteheadX + glyphWidth / 2,
            centerY: noteheadY,
          },
        });
      });
    } catch (formatErr) {
      console.warn('VexFlow format error:', formatErr);
    }
  }

  try {
    // VexFlow's canvas backend requires the canvas element itself (a div throws
    // BadElement), so the canvas is created here and handed to the renderer.
    if (backend === 'canvas') {
      canvas = document.createElement('canvas');
      container.appendChild(canvas);
    }

    const renderer = new Renderer(
      canvas ?? container,
      backend === 'canvas' ? Renderer.Backends.CANVAS : Renderer.Backends.SVG
    );

    if (canvas) {
      // Backing store is `pixelRatio` larger than the logical score size; all
      // drawing below stays in score units.
      renderer.resize(width * pixelRatio, height * pixelRatio);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      if (background) {
        const flat = canvas.getContext('2d');
        if (flat) {
          flat.fillStyle = background;
          flat.fillRect(0, 0, canvas.width, canvas.height);
        }
      }
    } else {
      renderer.resize(width, height);
      svg = container.querySelector('svg');
    }

    const context = renderer.getContext();

    if (canvas) {
      context.scale(pixelRatio, pixelRatio);
    } else if (svg) {
      // One explicit scaling mechanism: the viewBox maps score units to screen
      // pixels. There is no CSS transform and no second zoom factor.
      svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    }

    const isGrand = score.staffMode === 'grand';

    score.measures.forEach((measure, mIdx) => {
      const rect = getMeasureRect(mIdx, layout);

      if (isGrand) {
        const trebleStave = new Stave(rect.x, rect.y, rect.width);
        const bassY = rect.y + (layout.bassOffsetY ?? GRAND_BASS_OFFSET_Y);
        const bassStave = new Stave(rect.x, bassY, rect.width);

        if (rect.col === 0) {
          trebleStave.addClef('treble');
          bassStave.addClef('bass');
          if (score.keySignature && score.keySignature !== 'C') {
            try {
              trebleStave.addKeySignature(score.keySignature);
              bassStave.addKeySignature(score.keySignature);
            } catch {}
          }
        }
        if (mIdx === 0 || score.showTimeSigOnEveryBar) {
          const timeSig = `${score.timeSignature.numerator}/${score.timeSignature.denominator}`;
          trebleStave.addTimeSignature(timeSig);
          bassStave.addTimeSignature(timeSig);
        }

        applyStaveStyles(trebleStave);
        applyStaveStyles(bassStave);

        context.setStrokeStyle(palette.staffLine);
        context.setFillStyle(palette.staffLine);
        context.setLineWidth(1);

        trebleStave.setContext(context);
        trebleStave.draw();
        bassStave.setContext(context);
        bassStave.draw();

        // Connect staves with Grand Staff brace and barlines
        if (rect.col === 0) {
          const brace = new StaveConnector(trebleStave, bassStave);
          brace.setType(StaveConnector.type.BRACE);
          brace.setContext(context);
          brace.draw();

          const leftLine = new StaveConnector(trebleStave, bassStave);
          leftLine.setType(StaveConnector.type.SINGLE_LEFT);
          leftLine.setContext(context);
          leftLine.draw();
        }

        const rightLine = new StaveConnector(trebleStave, bassStave);
        rightLine.setType(StaveConnector.type.SINGLE_RIGHT);
        rightLine.setContext(context);
        rightLine.draw();

        measureTopLines.push(trebleStave.getYForLine(0));
        measureBassTopLines.push(bassStave.getYForLine(0));
        noteStartXs.push(Math.max(trebleStave.getNoteStartX(), bassStave.getNoteStartX()));

        renderVoice(context, trebleStave, measure.events, 'treble', mIdx, 'treble');
        renderVoice(context, bassStave, measure.bassEvents ?? [], 'bass', mIdx, 'bass');
      } else {
        const stave = new Stave(rect.x, rect.y, rect.width);

        if (rect.col === 0) {
          stave.addClef(score.clef);
          if (score.keySignature && score.keySignature !== 'C') {
            try {
              stave.addKeySignature(score.keySignature);
            } catch {}
          }
        }
        if (mIdx === 0 || score.showTimeSigOnEveryBar) {
          stave.addTimeSignature(`${score.timeSignature.numerator}/${score.timeSignature.denominator}`);
        }

        applyStaveStyles(stave);

        context.setStrokeStyle(palette.staffLine);
        context.setFillStyle(palette.staffLine);
        context.setLineWidth(1);

        stave.setContext(context);
        stave.draw();

        measureTopLines.push(stave.getYForLine(0));
        noteStartXs.push(stave.getNoteStartX());

        renderVoice(context, stave, measure.events, score.clef, mIdx, score.clef);
      }
    });
  } catch (err) {
    console.error('VexFlow render error:', err);
  }

  return { events, measureTopLines, measureBassTopLines, noteStartXs, svg, canvas };
}

export const STAFF_LINE_SPACING_PX = STAFF_LINE_SPACING;
