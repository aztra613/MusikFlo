import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HelpModal } from './HelpModal';
import { WelcomeTutorial } from './WelcomeTutorial';

describe('HelpModal and WelcomeTutorial', () => {
  it('renders HelpModal without throwing when open', async () => {
    const onClose = vi.fn();
    const onStartTutorial = vi.fn();

    render(
      <HelpModal
        isOpen={true}
        onClose={onClose}
        onStartTutorial={onStartTutorial}
      />
    );

    expect(screen.getByText(/MusikFlo notation & studio guide/i)).toBeInTheDocument();
    expect(screen.getByText(/Take Quick Studio Tour/i)).toBeInTheDocument();

    const tourBtn = screen.getByText(/Take Quick Studio Tour/i);
    await userEvent.click(tourBtn);

    expect(onClose).toHaveBeenCalled();
    expect(onStartTutorial).toHaveBeenCalled();
  });

  it('renders WelcomeTutorial without throwing and navigates steps', async () => {
    const onClose = vi.fn();

    render(
      <WelcomeTutorial
        isOpen={true}
        onClose={onClose}
      />
    );

    expect(screen.getByText(/Welcome to MusikFlo Studio!/i)).toBeInTheDocument();
    const nextBtn = screen.getByRole('button', { name: /Next/i });
    await userEvent.click(nextBtn);

    expect(screen.getByText(/Pick a Tool/i)).toBeInTheDocument();
  });
});
