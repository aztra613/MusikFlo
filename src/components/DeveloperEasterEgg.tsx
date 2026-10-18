import React, { useEffect } from 'react';
import { ArrowLeft, Moon, Sun, Terminal, Cpu, Sparkles, Mail, MapPin, Building, ShieldCheck } from 'lucide-react';
import { BrandMark } from './BrandMark';
import { Footer } from './Footer';
import { PRODUCT_NAME, hrefFor } from '../routing/routes';

interface DeveloperEasterEggProps {
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onGoHome: () => void;
  onOpenStudio: () => void;
}

export const DeveloperEasterEgg: React.FC<DeveloperEasterEggProps> = ({
  theme,
  onToggleTheme,
  onGoHome,
  onOpenStudio,
}) => {
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-app-bg text-text-primary selection:bg-brass/20 selection:text-brass">
      {/* Top Header */}
      <header className="sticky top-0 z-30 flex items-center justify-between gap-4 px-6 md:px-12 py-4 border-b border-border bg-app-bg/90 backdrop-blur-md">
        <a
          href="/#home"
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
          <button
            type="button"
            onClick={onOpenStudio}
            className="px-4 py-2 text-xs font-semibold rounded-lg bg-primary text-white hover:bg-primary-hover transition-colors shadow-sm cursor-pointer"
          >
            Open Studio
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 px-6 md:px-12 py-12 md:py-16">
        <div className="max-w-3xl mx-auto">
          {/* Back link */}
          <a
            href={hrefFor('landing')}
            onClick={(e) => {
              e.preventDefault();
              onGoHome();
            }}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-text-secondary hover:text-primary transition-colors mb-8 rounded focus-visible:outline-none"
          >
            <ArrowLeft size={14} />
            Back to {PRODUCT_NAME}
          </a>

          {/* Easter egg tag */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brass/10 border border-brass/30 text-brass text-[11px] font-mono uppercase tracking-wider mb-4">
            <Terminal size={13} />
            <span>Developer Provenance &bull; Easter Egg</span>
          </div>

          <h1 className="font-serif text-4xl md:text-5xl font-bold tracking-tight text-balance">
            BUILDER &amp; PROVENANCE
          </h1>
          <p className="mt-3 text-base text-text-secondary leading-relaxed">
            Architectural origin, creator provenance, and engineering records for MusikFlo.
          </p>

          {/* Builder Highlight Card */}
          <div className="mt-10 p-6 md:p-8 rounded-2xl bg-surface-raised border border-border shadow-lg relative overflow-hidden">
            <div className="absolute top-0 right-0 w-48 h-48 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-border">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-widest text-primary font-mono block mb-1">
                  Architect &amp; Lead Builder
                </span>
                <h2 className="text-2xl md:text-3xl font-serif font-bold text-text-primary">
                  Pravin A. Mathew
                </h2>
                <p className="mt-1 text-sm text-text-secondary font-medium">
                  Architect and builder of <span className="text-text-primary font-semibold">RASHINOS</span>.
                </p>
              </div>

              <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-app-bg border border-border text-xs text-text-secondary self-start md:self-auto font-mono">
                <Cpu size={15} className="text-brass" />
                <span>RASHINOS CORE ARCHITECTURE</span>
              </div>
            </div>

            <div className="mt-6 space-y-6 text-sm text-text-secondary leading-relaxed">
              {/* Product Origin */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-text-primary font-mono mb-2 flex items-center gap-1.5">
                  <Building size={14} className="text-primary" />
                  Product Origin
                </h3>
                <p>
                  <strong className="text-text-primary">MUSIKFLO</strong> is a product of{' '}
                  <strong className="text-text-primary">Aztras AI Tech Solutions</strong>, located in Chennai, India.
                  Built and architected by <strong className="text-text-primary">Pravin A. Mathew</strong>.
                </p>
              </div>

              {/* Engineering Conception */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-text-primary font-mono mb-2 flex items-center gap-1.5">
                  <Sparkles size={14} className="text-brass" />
                  Conception &amp; Architectural Engineering
                </h3>
                <p>
                  The project was conceived and engineered as a proprietary browser-native music studio,
                  marrying client-side digital signal processing (Web Audio API) with real-time vector notation
                  rendering and on-device neural audio transcription.
                </p>
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="p-3 rounded-xl bg-app-bg border border-border">
                    <span className="font-semibold text-text-primary block mb-0.5">Zero-Server Sovereignty</span>
                    <span>100% client-side operation with no cloud roundtrips for composition, synthesis, or drafts.</span>
                  </div>
                  <div className="p-3 rounded-xl bg-app-bg border border-border">
                    <span className="font-semibold text-text-primary block mb-0.5">Procedural Synthesis</span>
                    <span>Custom harmonic voice pipelines replacing sample-libraries with pure parametric math.</span>
                  </div>
                </div>
              </div>

              {/* Location & Contact */}
              <div className="pt-4 border-t border-border flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs">
                <div className="flex items-center gap-2 text-text-muted">
                  <MapPin size={14} className="text-primary shrink-0" />
                  <span>Aztras AI Tech Solutions &bull; Chennai, India</span>
                </div>
                <div className="flex items-center gap-2 text-text-primary">
                  <Mail size={14} className="text-brass shrink-0" />
                  <a
                    href="mailto:zetaaztratech@gmail.com"
                    className="font-mono hover:text-primary transition-colors underline underline-offset-2"
                  >
                    zetaaztratech@gmail.com
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* Footer Navigation Buttons */}
          <div className="mt-10 flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={onGoHome}
              className="px-5 py-2.5 rounded-xl border border-border bg-surface text-text-primary text-xs font-semibold hover:bg-app-bg transition-colors cursor-pointer"
            >
              Return to MusikFlo Home
            </button>
            <button
              type="button"
              onClick={onOpenStudio}
              className="px-5 py-2.5 rounded-xl bg-primary text-white text-xs font-semibold hover:bg-primary-hover transition-colors shadow-sm cursor-pointer"
            >
              Open Studio Workspace
            </button>
          </div>
        </div>
      </main>

      <Footer
        onNavigate={(name) => {
          if (name === 'landing') {
            onGoHome();
          } else {
            window.history.pushState(null, '', `/#${name}`);
            window.dispatchEvent(new PopStateEvent('popstate'));
          }
        }}
      />
    </div>
  );
};
