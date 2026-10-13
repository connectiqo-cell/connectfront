let mockStore = {};

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: async k => mockStore[k] ?? null,
  setItem: async (k, v) => { mockStore[k] = v; },
}));

import { enqueue, listPending, patchRecord, removeRecord, processQueue, retryNow, clearBackoff } from '../uploadQueue';

const rec = (id, extra = {}) => ({ id, title: `v${id}`, storagePath: `m/${id}.mp4`, ...extra });

describe('uploadQueue', () => {
  beforeEach(() => { mockStore = {}; });

  it('keeps a record when its upload fails, so it can resume later', async () => {
    await enqueue(rec('a'));
    await processQueue(async () => { throw new Error('socket died'); });

    const left = await listPending();
    expect(left).toHaveLength(1);
    expect(left[0].error).toBe('socket died');
  });

  it('removes a record only after its upload resolves', async () => {
    await enqueue(rec('a'));
    await enqueue(rec('b'));
    const done = [];
    await processQueue(async r => { done.push(r.id); return { id: `row-${r.id}` }; });

    expect(done).toEqual(['a', 'b']);
    expect(await listPending()).toHaveLength(0);
  });

  it('persists step results so a resumed run skips completed work', async () => {
    await enqueue(rec('a'));
    // First run compresses then dies before the upload finishes.
    await processQueue(async (r, patch) => {
      await patch({ compressedUri: 'file:///tmp/a.mp4' });
      throw new Error('killed');
    });

    const [saved] = await listPending();
    expect(saved.compressedUri).toBe('file:///tmp/a.mp4');

    // App restart clears backoff, as it does in the screen's mount effect.
    await clearBackoff();

    // Second run sees the compressed file already on record.
    let sawCompressed = null;
    await processQueue(async r => { sawCompressed = r.compressedUri; return {}; });
    expect(sawCompressed).toBe('file:///tmp/a.mp4');
    expect(await listPending()).toHaveLength(0);
  });

  it('does not run two passes concurrently', async () => {
    await enqueue(rec('a'));
    let active = 0;
    let maxActive = 0;
    const work = async () => {
      active += 1; maxActive = Math.max(maxActive, active);
      await new Promise(r => setTimeout(r, 10));
      active -= 1;
      return {};
    };
    await Promise.all([processQueue(work), processQueue(work)]);
    expect(maxActive).toBe(1);
  });

  it('patchRecord and removeRecord target only the named record', async () => {
    await enqueue(rec('a'));
    await enqueue(rec('b'));
    await patchRecord('a', { title: 'changed' });
    await removeRecord('b');

    const left = await listPending();
    expect(left).toHaveLength(1);
    expect(left[0].title).toBe('changed');
  });
});

describe('uploadQueue backoff', () => {
  beforeEach(() => { mockStore = {}; });

  it('skips a record still in backoff so new uploads are not blocked', async () => {
    await enqueue(rec('old'));
    await processQueue(async () => { throw new Error('bad network'); });

    // A fresh upload queued right after the failure.
    await enqueue(rec('new'));

    const tried = [];
    await processQueue(async r => { tried.push(r.id); return {}; });

    // 'old' is backing off; only the new one runs.
    expect(tried).toEqual(['new']);
  });

  it('backs off further on each successive failure', async () => {
    await enqueue(rec('a'));
    await processQueue(async () => { throw new Error('x'); });
    const first = (await listPending())[0];
    expect(first.attempts).toBe(1);

    await patchRecord('a', { nextAttemptAt: 0 });
    await processQueue(async () => { throw new Error('x'); });
    const second = (await listPending())[0];

    expect(second.attempts).toBe(2);
    expect(second.nextAttemptAt - Date.now()).toBeGreaterThan(60_000);
  });

  it('retryNow clears backoff so the record runs again', async () => {
    await enqueue(rec('a'));
    await processQueue(async () => { throw new Error('x'); });

    await retryNow('a');
    const tried = [];
    await processQueue(async r => { tried.push(r.id); return {}; });
    expect(tried).toEqual(['a']);
  });
});
