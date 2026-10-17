import { describe, expect, it } from 'vitest';
import { IMPORT_LIMITS, validateImportedScore } from './importValidation';
import { SAMPLE_ODE_TO_JOY } from '../data/samples';

const validProject = () => JSON.parse(JSON.stringify(SAMPLE_ODE_TO_JOY));

describe('validateImportedScore', () => {
  it('accepts a real project', () => {
    const result = validateImportedScore(validProject());
    expect(result.ok).toBe(true);
    expect(result.score?.measures).toHaveLength(4);
    expect(result.score?.title).toBe('Ode to Joy');
  });

  it('rejects anything that is not an object', () => {
    expect(validateImportedScore(null).ok).toBe(false);
    expect(validateImportedScore('nope').ok).toBe(false);
    expect(validateImportedScore([]).ok).toBe(false);
  });

  it('rejects a project with no measures', () => {
    const project = validProject();
    project.measures = [];
    expect(validateImportedScore(project).ok).toBe(false);
  });

  it('rejects a missing or non-array measures field', () => {
    const project = validProject();
    project.measures = {};
    expect(validateImportedScore(project).ok).toBe(false);
  });

  it('rejects invalid note durations and steps', () => {
    const project = validProject();
    project.measures[0].events[0].duration = '64';
    expect(validateImportedScore(project).ok).toBe(false);

    const second = validProject();
    second.measures[0].events[0].step = 'h';
    expect(validateImportedScore(second).ok).toBe(false);
  });

  it('rejects out-of-range octaves and tempos', () => {
    const octave = validProject();
    octave.measures[0].events[0].octave = 42;
    expect(validateImportedScore(octave).ok).toBe(false);

    const tempo = validProject();
    tempo.tempo = 10_000;
    expect(validateImportedScore(tempo).ok).toBe(false);
  });

  it('rejects an unknown instrument or clef', () => {
    const instrument = validProject();
    instrument.instrument = 'theremin';
    expect(validateImportedScore(instrument).ok).toBe(false);

    const clef = validProject();
    clef.clef = 'alto';
    expect(validateImportedScore(clef).ok).toBe(false);
  });

  it('rejects an invalid time signature', () => {
    const project = validProject();
    project.timeSignature = { numerator: 4, denominator: 5 };
    expect(validateImportedScore(project).ok).toBe(false);
  });

  it('rejects an oversized project rather than trying to render it', () => {
    const project = validProject();
    project.measures = Array.from({ length: IMPORT_LIMITS.maxMeasures + 1 }, (_, i) => ({
      id: `m${i}`,
      events: [],
    }));
    expect(validateImportedScore(project).ok).toBe(false);
  });

  it('rejects duplicate measure ids', () => {
    const project = validProject();
    project.measures[1].id = project.measures[0].id;
    expect(validateImportedScore(project).ok).toBe(false);
  });

  it('reports actionable errors instead of throwing', () => {
    const project = validProject();
    project.tempo = 'fast';
    const result = validateImportedScore(project);
    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toMatch(/tempo/);
  });

  it('does not mutate the input', () => {
    const project = validProject();
    const snapshot = JSON.stringify(project);
    validateImportedScore(project);
    expect(JSON.stringify(project)).toBe(snapshot);
  });
});
