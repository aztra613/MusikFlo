import { describe, expect, it } from 'vitest';
import {
  HISTORY_LIMIT,
  addMeasure,
  createEditorState,
  deleteEvent,
  deleteEvent as removeEvent,
  editorReducer,
  insertEvent,
  neighbourEventId,
  reconcileSelection,
  removeMeasure,
  replaceMeasureEvents,
  selectionMeasureIndex,
  selectionNoteId,
  updateEvent,
} from './editorReducer';
import { Score } from '../types/music';

function makeScore(): Score {
  return {
    id: 's1',
    title: 'Test',
    composer: 'Tester',
    clef: 'treble',
    timeSignature: { numerator: 4, denominator: 4 },
    keySignature: 'C',
    tempo: 100,
    instrument: 'piano',
    createdAt: 0,
    updatedAt: 0,
    measures: [
      {
        id: 'm1',
        events: [
          { id: 'n1', step: 'e', octave: 4, duration: '4' },
          { id: 'n2', step: 'f', octave: 4, duration: '4' },
        ],
      },
      { id: 'm2', events: [{ id: 'n3', step: 'g', octave: 4, duration: '4' }] },
    ],
  };
}

describe('editorReducer history', () => {
  it('records a mutation and supports undo/redo', () => {
    const start = createEditorState(makeScore());
    const added = editorReducer(start, { type: 'mutate', mutate: (s) => addMeasure(s) });

    expect(added.score.measures).toHaveLength(3);
    expect(added.past).toHaveLength(1);
    expect(added.revision).toBe(1);

    const undone = editorReducer(added, { type: 'undo' });
    expect(undone.score.measures).toHaveLength(2);
    expect(undone.future).toHaveLength(1);

    const redone = editorReducer(undone, { type: 'redo' });
    expect(redone.score.measures).toHaveLength(3);
  });

  it('rejects no-op mutations so stray clicks do not pollute history', () => {
    const start = createEditorState(makeScore());
    const same = editorReducer(start, { type: 'mutate', mutate: (s) => s });
    const nulled = editorReducer(start, { type: 'mutate', mutate: () => null });

    expect(same).toBe(start);
    expect(nulled).toBe(start);
    expect(start.past).toHaveLength(0);
  });

  it('rejects an update that changes nothing', () => {
    const start = createEditorState(makeScore());
    const next = editorReducer(start, {
      type: 'mutate',
      mutate: (s) => updateEvent(s, 'n1', { duration: '4', step: 'e', octave: 4 }),
    });
    expect(next).toBe(start);
  });

  it('rejects deleting an unknown event', () => {
    const start = createEditorState(makeScore());
    const next = editorReducer(start, { type: 'mutate', mutate: (s) => deleteEvent(s, 'missing') });
    expect(next).toBe(start);
  });

  it('bounds the undo stack without dropping the most recent states', () => {
    let state = createEditorState(makeScore());
    for (let i = 0; i < HISTORY_LIMIT + 10; i++) {
      state = editorReducer(state, {
        type: 'mutate',
        mutate: (s) => ({ ...s, title: `T${i}`, updatedAt: Date.now() }),
      });
    }
    expect(state.past).toHaveLength(HISTORY_LIMIT);
    expect(state.score.title).toBe(`T${HISTORY_LIMIT + 9}`);
  });

  it('clears redo history on a new edit', () => {
    let state = createEditorState(makeScore());
    state = editorReducer(state, { type: 'mutate', mutate: (s) => addMeasure(s) });
    state = editorReducer(state, { type: 'undo' });
    expect(state.future).toHaveLength(1);

    state = editorReducer(state, { type: 'mutate', mutate: (s) => addMeasure(s) });
    expect(state.future).toHaveLength(0);
  });

  it('can reset without contributing history', () => {
    const state = editorReducer(createEditorState(makeScore()), {
      type: 'mutate',
      mutate: () => makeScore(),
      history: false,
    });
    expect(state.past).toHaveLength(0);
  });
});

describe('selection', () => {
  it('holds only one kind of selection at a time', () => {
    let state = createEditorState(makeScore());
    state = editorReducer(state, { type: 'select', selection: { kind: 'event', noteId: 'n1' } });
    expect(selectionNoteId(state.selection)).toBe('n1');
    expect(selectionMeasureIndex(state.selection)).toBeNull();

    state = editorReducer(state, { type: 'select', selection: { kind: 'measure', measureIndex: 1 } });
    expect(selectionNoteId(state.selection)).toBeNull();
    expect(selectionMeasureIndex(state.selection)).toBe(1);
  });

  it('clears a note selection when that note is deleted, and undo restores it safely', () => {
    let state = createEditorState(makeScore());
    state = editorReducer(state, { type: 'select', selection: { kind: 'event', noteId: 'n1' } });
    state = editorReducer(state, { type: 'mutate', mutate: (s) => removeEvent(s, 'n1'), selection: 'auto' });

    expect(state.selection).toEqual({ kind: 'none' });

    state = editorReducer(state, { type: 'undo' });
    expect(state.score.measures[0].events.map((e) => e.id)).toContain('n1');
    expect(state.selection).toEqual({ kind: 'none' });
  });

  it('drops a measure selection that points past the end after removing a bar', () => {
    let state = createEditorState(makeScore());
    state = editorReducer(state, { type: 'select', selection: { kind: 'measure', measureIndex: 1 } });
    state = editorReducer(state, { type: 'mutate', mutate: (s) => removeMeasure(s), selection: 'auto' });
    expect(state.selection).toEqual({ kind: 'none' });
  });

  it('ignores a selection of an event that does not exist', () => {
    const score = makeScore();
    expect(reconcileSelection({ kind: 'event', noteId: 'ghost' }, score)).toEqual({ kind: 'none' });
  });
});

describe('score producers', () => {
  it('inserts an event at a musical index rather than always appending', () => {
    const score = insertEvent(makeScore(), 0, 1, { step: 'a', octave: 4, duration: '8' });
    expect(score.measures[0].events.map((e) => e.step)).toEqual(['e', 'a', 'f']);
  });

  it('clamps an out-of-range insertion index', () => {
    const score = insertEvent(makeScore(), 0, 99, { step: 'a', octave: 4, duration: '8' });
    expect(score.measures[0].events[score.measures[0].events.length - 1].step).toBe('a');
  });

  it('leaves the score untouched for an invalid measure index', () => {
    const original = makeScore();
    expect(insertEvent(original, 9, 0, { step: 'a', octave: 4, duration: '8' })).toBe(original);
  });

  it('replaces measure contents and cannot remove the final bar', () => {
    const replaced = replaceMeasureEvents(makeScore(), 1, []);
    expect(replaced.measures[1].events).toHaveLength(0);

    let single = makeScore();
    single = { ...single, measures: [single.measures[0]] };
    expect(removeMeasure(single)).toBe(single);
  });

  it('finds a neighbour to keep selection useful after a delete', () => {
    expect(neighbourEventId(makeScore(), 'n1')).toBe('n2');
    expect(neighbourEventId(makeScore(), 'n3')).toBeNull();
    expect(neighbourEventId(makeScore(), 'ghost')).toBeNull();
  });

  it('gives every inserted event a unique id', () => {
    const once = insertEvent(makeScore(), 0, 0, { step: 'a', octave: 4, duration: '8' });
    const twice = insertEvent(once, 0, 0, { step: 'b', octave: 4, duration: '8' });
    const ids = twice.measures[0].events.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('supports Grand Staff dual staves with bassEvents insertion, update, and deletion', () => {
    let score = makeScore();
    score = { ...score, staffMode: 'grand' };

    // Insert into bass staff
    score = insertEvent(score, 0, 0, { step: 'c', octave: 3, duration: '4' }, 'bass-1', 'bass');
    expect(score.measures[0].bassEvents).toBeDefined();
    expect(score.measures[0].bassEvents?.[0]).toMatchObject({ id: 'bass-1', step: 'c', octave: 3 });

    // Update bass event
    score = updateEvent(score, 'bass-1', { step: 'g', octave: 2 });
    expect(score.measures[0].bassEvents?.[0]).toMatchObject({ step: 'g', octave: 2 });

    // Delete bass event
    score = deleteEvent(score, 'bass-1');
    expect(score.measures[0].bassEvents).toHaveLength(0);
  });
});
