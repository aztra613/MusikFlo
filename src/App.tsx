import { useCallback, useEffect, useRef, useState } from 'react';
import { LandingPage } from './components/LandingPage';
import { Studio } from './components/Studio';
import { LegalPage } from './components/LegalPage';
import { TranscribePage } from './components/TranscribePage';
import { Score } from './types/music';
import { SAMPLE_ODE_TO_JOY, createBlankScore } from './data/samples';
import { loadLatestDraft } from './storage/db';
import { LEGAL_DOCUMENTS } from './content/legal';
import { Route, hrefFor, isLegalRoute, parseHash } from './routing/routes';

const THEME_KEY = 'musikflo_theme';

function readStoredTheme(): 'light' | 'dark' | null {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    return saved === 'dark' || saved === 'light' ? saved : null;
  } catch {
    return null;
  }
}

interface StudioEntry {
  /** Score handed to the studio on mount. */
  score: Score;
  /** Increments so the studio remounts when a different score is chosen. */
  key: number;
}

export default function App() {
  // Always default to 'light' mode for new visitors. Only use 'dark' if the user explicitly chose it previously.
  const [theme, setTheme] = useState<'light' | 'dark'>(() => readStoredTheme() ?? 'light');

  const [route, setRoute] = useState<Route>(() => parseHash(window.location.hash));
  const [entry, setEntry] = useState<StudioEntry | null>(null);
  /** The most recently edited score, so leaving and re-entering the studio
   *  restores the live work rather than a stale recovered draft. */
  const lastScoreRef = useRef<Score | null>(null);
  const entryKey = useRef(0);
  const recoveryDone = useRef(false);

  /* ------------------------------- theme ------------------------------- */

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', theme === 'dark');
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      // Storage can be blocked; the theme still applies for this session.
    }
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  }, []);

  /* ------------------------------ routing ------------------------------ */

  const navigate = useCallback((name: Parameters<typeof hrefFor>[0]) => {
    const next = hrefFor(name);
    if (window.location.hash !== next) {
      window.location.hash = next;
    }
    setRoute(parseHash(next));
  }, []);

  useEffect(() => {
    const onHashChange = () => setRoute(parseHash(window.location.hash));
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  // Landing section anchors are in-page scrolls, not separate routes.
  useEffect(() => {
    if (route.name !== 'landing' || !route.section) return;
    const target = document.getElementById(route.section);
    target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [route]);

  /* ---------------------------- studio entry --------------------------- */

  const openStudio = useCallback(
    (score: Score) => {
      entryKey.current += 1;
      lastScoreRef.current = score;
      setEntry({ score, key: entryKey.current });
      navigate('studio');
    },
    [navigate]
  );

  // Recover the latest local draft once, before the studio can be entered, so a
  // click on "Start composing" can never race a late-arriving draft.
  useEffect(() => {
    let cancelled = false;
    loadLatestDraft()
      .then((draft) => {
        if (cancelled) return;
        if (draft) lastScoreRef.current = draft;
      })
      .catch(() => {
        // A corrupt or blocked draft must not stop the app from loading.
      })
      .finally(() => {
        recoveryDone.current = true;
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleStartComposing = useCallback(async () => {
    // Wait for recovery so an in-progress draft is not silently discarded.
    if (!recoveryDone.current) {
      await new Promise<void>((resolve) => {
        const started = Date.now();
        const poll = () => {
          if (recoveryDone.current || Date.now() - started > 3000) resolve();
          else setTimeout(poll, 30);
        };
        poll();
      });
    }
    openStudio(lastScoreRef.current ?? createBlankScore());
  }, [openStudio]);

  const handleTrySample = useCallback(() => {
    openStudio(SAMPLE_ODE_TO_JOY);
  }, [openStudio]);

  const handleGoHome = useCallback(() => {
    navigate('landing');
  }, [navigate]);

  const handleScoreChange = useCallback((score: Score) => {
    lastScoreRef.current = score;
  }, []);

  /* ------------------------------ rendering ---------------------------- */

  if (route.name === 'landing') {
    return (
      <LandingPage
        onStartComposing={() => void handleStartComposing()}
        onTrySample={handleTrySample}
        onTranscribeAudio={() => navigate('transcribe')}
        theme={theme}
        onToggleTheme={toggleTheme}
      />
    );
  }

  if (isLegalRoute(route.name)) {
    const doc = LEGAL_DOCUMENTS[route.name];
    return (
      <LegalPage
        route={route.name}
        title={doc.title}
        summary={doc.summary}
        sections={doc.sections}
        theme={theme}
        onToggleTheme={toggleTheme}
        onGoHome={handleGoHome}
      />
    );
  }

  if (route.name === 'transcribe') {
    return (
      <TranscribePage
        theme={theme}
        onToggleTheme={toggleTheme}
        onGoHome={handleGoHome}
        // A transcription always becomes a brand-new project, so the composition
        // held in memory is left untouched until the user opens the result.
        onAccept={(score) => openStudio(score)}
      />
    );
  }

  // Studio
  return (
    <Studio
      key={entry?.key ?? 0}
      initialScore={entry?.score ?? lastScoreRef.current ?? createBlankScore()}
      theme={theme}
      onToggleTheme={toggleTheme}
      onGoHome={handleGoHome}
      onScoreChange={handleScoreChange}
    />
  );
}
