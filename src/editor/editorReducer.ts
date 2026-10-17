import { Measure, Score, ScoreNote } from '../types/music';

/**
 * A single, discriminated selection model. Note and measure selection can no
 * longer both be active, which removes the ambiguity between "delete the note"
 * and "the bar I am looping".
 */
export type Selection =
  | { kind: 'none' }
  | { kind: 'event'; noteId: string }
  | { kind: 'measure'; measureIndex: number };

export const NO_SELECTION: Selection = { kind: 'none' };

export interface EditorState {
  score: Score;
  past: Score[];
  future: Score[];
  selection: Selection;
  /** Increments on every accepted mutation; drives debounced autosave. */
  revision: number;
}

export const HISTORY_LIMIT = 40;

export type EditorAction =
  | {
      /**
       * Apply a pure transformation. Returning `null` (or the same score object)
       * rejects the edit, so no-op clicks never pollute the undo stack.
       */
      type: 'mutate';
      mutate: (score: Score) => Score | null;
      /** Selection after the mutation. Omitted = keep, `'auto'` = reconcile. */
      selection?: Selection | 'auto';
      /** Set to false for structural resets that should not be undoable. */
      history?: boolean;
    }
  | { type: 'select'; selection: Selection }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'reset'; score: Score; selection?: Selection };

export function createEditorState(score: Score): EditorState {
  return { score, past: [], future: [], selection: NO_SELECTION, revision: 0 };
}

export function selectionNoteId(selection: Selection): string | null {
  return selection.kind === 'event' ? selection.noteId : null;
}

export function selectionMeasureIndex(selection: Selection): number | null {
  return selection.kind === 'measure' ? selection.measureIndex : null;
}

function scoreHasNote(score: Score, noteId: string): boolean {
  return score.measures.some((m) => m.events.some((n) => n.id === noteId));
}

/**
 * Selection validity is a function of the score, so undo/redo and structural
 * edits can never leave a dangling reference to a removed event or bar.
 */
export function reconcileSelection(selection: Selection, score: Score): Selection {
  if (selection.kind === 'event') {
    return scoreHasNote(score, selection.noteId) ? selection : NO_SELECTION;
  }
  if (selection.kind === 'measure') {
    return selection.measureIndex < score.measures.length ? selection : NO_SELECTION;
  }
  return selection;
}

function pushHistory(past: Score[], previous: Score): Score[] {
  const next = past.length >= HISTORY_LIMIT ? past.slice(past.length - HISTORY_LIMIT + 1) : past.slice();
  next.push(previous);
  return next;
}

export function editorReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case 'mutate': {
      const next = action.mutate(state.score);
      if (!next || next === state.score) return state;

      const nextSelection =
        action.selection === undefined
          ? state.selection
          : action.selection === 'auto'
            ? reconcileSelection(state.selection, next)
            : action.selection;

      if (action.history === false) {
        return { ...state, score: next, selection: nextSelection, past: [], future: [], revision: state.revision + 1 };
      }

      return {
        ...state,
        score: next,
        past: pushHistory(state.past, state.score),
        future: [],
        selection: nextSelection,
        revision: state.revision + 1,
      };
    }

    case 'select': {
      if (
        (state.selection.kind === 'none' && action.selection.kind === 'none') ||
        (state.selection.kind === 'event' &&
          action.selection.kind === 'event' &&
          state.selection.noteId === action.selection.noteId) ||
        (state.selection.kind === 'measure' &&
          action.selection.kind === 'measure' &&
          state.selection.measureIndex === action.selection.measureIndex)
      ) {
        return state;
      }
      return { ...state, selection: reconcileSelection(action.selection, state.score) };
    }

    case 'undo': {
      if (state.past.length === 0) return state;
      const previous = state.past[state.past.length - 1];
      return {
        ...state,
        score: previous,
        past: state.past.slice(0, -1),
        future: [...state.future, state.score],
        selection: reconcileSelection(state.selection, previous),
        revision: state.revision + 1,
      };
    }

    case 'redo': {
      if (state.future.length === 0) return state;
      const next = state.future[state.future.length - 1];
      return {
        ...state,
        score: next,
        past: pushHistory(state.past, state.score),
        future: state.future.slice(0, -1),
        selection: reconcileSelection(state.selection, next),
        revision: state.revision + 1,
      };
    }

    case 'reset': {
      return {
        score: action.score,
        past: [],
        future: [],
        selection: action.selection ?? NO_SELECTION,
        revision: state.revision + 1,
      };
    }

    default:
      return state;
  }
}

/* -------------------------------------------------------------------------- */
/* Score producers — pure helpers used by the reducer's `mutate` callbacks     */
/* -------------------------------------------------------------------------- */

export function makeEventId(): string {
  return `n-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function makeMeasureId(index: number): string {
  return `m-${Date.now()}-${index + 1}-${Math.random().toString(36).slice(2, 6)}`;
}

/**
 * Insert an event at a musical index inside one measure. An `id` may be supplied
 * so the caller can select the event it just created.
 */
export function insertEvent(
  score: Score,
  measureIndex: number,
  index: number,
  event: Omit<ScoreNote, 'id'>,
  id?: string
): Score {
  if (measureIndex < 0 || measureIndex >= score.measures.length) return score;

  const newEvent: ScoreNote = { ...event, id: id ?? makeEventId() };

  return {
    ...score,
    updatedAt: Date.now(),
    measures: score.measures.map((m, idx) => {
      if (idx !== measureIndex) return m;
      const events = m.events.slice();
      const at = Math.max(0, Math.min(index, events.length));
      events.splice(at, 0, newEvent);
      return { ...m, events };
    }),
  };
}

export function updateEvent(score: Score, noteId: string, updates: Partial<ScoreNote>): Score {
  let changed = false;

  const measures = score.measures.map((m) => {
    if (!m.events.some((n) => n.id === noteId)) return m;
    const events = m.events.map((n) => {
      if (n.id !== noteId) return n;
      const merged = { ...n, ...updates };
      if (
        merged.step === n.step &&
        merged.octave === n.octave &&
        merged.duration === n.duration &&
        merged.dotted === n.dotted &&
        merged.accidental === n.accidental &&
        merged.isRest === n.isRest &&
        merged.tied === n.tied
      ) {
        return n; // no-op update
      }
      changed = true;
      return merged;
    });
    return changed ? { ...m, events } : m;
  });

  return changed ? { ...score, measures, updatedAt: Date.now() } : score;
}

export function deleteEvent(score: Score, noteId: string): Score {
  if (!scoreHasNote(score, noteId)) return score;

  return {
    ...score,
    updatedAt: Date.now(),
    measures: score.measures.map((m) =>
      m.events.some((n) => n.id === noteId) ? { ...m, events: m.events.filter((n) => n.id !== noteId) } : m
    ),
  };
}

/** The event that should become selected after deleting `noteId`, if any. */
export function neighbourEventId(score: Score, noteId: string): string | null {
  for (const measure of score.measures) {
    const index = measure.events.findIndex((n) => n.id === noteId);
    if (index === -1) continue;
    const neighbour = measure.events[index + 1] ?? measure.events[index - 1];
    return neighbour ? neighbour.id : null;
  }
  return null;
}

export function replaceMeasureEvents(score: Score, measureIndex: number, events: ScoreNote[]): Score {
  if (measureIndex < 0 || measureIndex >= score.measures.length) return score;

  return {
    ...score,
    updatedAt: Date.now(),
    measures: score.measures.map((m, idx) => (idx === measureIndex ? { ...m, events } : m)),
  };
}

export function addMeasure(score: Score): Score {
  const measure: Measure = { id: makeMeasureId(score.measures.length), events: [] };
  return { ...score, measures: [...score.measures, measure], updatedAt: Date.now() };
}

export function removeMeasure(score: Score): Score {
  if (score.measures.length <= 1) return score;
  return { ...score, measures: score.measures.slice(0, -1), updatedAt: Date.now() };
}
