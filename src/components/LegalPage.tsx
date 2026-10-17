import React, { useEffect } from 'react';
import { ArrowLeft, Moon, Sun } from 'lucide-react';
import { BrandMark } from './BrandMark';
import { Footer } from './Footer';
import { LegalRouteName, PRODUCT_NAME, hrefFor } from '../routing/routes';

interface LegalPageProps {
  title: string;
  summary: string;
  sections: Array<{
    heading: string;
    paragraphs?: string[];
    bullets?: string[];
    callout?: string;
  }>;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onGoHome: () => void;
  route: LegalRouteName;
}

export const LegalPage: React.FC<LegalPageProps> = ({
  title,
  summary,
  sections,
  theme,
  onToggleTheme,
  onGoHome,
  route,
}) => {
  // A new route is a new document as far as the reader is concerned.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [route]);

  return (
    <div className="min-h-screen flex flex-col bg-app-bg text-text-primary">
      <header className="sticky top-0 z-30 flex items-center justify-between gap-4 px-6 md:px-12 py-4 border-b border-border bg-app-bg/90 backdrop-blur-md">
        <a
          href={hrefFor('landing')}
          onClick={(e) => {
            e.preventDefault();
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

      <main className="flex-1 px-6 md:px-12 py-12 md:py-16">
        <div className="max-w-3xl mx-auto">
          <a
            href={hrefFor('landing')}
            onClick={(e) => {
              e.preventDefault();
              onGoHome();
            }}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-text-secondary hover:text-primary transition-colors mb-6 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-app-bg"
          >
            <ArrowLeft size={14} />
            Back to {PRODUCT_NAME}
          </a>

          <h1 className="font-serif text-4xl md:text-5xl font-bold tracking-tight text-balance">{title}</h1>
          <p className="mt-4 text-sm md:text-base text-text-secondary leading-relaxed">{summary}</p>

          <div className="mt-10 flex flex-col gap-9">
            {sections.map((section) => (
              <section key={section.heading}>
                <h2 className="text-sm font-bold uppercase tracking-wider text-text-primary">{section.heading}</h2>

                {section.paragraphs?.map((paragraph) => (
                  <p key={paragraph} className="mt-3 text-sm text-text-secondary leading-relaxed">
                    {paragraph}
                  </p>
                ))}

                {section.bullets && (
                  <ul className="mt-3 flex flex-col gap-2">
                    {section.bullets.map((bullet) => (
                      <li key={bullet} className="flex gap-2.5 text-sm text-text-secondary leading-relaxed">
                        <span aria-hidden="true" className="mt-2 w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                        <span>{bullet}</span>
                      </li>
                    ))}
                  </ul>
                )}

                {section.callout && (
                  <p className="mt-4 p-4 rounded-lg bg-surface border border-border text-sm text-text-primary leading-relaxed">
                    {section.callout}
                  </p>
                )}
              </section>
            ))}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};
