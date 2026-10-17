import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NotationPalette } from './NotationPalette';

function renderPalette(overrides: Partial<React.ComponentProps<typeof NotationPalette>> = {}) {
  const props = {
    activeDuration: '4' as const,
    onSelectDuration: vi.fn(),
    activeAccidental: '' as const,
    onSelectAccidental: vi.fn(),
    activeDotted: false,
    onToggleDotted: vi.fn(),
    activeTool: 'note' as const,
    onSelectTool: vi.fn(),
    learningMode: false,
    onToggleLearningMode: vi.fn(),
    ...overrides,
  };
  render(<NotationPalette {...props} />);
  return props;
}

describe('NotationPalette tools', () => {
  it('offers an explicit Select tool alongside note, rest and eraser', () => {
    renderPalette();
    for (const name of ['Select', 'Note', 'Rest', 'Erase']) {
      expect(screen.getByRole('button', { name })).toBeInTheDocument();
    }
  });

  it('reports the active tool with aria-pressed', () => {
    renderPalette({ activeTool: 'select' });
    expect(screen.getByRole('button', { name: 'Select' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Note' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('explains the current tool so its click behaviour is not ambiguous', () => {
    renderPalette({ activeTool: 'select' });
    expect(screen.getByText(/click a note or rest to edit it/i)).toBeInTheDocument();
  });

  it('switches to the note tool when a value is chosen while the eraser is active', async () => {
    const props = renderPalette({ activeTool: 'eraser' });
    await userEvent.click(screen.getByRole('button', { name: /Half note/ }));
    expect(props.onSelectTool).toHaveBeenCalledWith('note');
    expect(props.onSelectDuration).toHaveBeenCalledWith('2');
  });

  it('marks the chosen rhythmic value as pressed', () => {
    renderPalette({ activeDuration: '8' });
    expect(screen.getByRole('button', { name: /Eighth note/ })).toHaveAttribute('aria-pressed', 'true');
  });
});
