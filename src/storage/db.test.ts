import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { deleteProject, listProjects, loadLatestDraft, loadProject, saveProject } from './db';
import { SAMPLE_MINUET_IN_G } from '../data/samples';
import { Score } from '../types/music';

function freshScore(id: string, title = 'Draft'): Score {
  return { ...SAMPLE_MINUET_IN_G, id, title, updatedAt: Date.now() };
}

async function clearAll() {
  localStorage.clear();

  // Clearing the stores (rather than deleting the database) keeps the reset
  // synchronous with the tests and avoids blocked version-change requests.
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.open('musikflo_db', 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('scores')) db.createObjectStore('scores', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('metadata')) db.createObjectStore('metadata', { keyPath: 'key' });
    };
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction(['scores', 'metadata'], 'readwrite');
      tx.objectStore('scores').clear();
      tx.objectStore('metadata').clear();
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error);
      };
    };
    request.onerror = () => reject(request.error);
  });
}

beforeEach(async () => {
  await clearAll();
});

describe('saveProject', () => {
  it('writes through IndexedDB and reports the backend that succeeded', async () => {
    const result = await saveProject(freshScore('s1'));
    expect(result).toEqual({ ok: true, backend: 'indexeddb' });
    expect((await loadProject('s1'))?.title).toBe('Draft');
  });

  it('falls back to localStorage and says so when IndexedDB fails', async () => {
    const spy = vi.spyOn(indexedDB, 'open').mockImplementation(() => {
      throw new Error('blocked');
    });

    const result = await saveProject(freshScore('s2', 'Fallback'));
    expect(result).toEqual({ ok: true, backend: 'localstorage' });

    spy.mockRestore();

    // The fallback save must be recoverable even though IndexedDB is empty.
    expect((await loadLatestDraft())?.title).toBe('Fallback');
  });

  it('reports failure instead of pretending to save when both backends fail', async () => {
    const openSpy = vi.spyOn(indexedDB, 'open').mockImplementation(() => {
      throw new Error('blocked');
    });
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('QuotaExceededError');
    });

    const result = await saveProject(freshScore('s3'));
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.error).toBeTruthy();

    openSpy.mockRestore();
    setItemSpy.mockRestore();
  });
});

describe('loadLatestDraft', () => {
  it('returns null when nothing has been saved', async () => {
    expect(await loadLatestDraft()).toBeNull();
  });

  it('returns the most recently saved project', async () => {
    await saveProject(freshScore('s1', 'First'));
    await saveProject(freshScore('s2', 'Second'));
    expect((await loadLatestDraft())?.title).toBe('Second');
  });

  it('recovers a localStorage-only draft', async () => {
    const openSpy = vi.spyOn(indexedDB, 'open').mockImplementation(() => {
      throw new Error('blocked');
    });
    await saveProject(freshScore('s9', 'Local only'));
    openSpy.mockRestore();
    // IndexedDB is empty but has no latest pointer either, so recovery must
    // consult the localStorage fallback.
    expect((await loadLatestDraft())?.title).toBe('Local only');
  });

  it('does not throw on corrupt stored data', async () => {
    localStorage.setItem('musikflo_latest_id', 'broken');
    localStorage.setItem('musikflo_score_broken', '{not json');
    await expect(loadLatestDraft()).resolves.toBeNull();
  });
});

describe('listProjects and deleteProject', () => {
  it('lists saved projects newest first', async () => {
    await saveProject(freshScore('s1', 'Old'));
    await new Promise((resolve) => setTimeout(resolve, 5));
    await saveProject({ ...freshScore('s2', 'New'), updatedAt: Date.now() + 1000 });

    const list = await listProjects();
    expect(list.map((p) => p.title)).toContain('New');
    expect(list[0].title).toBe('New');
  });

  it('removes a project so it can no longer be recovered', async () => {
    await saveProject(freshScore('s1', 'Doomed'));
    await deleteProject('s1');
    expect(await loadProject('s1')).toBeNull();
    expect(await loadLatestDraft()).toBeNull();
  });

  it('clears the latest pointer when the latest project is deleted', async () => {
    await saveProject(freshScore('s1', 'Keeper'));
    await saveProject(freshScore('s2', 'Doomed'));
    await deleteProject('s2');
    expect(await loadLatestDraft()).toBeNull();
    expect((await loadProject('s1'))?.title).toBe('Keeper');
  });
});
