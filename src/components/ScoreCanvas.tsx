import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Accidental as AccidentalType, NoteDuration, Score, ScoreNote, getScientificPitch } from '../types/music';
import { getPitchFromLine, isValidStaffLine, shiftDiatonic, MIN_STAFF_LINE, MAX_STAFF_LINE } from '../utils/notationUtils';
import {
  DEFAULT_LAYOUT,
  MEASURES_PER_ROW,
  STAFF_LINE_SPACING,
  findEventAtPoint,
  getMeasureIndexAtPoint,
  getMeasureRect,
  getRowTopLineY,
  insertionIndexForX,
  staffLineToY,
  totalHeight,
  totalWidth,
  yToStaffLine,
} from '../score/geometry';
import {
  DARK_NOTATION_PALETTE,
  LIGHT_NOTATION_PALETTE,
  RenderedEvent,
  renderScoreInto,
} from '../score/renderScore';
import { Selection } from '../editor/editorReducer';
import { audioEngine } from '../audio/audioEngine';
import { ZoomIn, ZoomOut, RotateCcw, Trash2, ArrowUp, ArrowDown, X, Copy, ClipboardPaste } from 'lucide-react';

export type EditorTool = 'select' | 'note' | 'rest' | 'eraser';

/** Screen-space padding applied to every event hit target (touch friendly). */
const HIT_SLOP_SCREEN_PX = 12;

interface ScoreCanvasProps {
  score: Score;
  selection: Selection;
  onSelectNote: (noteId: string | null) => void;
  onSelectMeasure: (measureIndex: number | null) => void;
  onInsertEvent: (measureIndex: number, index: number, event: Omit<ScoreNote, 'id'>) => void;
  onUpdateNote: (noteId: string, updates: Partial<ScoreNote>) => void;
  onDeleteNote: (noteId: string) => void;
  onDuplicateMeasure: (measureIndex: number) => void;
  onDuplicateLine: (lineIndex: number) => void;
  onCopyMeasure: (measureIndex: number) => void;
  onPasteMeasure: (measureIndex: number) => void;
  onClearMeasure: (measureIndex: number) => void;
  copiedMeasureIndex: number | null;
  hasCopiedMeasure: boolean;
  activeDuration: NoteDuration;
  activeAccidental: AccidentalType | '';
  activeDotted: boolean;
  activeTool: EditorTool;
  learningMode: boolean;
  activePlayhead: { measureIndex: number; eventIndex: number; isPlaying: boolean } | null;
  theme: 'light' | 'dark';
}

interface HoverState {
  measureIndex: number;
  line: number;
  y: number;
  x: number;
  label: string;
  isLedger: boolean;
}

export const ScoreCanvas: React.FC<ScoreCanvasProps> = ({
  score,
  selection,
  onSelectNote,
  onSelectMeasure,
  onInsertEvent,
  onUpdateNote,
  onDeleteNote,
  onDuplicateMeasure,
  onDuplicateLine,
  onCopyMeasure,
  onPasteMeasure,
  onClearMeasure,
  copiedMeasureIndex,
  hasCopiedMeasure,
  activeDuration,
  activeAccidental,
  activeDotted,
  activeTool,
  learningMode,
  activePlayhead,
  theme,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const viewportRef = useRef<HTMLDivElement>(null);

  const [zoomLevel, setZoomLevel] = useState(1);
  const [hoveredNoteId, setHoveredNoteId] = useState<string | null>(null);
  const [hover, setHover] = useState<HoverState | null>(null);

  // Geometry is committed to state after each render pass, so React overlays are
  // always drawn from the same pass that produced the SVG. Reading refs that were
  // mutated after commit is what previously left halos on stale positions.
  const [renderedEvents, setRenderedEvents] = useState<RenderedEvent[]>([]);
  /** Top staff line of each rendered measure, indexed by measure. */
  const [measureTopLines, setMeasureTopLines] = useState<number[]>([]);
  const [noteStartXs, setNoteStartXs] = useState<number[]>([]);

  const palette = theme === 'dark' ? DARK_NOTATION_PALETTE : LIGHT_NOTATION_PALETTE;
  const layout = DEFAULT_LAYOUT;
  const svgWidth = totalWidth(layout);
  const svgHeight = totalHeight(score.measures.length, layout);

  const selectedNoteId = selection.kind === 'event' ? selection.noteId : null;
  const selectedMeasureIndex = selection.kind === 'measure' ? selection.measureIndex : null;

  const selectedNote = useMemo(() => {
    if (!selectedNoteId) return null;
    for (const measure of score.measures) {
      const found = measure.events.find((n) => n.id === selectedNoteId);
      if (found) return found;
    }
    return null;
  }, [selectedNoteId, score]);

  const selectedNotePitch = selectedNote ? getScientificPitch(selectedNote) : '';
  const selectedBox = useMemo(
    () => (selectedNoteId ? renderedEvents.find((e) => e.id === selectedNoteId)?.box : undefined),
    [renderedEvents, selectedNoteId]
  );

  /* ------------------------------------------------------------------ */
  /* Notation rendering (shared with the export renderer)                */
  /* ------------------------------------------------------------------ */

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const rendered = renderScoreInto(container, {
      score,
      palette,
      layout,
      emphasizeEvent: (note, mIdx) => {
        const measure = score.measures[mIdx];
        const isPlaying =
          !!activePlayhead?.isPlaying &&
          activePlayhead.measureIndex === mIdx &&
          measure?.events[activePlayhead.eventIndex]?.id === note.id;
        if (isPlaying) return { fillStyle: palette.playhead, strokeStyle: palette.playhead };
        if (selectedNoteId === note.id) return { fillStyle: palette.selection, strokeStyle: palette.selection };
        return undefined;
      },
    });

    svgRef.current = rendered.svg;
    if (rendered.svg) {
      rendered.svg.style.width = `${svgWidth * zoomLevel}px`;
      rendered.svg.style.height = `${svgHeight * zoomLevel}px`;
      rendered.svg.style.display = 'block';
    }

    setRenderedEvents(rendered.events);
    setMeasureTopLines(rendered.measureTopLines);
    setNoteStartXs(rendered.noteStartXs);
  }, [score, selectedNoteId, activePlayhead, palette, layout, svgWidth, svgHeight, zoomLevel]);

  /* ------------------------------------------------------------------ */
  /* Pointer handling                                                    */
  /* ------------------------------------------------------------------ */

  /** Convert a browser pointer event into score-space coordinates. */
  const toScorePoint = useCallback(
    (clientX: number, clientY: number) => {
      const svg = svgRef.current;
      if (!svg) return null;

      const matrix = svg.getScreenCTM?.();
      if (matrix && typeof DOMPoint !== 'undefined') {
        const point = new DOMPoint(clientX, clientY).matrixTransform(matrix.inverse());
        return { x: point.x, y: point.y, scaleX: Math.abs(matrix.a) || zoomLevel };
      }

      // Fallback for environments without the SVG matrix APIs: measure the SVG.
      const rect = svg.getBoundingClientRect();
      const scaleX = rect.width / svgWidth || zoomLevel;
      return { x: (clientX - rect.left) / scaleX, y: (clientY - rect.top) / scaleX, scaleX };
    },
    [svgWidth, zoomLevel]
  );

  /** Nearest existing event to a score-space point, ranked within its row. */
  const hitTestEvent = useCallback(
    (x: number, y: number, scaleX: number, row: number): string | null => {
      const preferIds = new Set(
        renderedEvents.filter((e) => getMeasureRect(e.measureIndex, layout).row === row).map((e) => e.id)
      );
      return findEventAtPoint(
        x,
        y,
        renderedEvents.map((e) => e.box),
        { slopScore: HIT_SLOP_SCREEN_PX / scaleX, preferIds }
      );
    },
    [renderedEvents, layout]
  );

  /** Staff line and pitch for a score-space point inside a measure. */
  const resolvePitchAt = useCallback(
    (x: number, y: number, measureIndex: number): HoverState | null => {
      const rect = getMeasureRect(measureIndex, layout);

      // `measureTopLines` is indexed by *measure*, not by row. Reading it with
      // the row index made every system below the first measure against row 0's
      // staff geometry, which is what produced wrong pitches (or no placement at
      // all) as soon as a score grew past one row.
      const topLineY = measureTopLines[measureIndex] ?? getRowTopLineY(rect.row, layout);
      const metrics = { topLineY, lineSpacing: STAFF_LINE_SPACING };

      const rawLine = yToStaffLine(y, metrics);
      const line = Math.max(MIN_STAFF_LINE, Math.min(MAX_STAFF_LINE, rawLine));
      if (!isValidStaffLine(line)) return null;

      const pitch = getPitchFromLine(line, score.clef);
      return {
        measureIndex,
        line,
        y: staffLineToY(line, metrics),
        x,
        label: pitch.label,
        isLedger: pitch.isLedger,
      };
    },
    [layout, measureTopLines, score.clef]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const point = toScorePoint(e.clientX, e.clientY);
      if (!point) return;

      const measureIndex = getMeasureIndexAtPoint(point.x, point.y, score.measures.length, layout);
      if (measureIndex === -1) {
        setHover(null);
        setHoveredNoteId(null);
        return;
      }

      const row = getMeasureRect(measureIndex, layout).row;
      const hovered = hitTestEvent(point.x, point.y, point.scaleX, row);
      setHoveredNoteId(hovered);

      if (hovered || activeTool === 'select' || activeTool === 'eraser') {
        setHover(null);
        return;
      }

      setHover(resolvePitchAt(point.x, point.y, measureIndex));
    },
    [activeTool, hitTestEvent, layout, resolvePitchAt, score.measures.length, toScorePoint]
  );

  const handlePointerLeave = useCallback(() => {
    setHover(null);
    setHoveredNoteId(null);
  }, []);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const point = toScorePoint(e.clientX, e.clientY);
      if (!point) return;

      const measureIndex = getMeasureIndexAtPoint(point.x, point.y, score.measures.length, layout);

      // Everything below is derived from *this* event. Nothing depends on the
      // previous pointermove, which is what made tap-to-place impossible on
      // touch and could place a note at a stale hover pitch.
      const row = measureIndex === -1 ? -1 : getMeasureRect(measureIndex, layout).row;
      const targetId = measureIndex === -1 ? null : hitTestEvent(point.x, point.y, point.scaleX, row);

      if (activeTool === 'eraser') {
        if (targetId) onDeleteNote(targetId);
        return;
      }

      // An existing event is always selected, never stacked over, in note/rest
      // mode; the select tool never inserts anything at all.
      if (targetId) {
        onSelectNote(targetId);
        const found = score.measures.flatMap((m) => m.events).find((n) => n.id === targetId);
        if (found && !found.isRest) audioEngine.previewNote(found, score.instrument);
        return;
      }

      if (activeTool === 'select' || measureIndex === -1) {
        onSelectNote(null);
        return;
      }

      const pitch = resolvePitchAt(point.x, point.y, measureIndex);
      if (!pitch) return;

      // Placement is restricted to the note content area so clefs, key and time
      // signatures are not treated as note positions.
      const staveX = rect.x;
      const fallbackNoteStart = rect.col === 0 ? staveX + 130 : staveX + 15;
      const noteStartX = noteStartXs[measureIndex] ?? fallbackNoteStart;
      if (point.x < noteStartX) {
        onSelectNote(null);
        return;
      }

      const measureEvents = renderedEvents
        .filter((ev) => ev.measureIndex === measureIndex)
        .sort((a, b) => a.index - b.index)
        .map((ev) => ev.box);

      const resolved = getPitchFromLine(pitch.line, score.clef);
      onInsertEvent(measureIndex, insertionIndexForX(point.x, measureEvents), {
        step: resolved.step,
        octave: resolved.octave,
        duration: activeDuration,
        dotted: activeDotted || undefined,
        accidental: activeAccidental || undefined,
        isRest: activeTool === 'rest',
      });

      if (activeTool === 'note') {
        audioEngine.previewNote(
          {
            id: 'preview',
            step: resolved.step,
            octave: resolved.octave,
            duration: activeDuration,
            accidental: activeAccidental || undefined,
          },
          score.instrument
        );
      }
    },
    [
      activeAccidental,
      activeDotted,
      activeDuration,
      activeTool,
      hitTestEvent,
      layout,
      noteStartXs,
      onDeleteNote,
      onInsertEvent,
      onSelectNote,
      renderedEvents,
      resolvePitchAt,
      score.clef,
      score.instrument,
      score.measures,
      toScorePoint,
    ]
  );

  /* ------------------------------------------------------------------ */
  /* Derived overlay geometry                                            */
  /* ------------------------------------------------------------------ */

  const hoveredBox = useMemo(
    () => (hoveredNoteId ? renderedEvents.find((e) => e.id === hoveredNoteId)?.box : undefined),
    [renderedEvents, hoveredNoteId]
  );

  const playingBox = useMemo(() => {
    if (!activePlayhead?.isPlaying) return undefined;
    const note = score.measures[activePlayhead.measureIndex]?.events[activePlayhead.eventIndex];
    return note ? renderedEvents.find((e) => e.id === note.id)?.box : undefined;
  }, [activePlayhead, score.measures, renderedEvents]);

  const handlePitchStep = (delta: number) => {
    if (!selectedNote || selectedNote.isRest) return;
    const { step, octave } = shiftDiatonic(selectedNote.step, selectedNote.octave, delta);
    onUpdateNote(selectedNote.id, { step, octave });
    audioEngine.previewNote({ ...selectedNote, step, octave }, score.instrument);
  };

  const cursor =
    activeTool === 'select' || activeTool === 'eraser'
      ? 'default'
      : hoveredNoteId
        ? 'pointer'
        : hover
          ? 'crosshair'
          : 'default';

  const scale = (n: number) => n * zoomLevel;

  // Auto-scroll viewport smoothly during playback so the active measure remains in view
  useEffect(() => {
    if (!activePlayhead?.isPlaying || !viewportRef.current) return;
    const viewport = viewportRef.current;
    const rect = getMeasureRect(activePlayhead.measureIndex, layout);

    const measureLeft = rect.x * zoomLevel;
    const measureRight = (rect.x + rect.width) * zoomLevel;
    const measureTop = rect.y * zoomLevel;
    const measureBottom = (rect.y + rect.height) * zoomLevel;

    const clientW = viewport.clientWidth;
    const clientH = viewport.clientHeight;
    const scrollL = viewport.scrollLeft;
    const scrollT = viewport.scrollTop;

    let targetScrollX = scrollL;
    let targetScrollY = scrollT;
    let needsScroll = false;

    // Horizontal check
    if (measureLeft < scrollL + 40) {
      targetScrollX = Math.max(0, measureLeft - 40);
      needsScroll = true;
    } else if (measureRight > scrollL + clientW - 40) {
      targetScrollX = Math.max(0, measureRight - clientW + 60);
      needsScroll = true;
    }

    // Vertical check
    if (measureTop < scrollT + 40) {
      targetScrollY = Math.max(0, measureTop - 40);
      needsScroll = true;
    } else if (measureBottom > scrollT + clientH - 40) {
      targetScrollY = Math.max(0, measureBottom - clientH + 60);
      needsScroll = true;
    }

    if (needsScroll) {
      viewport.scrollTo({
        left: targetScrollX,
        top: targetScrollY,
        behavior: 'smooth',
      });
    }
  }, [activePlayhead?.measureIndex, activePlayhead?.isPlaying, layout, zoomLevel]);

  return (
    <div className="relative flex flex-col w-full h-full select-none">
      {/* Canvas toolbar: selection context + zoom */}
      <div className="flex items-center justify-between gap-2 px-4 py-2 border-b border-border bg-surface text-xs text-text-secondary min-h-[41px]">
        {selectedNoteId && selectedNote ? (
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="font-semibold text-brass flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-brass" aria-hidden="true" />
              <span>Selected:</span>
              <strong className="text-text-primary font-mono">{selectedNotePitch}</strong>
            </span>
            <div className="flex items-center gap-0.5 bg-app-bg p-0.5 rounded border border-border">
              <button
                type="button"
                onClick={() => handlePitchStep(1)}
                disabled={!!selectedNote.isRest}
                className="px-2 py-0.5 rounded hover:bg-surface text-text-primary font-medium disabled:opacity-40"
                title="Step pitch up (↑)"
              >
                ↑ Up
              </button>
              <button
                type="button"
                onClick={() => handlePitchStep(-1)}
                disabled={!!selectedNote.isRest}
                className="px-2 py-0.5 rounded hover:bg-surface text-text-primary font-medium disabled:opacity-40"
                title="Step pitch down (↓)"
              >
                ↓ Down
              </button>
            </div>
            <button
              type="button"
              onClick={() => onSelectNote(null)}
              className="text-text-muted hover:text-text-primary underline"
            >
              Deselect (Esc)
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-3 flex-wrap">
            <span className="font-medium text-text-primary">{score.title}</span>
            <span aria-hidden="true">·</span>
            <span>{score.clef === 'treble' ? 'Treble Clef' : 'Bass Clef'}</span>
            <span aria-hidden="true">·</span>
            <span>
              {score.timeSignature.numerator}/{score.timeSignature.denominator}
            </span>
            <span aria-hidden="true">·</span>
            <span>{score.tempo} BPM</span>
          </div>
        )}

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => setZoomLevel((z) => Math.max(0.7, Math.round((z - 0.1) * 10) / 10))}
            className="p-1 rounded-md hover:bg-primary-soft hover:text-primary transition-colors"
            title="Zoom out"
            aria-label="Zoom out"
          >
            <ZoomOut size={16} />
          </button>
          <span className="w-10 text-center font-mono tabular-nums text-text-muted">{Math.round(zoomLevel * 100)}%</span>
          <button
            type="button"
            onClick={() => setZoomLevel((z) => Math.min(1.5, Math.round((z + 0.1) * 10) / 10))}
            className="p-1 rounded-md hover:bg-primary-soft hover:text-primary transition-colors"
            title="Zoom in"
            aria-label="Zoom in"
          >
            <ZoomIn size={16} />
          </button>
          <button
            type="button"
            onClick={() => setZoomLevel(1)}
            className="p-1 ml-1 rounded-md hover:bg-primary-soft hover:text-primary transition-colors"
            title="Reset zoom"
            aria-label="Reset zoom"
          >
            <RotateCcw size={14} />
          </button>
        </div>
      </div>

      {/* Score viewport.
          Centring an overflowing child (with justify-center or auto margins)
          clips the start of the score and makes those pixels unreachable, so the
          score sits in a row that is `min-w-full` — it centres while there is
          room and grows to the left origin once the score is wider, keeping every
          part of a long score scrollable into view. */}
      <div
        ref={viewportRef}
        className="relative flex-1 overflow-auto bg-paper transition-colors duration-150 touch-manipulation"
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
        onPointerDown={handlePointerDown}
        style={{ cursor }}
      >
        <div className="flex w-max min-w-full justify-center p-6 md:p-8">
          <div className="relative shrink-0" style={{ width: scale(svgWidth), height: scale(svgHeight) }}>
            <div ref={containerRef} id="score-svg-target" className="absolute top-0 left-0 pointer-events-none" />

          {score.measures.map((measure, mIdx) => {
            const topLineY = measureTopLines[mIdx];
            if (topLineY === undefined) return null;

            const rect = getMeasureRect(mIdx, layout);
            const isSelectedMeasure = selectedMeasureIndex === mIdx;

            return (
              <React.Fragment key={measure.id}>
                {rect.col === 0 && (
                  <div
                    className="absolute z-20 flex items-center justify-between gap-3 text-[11px] font-sans font-medium px-1 text-text-secondary"
                    style={{
                      left: scale(rect.x),
                      top: Math.max(0, scale(topLineY - 54)),
                      width: scale(layout.measureWidth * MEASURES_PER_ROW),
                    }}
                  >
                    <span className="font-bold text-text-primary uppercase tracking-wider text-[10px] px-2 py-0.5 rounded-md bg-surface border border-border shadow-2xs">
                      Line {rect.row + 1} (Bars {rect.row * MEASURES_PER_ROW + 1}–
                      {Math.min(score.measures.length, (rect.row + 1) * MEASURES_PER_ROW)})
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDuplicateLine(rect.row);
                      }}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-surface hover:bg-primary-soft text-text-primary hover:text-primary border border-border transition-all text-[11px] font-semibold pointer-events-auto shadow-2xs"
                      title={`Duplicate Line ${rect.row + 1} to the next line`}
                    >
                      <Copy size={12} />
                      <span>Duplicate Line</span>
                    </button>
                  </div>
                )}

                {isSelectedMeasure && (
                  <div
                    className="absolute pointer-events-none rounded-lg border-2 border-primary/40 bg-primary/5"
                    style={{
                      left: scale(rect.x - 4),
                      top: scale(topLineY - 4),
                      width: scale(layout.measureWidth + 8),
                      height: scale(112),
                    }}
                  />
                )}

                <div
                  className={`absolute z-20 flex items-center justify-between gap-2 text-[11px] font-mono px-2 rounded-t-md transition-colors cursor-pointer ${
                    isSelectedMeasure
                      ? 'bg-primary-soft/50 border-b border-primary/40 text-primary font-semibold'
                      : 'text-text-secondary hover:bg-surface-raised/40'
                  }`}
                  style={{
                    left: scale(rect.x),
                    top: Math.max(2, scale(topLineY - 30)),
                    width: scale(layout.measureWidth),
                  }}
                  onClick={() => onSelectMeasure(isSelectedMeasure ? null : mIdx)}
                  title="Select this bar"
                >
                  <span className="flex items-center gap-1.5 pointer-events-none">
                    <span className="font-bold text-text-primary">Bar {mIdx + 1}</span>
                    <span className="text-[10px] px-1 rounded bg-surface border border-border font-medium text-text-muted">
                      {score.timeSignature.numerator}/{score.timeSignature.denominator}
                    </span>
                  </span>

                  <span className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDuplicateMeasure(mIdx);
                      }}
                      className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-surface hover:bg-primary-soft text-text-secondary hover:text-primary border border-border transition-colors text-[10px] font-sans font-medium pointer-events-auto shadow-2xs"
                      title={`Duplicate Bar ${mIdx + 1} to the next bar (Ctrl+D)`}
                    >
                      <Copy size={11} />
                      <span>Duplicate</span>
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onCopyMeasure(mIdx);
                      }}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-sans font-medium border transition-colors pointer-events-auto ${
                        copiedMeasureIndex === mIdx
                          ? 'bg-primary text-white border-primary'
                          : 'bg-surface hover:bg-app-bg text-text-secondary border-border'
                      }`}
                      title={`Copy Bar ${mIdx + 1} notes`}
                    >
                      {copiedMeasureIndex === mIdx ? 'Copied' : 'Copy'}
                    </button>

                    {hasCopiedMeasure && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onPasteMeasure(mIdx);
                        }}
                        className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-primary text-white hover:bg-primary-hover border border-primary transition-colors text-[10px] font-sans font-semibold pointer-events-auto"
                        title={`Paste into Bar ${mIdx + 1}`}
                      >
                        <ClipboardPaste size={11} />
                        <span>Paste</span>
                      </button>
                    )}

                    {measure.events.length > 0 && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onClearMeasure(mIdx);
                        }}
                        className="p-1 rounded text-text-muted hover:text-danger hover:bg-danger-bg transition-colors pointer-events-auto"
                        title={`Clear notes in Bar ${mIdx + 1}`}
                      >
                        <Trash2 size={11} />
                      </button>
                    )}
                  </span>
                </div>
              </React.Fragment>
            );
          })}

          {/* Placement preview, computed from the live pointer position */}
          {hover && !hoveredNoteId && (activeTool === 'note' || activeTool === 'rest') && (
            <div
              className="absolute pointer-events-none"
              style={{ left: scale(hover.x - 8), top: scale(hover.y - 6), width: scale(16), height: scale(12) }}
            >
              {hover.isLedger && (
                <div className="absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 w-7 h-[1.5px] bg-primary" />
              )}
              <div className="w-full h-full rounded-full border-2 border-primary bg-primary/30 -rotate-20" />
              <div className="absolute left-1/2 -top-7 -translate-x-1/2 whitespace-nowrap px-1.5 py-0.5 rounded bg-surface-raised border border-border text-[10px] font-mono font-semibold text-primary shadow-xs z-50">
                {hover.label}
              </div>
            </div>
          )}

          {/* Hover feedback on a non-selected event */}
          {hoveredBox && hoveredNoteId !== selectedNoteId && (
            <div
              className="absolute pointer-events-none rounded border border-dashed border-primary bg-primary/10"
              style={{
                left: scale(hoveredBox.x - 5),
                top: scale(hoveredBox.y - 5),
                width: scale(hoveredBox.width + 10),
                height: scale(hoveredBox.height + 10),
              }}
            >
              <div className="absolute -top-5 left-1/2 -translate-x-1/2 whitespace-nowrap px-1 rounded bg-surface-raised border border-border text-[9px] font-mono font-semibold text-primary shadow-2xs">
                {activeTool === 'eraser' ? 'Click to delete' : 'Click to select'}
              </div>
            </div>
          )}

          {/* Selected event: non-colour-only outline plus anchored actions */}
          {selectedBox && (
            <>
              <div
                data-note-id={selectedNoteId ?? undefined}
                className="absolute pointer-events-none rounded border-2 border-brass bg-brass/10"
                style={{
                  left: scale(selectedBox.x - 5),
                  top: scale(selectedBox.y - 5),
                  width: scale(selectedBox.width + 10),
                  height: scale(selectedBox.height + 10),
                }}
              />

              <div
                className="absolute z-40 flex items-center gap-1.5 p-1 rounded-xl bg-surface-raised border border-border shadow-lg"
                style={{
                  left: scale(selectedBox.centerX),
                  top: Math.max(8, scale(selectedBox.y - 48)),
                  transform: 'translateX(-50%)',
                }}
                onPointerDown={(e) => e.stopPropagation()}
              >
                <span className="font-mono font-bold text-xs px-2 py-0.5 rounded-md bg-brass/15 text-brass border border-brass/30">
                  {selectedNotePitch}
                </span>

                <span className="flex items-center gap-0.5 bg-app-bg rounded-md p-0.5 border border-border">
                  <button
                    type="button"
                    onClick={() => handlePitchStep(1)}
                    disabled={!!selectedNote?.isRest}
                    className="p-1 rounded hover:bg-surface text-text-primary disabled:opacity-40"
                    title="Step pitch up (↑)"
                    aria-label="Step pitch up"
                  >
                    <ArrowUp size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePitchStep(-1)}
                    disabled={!!selectedNote?.isRest}
                    className="p-1 rounded hover:bg-surface text-text-primary disabled:opacity-40"
                    title="Step pitch down (↓)"
                    aria-label="Step pitch down"
                  >
                    <ArrowDown size={13} />
                  </button>
                </span>

                <button
                  type="button"
                  onClick={() => selectedNoteId && onDeleteNote(selectedNoteId)}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold text-white bg-danger hover:bg-danger/90 transition-all shadow-xs"
                  title="Delete this event (Del or Backspace)"
                >
                  <Trash2 size={13} />
                  <span>{selectedNote?.isRest ? 'Delete rest' : 'Delete note'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => onSelectNote(null)}
                  className="p-1 rounded-md text-text-muted hover:text-text-primary hover:bg-app-bg"
                  title="Deselect (Esc)"
                  aria-label="Deselect"
                >
                  <X size={14} />
                </button>
              </div>
            </>
          )}

          {/* Playhead: driven by the real audio timeline */}
          {playingBox && (
            <>
              <div
                className="absolute pointer-events-none rounded-full border-2 border-playhead bg-playhead/20"
                style={{
                  left: scale(playingBox.x - 6),
                  top: scale(playingBox.y - 6),
                  width: scale(playingBox.width + 12),
                  height: scale(playingBox.height + 12),
                }}
              />
              <div
                className="absolute pointer-events-none w-0.5 bg-playhead"
                style={{
                  left: scale(playingBox.centerX),
                  top: scale(playingBox.y - 24),
                  height: scale(playingBox.height + 48),
                }}
              />
            </>
          )}

          {/* Learning mode letters, aligned below each stave */}
          {learningMode && (
            <div className="absolute inset-0 pointer-events-none">
              {renderedEvents.map((rendered) => {
                const event = score.measures[rendered.measureIndex]?.events[rendered.index];
                const topLineY = measureTopLines[rendered.measureIndex];
                if (!event || event.isRest || topLineY === undefined) return null;

                return (
                  <div
                    key={`label-${rendered.id}`}
                    className="absolute -translate-x-1/2 flex flex-col items-center"
                    style={{ left: scale(rendered.box.centerX), top: scale(topLineY + STAFF_LINE_SPACING * 4 + 28) }}
                  >
                    <div className="w-px h-2.5 bg-brass/50 mb-0.5" />
                    <div className="font-mono font-bold text-[10px] text-text-primary px-1.5 py-0.5 rounded-md bg-surface-raised border border-brass/50 shadow-2xs whitespace-nowrap">
                      {getScientificPitch(event)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          </div>
        </div>
      </div>
    </div>
  );
};
