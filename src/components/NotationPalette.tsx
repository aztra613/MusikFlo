import React from 'react';
import { NoteDuration, Accidental } from '../types/music';
import { Eraser, GraduationCap, MousePointer2, Music } from 'lucide-react';
import { EditorTool } from './ScoreCanvas';

interface NotationPaletteProps {
  activeDuration: NoteDuration;
  onSelectDuration: (dur: NoteDuration) => void;
  activeAccidental: Accidental | '';
  onSelectAccidental: (acc: Accidental | '') => void;
  activeDotted: boolean;
  onToggleDotted: () => void;
  activeTool: EditorTool;
  onSelectTool: (tool: EditorTool) => void;
  learningMode: boolean;
  onToggleLearningMode: () => void;
}

const TOOL_HINTS: Record<EditorTool, string> = {
  select: 'Select tool: click a note or rest to edit it. Clicking empty staff does nothing.',
  note: 'Note tool: click empty staff to place a note. Clicking an existing note selects it.',
  rest: 'Rest tool: click empty staff to place a rest. Clicking an existing event selects it.',
  eraser: 'Eraser tool: click a note or rest to delete it. Clicking empty staff does nothing.',
};

export const NotationPalette: React.FC<NotationPaletteProps> = ({
  activeDuration,
  onSelectDuration,
  activeAccidental,
  onSelectAccidental,
  activeDotted,
  onToggleDotted,
  activeTool,
  onSelectTool,
  learningMode,
  onToggleLearningMode,
}) => {
  const durations: Array<{ id: NoteDuration; name: string; noteGlyph: string; restGlyph: string; beats: string }> = [
    { id: '1', name: 'Whole note', noteGlyph: '𝅝', restGlyph: '𝄻', beats: '4 beats' },
    { id: '2', name: 'Half note', noteGlyph: '𝅗𝅥', restGlyph: '𝄼', beats: '2 beats' },
    { id: '4', name: 'Quarter note', noteGlyph: '𝅘𝅥', restGlyph: '𝄽', beats: '1 beat' },
    { id: '8', name: 'Eighth note', noteGlyph: '𝅘𝅥𝅯', restGlyph: '𝄾', beats: '½ beat' },
    { id: '16', name: '16th note', noteGlyph: '𝅘𝅥𝅰', restGlyph: '𝄿', beats: '¼ beat' },
  ];

  const toolButtonClass = (tool: EditorTool) => {
    const base = 'py-1.5 px-2 text-xs font-medium rounded-md transition-all flex items-center justify-center gap-1.5';
    if (activeTool !== tool) return `${base} text-text-secondary hover:text-text-primary hover:bg-surface`;
    if (tool === 'eraser') return `${base} bg-danger-bg text-danger shadow-xs font-semibold`;
    return `${base} bg-surface text-primary shadow-xs font-semibold`;
  };

  const durationsActive = activeTool === 'note' || activeTool === 'rest';

  return (
    <aside
      className="flex flex-col gap-5 p-4 border-r border-border bg-surface w-full md:w-56 shrink-0 select-none overflow-y-auto"
      aria-label="Notation palette"
    >
      {/* Tool mode */}
      <div>
        <div className="text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-2">Tool</div>
        <div className="grid grid-cols-2 gap-1 p-1 bg-app-bg border border-border rounded-lg" role="group" aria-label="Entry tool">
          <button
            type="button"
            onClick={() => onSelectTool('select')}
            className={toolButtonClass('select')}
            title={TOOL_HINTS.select}
            aria-pressed={activeTool === 'select'}
          >
            <MousePointer2 size={13} />
            <span>Select</span>
          </button>

          <button
            type="button"
            onClick={() => onSelectTool('note')}
            className={toolButtonClass('note')}
            title={TOOL_HINTS.note}
            aria-pressed={activeTool === 'note'}
          >
            <Music size={13} />
            <span>Note</span>
          </button>

          <button
            type="button"
            onClick={() => onSelectTool('rest')}
            className={toolButtonClass('rest')}
            title={TOOL_HINTS.rest}
            aria-pressed={activeTool === 'rest'}
          >
            <span className="text-sm leading-none font-serif" aria-hidden="true">
              𝄽
            </span>
            <span>Rest</span>
          </button>

          <button
            type="button"
            onClick={() => onSelectTool('eraser')}
            className={toolButtonClass('eraser')}
            title={TOOL_HINTS.eraser}
            aria-pressed={activeTool === 'eraser'}
          >
            <Eraser size={13} />
            <span>Erase</span>
          </button>
        </div>
        <p className="mt-2 text-[11px] leading-snug text-text-muted">{TOOL_HINTS[activeTool]}</p>
      </div>

      {/* Note values */}
      <div>
        <div className="text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-2">Rhythmic values</div>
        <div className="flex flex-col gap-1">
          {durations.map((duration) => {
            const isSelected = activeDuration === duration.id && durationsActive;
            const glyph = activeTool === 'rest' ? duration.restGlyph : duration.noteGlyph;

            return (
              <button
                key={duration.id}
                type="button"
                onClick={() => {
                  // Selecting a value while erasing/selecting means "I want to
                  // write" — switching is visible in the tool group above.
                  if (activeTool === 'eraser' || activeTool === 'select') onSelectTool('note');
                  onSelectDuration(duration.id);
                }}
                className={`flex items-center justify-between px-3 py-2 rounded-lg text-left text-sm transition-all border ${
                  isSelected
                    ? 'border-primary bg-primary-soft text-primary font-medium shadow-xs'
                    : 'border-transparent hover:bg-app-bg text-text-primary'
                }`}
                aria-pressed={isSelected}
              >
                <span className="flex items-center gap-2.5">
                  <span className="text-xl w-6 text-center leading-none" aria-hidden="true">
                    {glyph}
                  </span>
                  <span className="text-xs font-medium">{duration.name}</span>
                </span>
                <span className="text-[11px] text-text-muted font-mono">{duration.beats}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Modifiers */}
      <div>
        <div className="text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-2">Modifiers</div>
        <button
          type="button"
          onClick={onToggleDotted}
          className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs transition-all border ${
            activeDotted
              ? 'border-primary bg-primary-soft text-primary font-medium'
              : 'border-border bg-surface text-text-secondary hover:text-text-primary'
          }`}
          aria-pressed={activeDotted}
        >
          <span className="flex items-center gap-2">
            <span className="font-bold text-base leading-none" aria-hidden="true">
              ·
            </span>
            <span>Dotted value</span>
          </span>
          <span className="text-[11px] font-mono text-text-muted">+50% duration</span>
        </button>
      </div>

      {/* Accidentals */}
      <div>
        <div className="text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-2">Accidentals</div>
        <div className="grid grid-cols-4 gap-1 p-1 bg-app-bg border border-border rounded-lg" role="group" aria-label="Accidental">
          <button
            type="button"
            onClick={() => onSelectAccidental('')}
            className={`py-1.5 text-xs font-mono font-medium rounded transition-all ${
              activeAccidental === '' ? 'bg-surface text-primary shadow-xs font-bold' : 'text-text-secondary hover:text-text-primary'
            }`}
            title="No accidental"
            aria-pressed={activeAccidental === ''}
          >
            None
          </button>
          <button
            type="button"
            onClick={() => onSelectAccidental('#')}
            className={`py-1.5 text-xs font-medium rounded transition-all ${
              activeAccidental === '#' ? 'bg-surface text-primary shadow-xs font-bold' : 'text-text-secondary hover:text-text-primary'
            }`}
            title="Sharp — raise a half step"
            aria-pressed={activeAccidental === '#'}
          >
            ♯
          </button>
          <button
            type="button"
            onClick={() => onSelectAccidental('b')}
            className={`py-1.5 text-xs font-medium rounded transition-all ${
              activeAccidental === 'b' ? 'bg-surface text-primary shadow-xs font-bold' : 'text-text-secondary hover:text-text-primary'
            }`}
            title="Flat — lower a half step"
            aria-pressed={activeAccidental === 'b'}
          >
            ♭
          </button>
          <button
            type="button"
            onClick={() => onSelectAccidental('n')}
            className={`py-1.5 text-xs font-medium rounded transition-all ${
              activeAccidental === 'n' ? 'bg-surface text-primary shadow-xs font-bold' : 'text-text-secondary hover:text-text-primary'
            }`}
            title="Explicit natural"
            aria-pressed={activeAccidental === 'n'}
          >
            ♮
          </button>
        </div>
      </div>

      {/* Note-name helper */}
      <div className="mt-auto pt-3 border-t border-border">
        <button
          type="button"
          onClick={onToggleLearningMode}
          className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs transition-all border ${
            learningMode
              ? 'border-brass bg-brass/10 text-brass font-medium'
              : 'border-border bg-surface text-text-secondary hover:text-text-primary'
          }`}
          aria-pressed={learningMode}
        >
          <span className="flex items-center gap-2">
            <GraduationCap size={15} />
            <span>Note names</span>
          </span>
          <span className="font-mono text-[10px]">{learningMode ? 'ON' : 'OFF'}</span>
        </button>
      </div>
    </aside>
  );
};
