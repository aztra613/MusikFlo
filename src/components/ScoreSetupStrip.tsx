import React from 'react';
import { Score, Clef, InstrumentId, validateMeasure, MeasureValidation } from '../types/music';
import { INSTRUMENT_IDS, VOICES } from '../audio/instruments';
import { MEASURES_PER_ROW } from '../score/geometry';
import { Plus, Minus, CheckCircle2, AlertCircle, AlertTriangle, Copy } from 'lucide-react';

interface ScoreSetupStripProps {
  score: Score;
  onUpdateScore: (updates: Partial<Score>) => void;
  onAddMeasure: () => void;
  onRemoveMeasure: () => void;
  onDuplicateMeasure: (measureIndex: number) => void;
  onDuplicateLine: (lineIndex: number) => void;
  selectedMeasureIndex: number | null;
  onSelectMeasure: (idx: number | null) => void;
  hasCopiedMeasure: boolean;
  onPasteMeasure: (targetIndex: number) => void;
}

export const ScoreSetupStrip: React.FC<ScoreSetupStripProps> = ({
  score,
  onUpdateScore,
  onAddMeasure,
  onRemoveMeasure,
  onDuplicateMeasure,
  onDuplicateLine,
  selectedMeasureIndex,
  onSelectMeasure,
  hasCopiedMeasure,
  onPasteMeasure,
}) => {
  // Compute validations for all measures
  const validations: MeasureValidation[] = score.measures.map((m, idx) =>
    validateMeasure(m, idx, score.timeSignature)
  );

  return (
    <div className="flex flex-col border-b border-border bg-surface text-xs select-none">
      {/* Primary Setup Controls */}
      <div className="flex items-center justify-between flex-wrap gap-3 px-4 py-2.5">
        <div className="flex items-center flex-wrap gap-4">
          {/* Instrument Selector */}
          <div className="flex items-center gap-1.5">
            <label htmlFor="instrument-select" className="font-semibold text-text-muted">
              Sound:
            </label>
            <select
              id="instrument-select"
              value={score.instrument}
              onChange={(e) => onUpdateScore({ instrument: e.target.value as InstrumentId })}
              className="py-1 px-2 rounded-md bg-app-bg border border-border text-text-primary font-medium focus:outline-none focus:border-primary"
            >
              {INSTRUMENT_IDS.map((id) => (
                <option key={id} value={id}>
                  {VOICES[id].label}
                </option>
              ))}
            </select>
          </div>

          {/* Clef Selector */}
          <div className="flex items-center gap-1.5">
            <label htmlFor="clef-select" className="font-semibold text-text-muted">
              Clef:
            </label>
            <select
              id="clef-select"
              value={score.clef}
              onChange={(e) => onUpdateScore({ clef: e.target.value as Clef })}
              className="py-1 px-2 rounded-md bg-app-bg border border-border text-text-primary font-medium focus:outline-none focus:border-primary"
            >
              <option value="treble">Treble (G Clef)</option>
              <option value="bass">Bass (F Clef)</option>
            </select>
          </div>

          {/* Time Signature */}
          <div className="flex items-center gap-1.5">
            <label htmlFor="meter-select" className="font-semibold text-text-muted">
              Meter:
            </label>
            <select
              id="meter-select"
              value={`${score.timeSignature.numerator}/${score.timeSignature.denominator}`}
              onChange={(e) => {
                const [num, den] = e.target.value.split('/').map(Number);
                onUpdateScore({ timeSignature: { numerator: num, denominator: den } });
              }}
              className="py-1 px-2 rounded-md bg-app-bg border border-border text-text-primary font-medium focus:outline-none focus:border-primary"
            >
              <option value="4/4">4/4 Common Time</option>
              <option value="3/4">3/4 Waltz Time</option>
              <option value="2/4">2/4 March</option>
              <option value="2/2">2/2 Cut Time</option>
              <option value="6/8">6/8 Compound</option>
              <option value="3/8">3/8 Simple</option>
              <option value="5/4">5/4 Asymmetric</option>
            </select>
          </div>

          {/* Key Signature */}
          <div className="flex items-center gap-1.5">
            <label htmlFor="key-select" className="font-semibold text-text-muted">
              Key:
            </label>
            <select
              id="key-select"
              value={score.keySignature || 'C'}
              onChange={(e) => onUpdateScore({ keySignature: e.target.value })}
              className="py-1 px-2 rounded-md bg-app-bg border border-border text-text-primary font-medium focus:outline-none focus:border-primary"
            >
              <option value="C">C Major / A Minor (natural)</option>
              <option value="G">G Major (1 ♯)</option>
              <option value="D">D Major (2 ♯)</option>
              <option value="A">A Major (3 ♯)</option>
              <option value="F">F Major (1 ♭)</option>
              <option value="Bb">B♭ Major (2 ♭)</option>
              <option value="Eb">E♭ Major (3 ♭)</option>
            </select>
          </div>

          {/* Time Signature on every bar toggle */}
          <label className="flex items-center gap-1.5 cursor-pointer text-text-secondary hover:text-text-primary font-medium py-1 px-1.5 rounded hover:bg-app-bg transition-colors" title="Engrave time signature on every measure in sheet music">
            <input
              type="checkbox"
              checked={!!score.showTimeSigOnEveryBar}
              onChange={(e) => onUpdateScore({ showTimeSigOnEveryBar: e.target.checked })}
              className="accent-primary rounded cursor-pointer"
            />
            <span>
              Show meter ({score.timeSignature.numerator}/{score.timeSignature.denominator}) in all bars
            </span>
          </label>
        </div>

        {/* Measure management buttons */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={onRemoveMeasure}
            disabled={score.measures.length <= 1}
            className="flex items-center gap-1 py-1 px-2 rounded border border-border bg-app-bg text-text-secondary hover:text-text-primary disabled:opacity-40 transition-colors"
            title="Remove last measure"
          >
            <Minus size={13} />
            <span>Remove Bar</span>
          </button>
          <button
            type="button"
            onClick={onAddMeasure}
            className="flex items-center gap-1 py-1 px-2 rounded border border-border bg-app-bg text-primary font-medium hover:bg-primary-soft transition-colors"
            title="Add empty measure at end"
          >
            <Plus size={13} />
            <span>Add Bar</span>
          </button>
          <button
            type="button"
            onClick={() => {
              const targetIdx = selectedMeasureIndex !== null ? selectedMeasureIndex : score.measures.length - 1;
              onDuplicateMeasure(targetIdx);
            }}
            className="flex items-center gap-1 py-1 px-2.5 rounded border border-border bg-app-bg text-text-primary font-semibold hover:bg-primary-soft hover:text-primary transition-all shadow-2xs cursor-pointer active:scale-95"
            title="Duplicate active or last measure to the next bar (Ctrl+D)"
          >
            <Copy size={13} />
            <span>Duplicate Bar → Next</span>
          </button>
          <button
            type="button"
            onClick={() => {
              const targetLine =
                selectedMeasureIndex !== null
                  ? Math.floor(selectedMeasureIndex / MEASURES_PER_ROW)
                  : Math.floor((score.measures.length - 1) / MEASURES_PER_ROW);
              onDuplicateLine(targetLine);
            }}
            className="flex items-center gap-1 py-1 px-2.5 rounded border border-border bg-app-bg text-text-primary font-medium hover:bg-primary-soft hover:text-primary transition-all shadow-2xs cursor-pointer active:scale-95"
            title="Duplicate entire current line of bars to the next line"
          >
            <Copy size={13} />
            <span>Duplicate Line</span>
          </button>

          {hasCopiedMeasure && (
            <button
              type="button"
              onClick={() => {
                const targetIdx = selectedMeasureIndex !== null ? selectedMeasureIndex : score.measures.length - 1;
                onPasteMeasure(targetIdx);
              }}
              className="flex items-center gap-1 py-1 px-2.5 rounded bg-primary text-white hover:bg-primary-hover border border-primary transition-all font-semibold shadow-2xs cursor-pointer active:scale-95"
              title={`Paste copied measure notes into Measure ${(selectedMeasureIndex !== null ? selectedMeasureIndex : score.measures.length - 1) + 1}`}
            >
              <Copy size={13} />
              <span>Paste into Bar {(selectedMeasureIndex !== null ? selectedMeasureIndex : score.measures.length - 1) + 1}</span>
            </button>
          )}
        </div>
      </div>

      {/* Rhythmic Validation Rail */}
      <div className="flex items-center gap-2 px-4 py-1.5 bg-app-bg/50 border-t border-border overflow-x-auto text-[11px]">
        <span className="font-semibold text-text-muted uppercase tracking-wider shrink-0">
          Meter Check:
        </span>
        <div className="flex items-center gap-2 shrink-0">
          {validations.map((val) => {
            const isSelected = selectedMeasureIndex === val.measureIndex;

            let badgeStyle = 'text-success bg-surface border-border';
            let Icon = CheckCircle2;

            if (val.status === 'incomplete') {
              badgeStyle = 'text-warning bg-warning-bg/60 border-warning/30';
              Icon = AlertTriangle;
            } else if (val.status === 'overfull') {
              badgeStyle = 'text-danger bg-danger-bg/80 border-danger/30';
              Icon = AlertCircle;
            }

            return (
              <button
                key={val.measureIndex}
                type="button"
                onClick={() => onSelectMeasure(isSelected ? null : val.measureIndex)}
                className={`flex items-center gap-1.5 px-2 py-0.5 rounded border transition-all ${badgeStyle} ${
                  isSelected ? 'ring-2 ring-primary ring-offset-1' : ''
                }`}
                title={val.message}
              >
                <Icon size={12} className="shrink-0" />
                <span className="font-mono font-medium">M{val.measureIndex + 1}</span>
                <span className="hidden sm:inline text-text-muted">·</span>
                <span className="hidden sm:inline">
                  {val.status === 'complete' && 'complete'}
                  {val.status === 'incomplete' && 'needs notes'}
                  {val.status === 'overfull' && 'overfilled'}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
