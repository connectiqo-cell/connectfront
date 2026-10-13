const mockStore = new Map();

jest.mock('@react-native-async-storage/async-storage', () => ({
  getAllKeys: async () => [...mockStore.keys()],
  multiGet: async keys => keys.map(k => [k, mockStore.get(k)]),
  setItem: async (k, v) => { mockStore.set(k, v); },
  removeItem: async k => { mockStore.delete(k); },
}));
jest.mock('tus-js-client', () => ({ Upload: class {} }));
jest.mock('../supabase', () => ({ SUPABASE_URL: 'https://test.supabase.co' }));

import { AsyncStorageUrlStorage } from '../resumableUpload';

describe('AsyncStorageUrlStorage', () => {
  beforeEach(() => mockStore.clear());

  it('round-trips an upload and finds it by fingerprint', async () => {
    const s = new AsyncStorageUrlStorage();
    await s.addUpload('mentor-videos/abc/1.mp4', { uploadUrl: 'https://u/1', size: 100 });
    await s.addUpload('mentor-videos/xyz/2.mp4', { uploadUrl: 'https://u/2', size: 200 });

    const found = await s.findUploadsByFingerprint('mentor-videos/abc/1.mp4');
    expect(found).toHaveLength(1);
    expect(found[0].uploadUrl).toBe('https://u/1');
    expect(await s.findAllUploads()).toHaveLength(2);
  });

  it('removes an upload by its storage key', async () => {
    const s = new AsyncStorageUrlStorage();
    const key = await s.addUpload('bucket/path.mp4', { uploadUrl: 'https://u/1' });
    await s.removeUpload(key);
    expect(await s.findAllUploads()).toHaveLength(0);
  });

  it('ignores unrelated AsyncStorage keys and corrupt entries', async () => {
    mockStore.set('some-other-app-key', 'not json');
    mockStore.set('tus::broken/path::1', '{oops');
    const s = new AsyncStorageUrlStorage();
    await s.addUpload('bucket/good.mp4', { uploadUrl: 'https://u/ok' });

    const all = await s.findAllUploads();
    expect(all).toHaveLength(1);
    expect(all[0].uploadUrl).toBe('https://u/ok');
  });
});
