import React, { useEffect } from 'react';
import { ArrowLeft, Moon, Sun } from 'lucide-react';
import { BrandMark } from './BrandMark';
import { Footer } from './Footer';
import { AudioToScoreFlow } from './AudioToScoreFlow';
import { PRODUCT_NAME, hrefFor } from '../routing/routes';
import { Score } from '../types/music';

interface TranscribePageProps {
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onGoHome: () => void;
  /** Opens the accepted transcription as a brand-new project. */
  onAccept: (score: Score) => void;
}

/**
 * Standalone "Audio to sheet music" page (the `#transcribe` route).
 *
 * Used when the feature is entered from the landing page, where no composition is
 * open. The studio entry point uses the same flow as an overlay instead, so an
 * in-progress composition is never unmounted.
 */
export const TranscribePage: React.FC<TranscribePageProps> = ({ theme, onToggleTheme, onGoHome, onAccept }) => {
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-app-bg text-text-primary">
      <header className="sticky top-0 z-30 flex items-center justify-between gap-4 px-6 md:px-12 py-4 border-b border-border bg-app-bg/90 backdrop-blur-md">
        <a
          href={hrefFor('landing')}
          onClick={(event) => {
            event.preventDefault();
            onGoHome();
          }}
          className="flex items-center gap-2.5 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-app-bg"
        >
          <span className="w-8 h-8 rounded-lg bg-primary-soft flex items-center justify-center text-primary">
            <BrandMark size={20} />
          </span>
          <span className="font-serif text-2xl font-bold tracking-tight">{PRODUCT_NAME}</span>
        </a>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onToggleTheme}
            className="p-2 rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface transition-colors"
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <a
            href={hrefFor('studio')}
            className="px-4 py-2 text-xs font-semibold rounded-lg bg-primary text-white hover:bg-primary-hover transition-colors"
          >
            Open Studio
          </a>
        </div>
      </header>

      <main className="flex-1 px-6 md:px-12 py-10">
        <div className="max-w-3xl mx-auto">
          <a
            href={hrefFor('landing')}
            onClick={(event) => {
              event.preventDefault();
              onGoHome();
            }}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-text-secondary hover:text-primary transition-colors mb-6 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-app-bg"
          >
            <ArrowLeft size={14} />
            Back to {PRODUCT_NAME}
          </a>

          <AudioToScoreFlow theme={theme} onAccept={onAccept} onExit={onGoHome} />
        </div>
      </main>

      <Footer />
    </div>
  );
};
