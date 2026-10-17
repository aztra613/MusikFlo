import { Score } from '../types/music';

const DB_NAME = 'musikflo_db';
const DB_VERSION = 1;
const STORE_SCORES = 'scores';
const STORE_META = 'metadata';
const LATEST_ID_KEY = 'latest_draft_id';
const LS_LATEST_ID = 'musikflo_latest_id';
const LS_SCORE_PREFIX = 'musikflo_score_';

export type SaveBackend = 'indexeddb' | 'localstorage';

export type SaveResult =
  | { ok: true; backend: SaveBackend }
  | { ok: false; error: string };

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB is not available in this browser'));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_SCORES)) {
        db.createObjectStore(STORE_SCORES, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_META)) {
        db.createObjectStore(STORE_META, { keyPath: 'key' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Could not open the local database'));
  });
}

/** localStorage is the documented fallback when IndexedDB is unavailable. */
function saveToLocalStorage(score: Score): SaveResult {
  try {
    localStorage.setItem(`${LS_SCORE_PREFIX}${score.id}`, JSON.stringify(score));
    localStorage.setItem(LS_LATEST_ID, score.id);
    return { ok: true, backend: 'localstorage' };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Browser storage is unavailable or full',
    };
  }
}

function parseScore(raw: string | null): Score | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as Score) : null;
  } catch {
    return null;
  }
}

/**
 * Persist a project. Reports which backend actually succeeded, or fails
 * honestly — the UI must never claim "saved" when nothing was written.
 */
export async function saveProject(score: Score): Promise<SaveResult> {
  const scoreToSave = { ...score, updatedAt: Date.now() };

  try {
    const db = await openDB();
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction([STORE_SCORES, STORE_META], 'readwrite');
        tx.objectStore(STORE_SCORES).put(scoreToSave);
        tx.objectStore(STORE_META).put({ key: LATEST_ID_KEY, value: score.id });
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error ?? new Error('IndexedDB write failed'));
        tx.onabort = () => reject(tx.error ?? new Error('IndexedDB write aborted'));
      });
      return { ok: true, backend: 'indexeddb' };
    } finally {
      db.close();
    }
  } catch {
    return saveToLocalStorage(scoreToSave);
  }
}

export async function loadProject(id: string): Promise<Score | null> {
  try {
    const db = await openDB();
    try {
      const fromDb = await new Promise<Score | null>((resolve) => {
        const tx = db.transaction(STORE_SCORES, 'readonly');
        const req = tx.objectStore(STORE_SCORES).get(id);
        req.onsuccess = () => resolve((req.result as Score) ?? null);
        req.onerror = () => resolve(null);
      });
      if (fromDb) return fromDb;
    } finally {
      db.close();
    }
  } catch {
    // Fall through to the localStorage fallback below.
  }
  return parseScore(localStorage.getItem(`${LS_SCORE_PREFIX}${id}`));
}

/** Load the most recent draft from either backend. Never throws. */
export async function loadLatestDraft(): Promise<Score | null> {
  try {
    const db = await openDB();
    let latestId: string | null = null;
    try {
      latestId = await new Promise<string | null>((resolve) => {
        const tx = db.transaction(STORE_META, 'readonly');
        const req = tx.objectStore(STORE_META).get(LATEST_ID_KEY);
        req.onsuccess = () => resolve(req.result ? (req.result.value as string) : null);
        req.onerror = () => resolve(null);
      });
    } finally {
      db.close();
    }

    if (latestId) {
      const score = await loadProject(latestId);
      if (score) return score;
    }
  } catch {
    // IndexedDB unavailable — use localStorage.
  }

  const localId = localStorage.getItem(LS_LATEST_ID);
  if (localId) {
    const score = parseScore(localStorage.getItem(`${LS_SCORE_PREFIX}${localId}`));
    if (score) return score;
  }

  return null;
}

export async function listProjects(): Promise<
  Array<{ id: string; title: string; updatedAt: number; measuresCount: number }>
> {
  const toSummary = (s: Score) => ({
    id: s.id,
    title: s.title || 'Untitled',
    updatedAt: s.updatedAt || 0,
    measuresCount: s.measures?.length || 0,
  });

  try {
    const db = await openDB();
    try {
      const scores = await new Promise<Score[]>((resolve) => {
        const tx = db.transaction(STORE_SCORES, 'readonly');
        const req = tx.objectStore(STORE_SCORES).getAll();
        req.onsuccess = () => resolve((req.result as Score[]) || []);
        req.onerror = () => resolve([]);
      });

      return scores.map(toSummary).sort((a, b) => b.updatedAt - a.updatedAt);
    } finally {
      db.close();
    }
  } catch {
    const list: Array<ReturnType<typeof toSummary>> = [];
    for (const key of Object.keys(localStorage)) {
      if (!key.startsWith(LS_SCORE_PREFIX)) continue;
      const score = parseScore(localStorage.getItem(key));
      if (score) list.push(toSummary(score));
    }
    return list.sort((a, b) => b.updatedAt - a.updatedAt);
  }
}

/** Delete a project and repair the latest-draft pointer if it pointed at it. */
export async function deleteProject(id: string): Promise<void> {
  try {
    const db = await openDB();
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction([STORE_SCORES, STORE_META], 'readwrite');
        tx.objectStore(STORE_SCORES).delete(id);

        const meta = tx.objectStore(STORE_META);
        const req = meta.get(LATEST_ID_KEY);
        req.onsuccess = () => {
          if (req.result && req.result.value === id) {
            meta.delete(LATEST_ID_KEY);
          }
        };

        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error ?? new Error('IndexedDB delete failed'));
      });
    } finally {
      db.close();
    }
  } catch {
    // Ignore and clean up the fallback below.
  }

  localStorage.removeItem(`${LS_SCORE_PREFIX}${id}`);
  if (localStorage.getItem(LS_LATEST_ID) === id) {
    localStorage.removeItem(LS_LATEST_ID);
  }
}
