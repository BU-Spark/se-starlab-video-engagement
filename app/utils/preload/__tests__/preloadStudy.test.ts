import type { Study } from '@/app/types';
import { collectMediaUrls, preloadStudy, releaseMedia } from '../preloadStudy';

const study: Study = {
  id: 's',
  name: 'S',
  randomized: false,
  display: { videoBar: false, leftText: '', rightText: '', rightIcon: '/icons/like.png' },
  controls: { swipeUp: false, responseButtons: true, pausing: false, audioRecord: false, cameraRecord: false },
  blocks: [
    { id: 'a', type: 'video', label: 'a', videoUrl: '/a.mp4', fileName: 'a.mp4' },
    { id: 'b', type: 'instructions', label: 'b', text: 'hi' },
    { id: 'c', type: 'video', label: 'c', videoUrl: '/a.mp4', fileName: 'a.mp4' },
    { id: 'd', type: 'video', label: 'd', videoUrl: '/d.mp4', fileName: 'd.mp4' },
  ],
};

const okResponse = (size: number) => ({
  ok: true,
  status: 200,
  headers: { get: (h: string) => (h === 'Content-Length' ? String(size) : 'video/mp4') },
  body: null,
  blob: async () => ({ size }),
});

beforeEach(() => {
  let n = 0;
  URL.createObjectURL = jest.fn(() => `blob:${++n}`);
  URL.revokeObjectURL = jest.fn();
});

describe('preloadStudy', () => {
  it('collects each video and custom icon once', () => {
    expect(collectMediaUrls(study)).toEqual(['/a.mp4', '/d.mp4', '/icons/like.png']);
  });

  it('downloads everything into object URLs and reports progress', async () => {
    global.fetch = jest.fn(async () => okResponse(100)) as unknown as typeof fetch;
    const onProgress = jest.fn();
    const media = await preloadStudy(study, onProgress);

    expect(media.size).toBe(3);
    expect(media.get('/a.mp4')).toMatch(/^blob:/);
    expect(onProgress).toHaveBeenLastCalledWith({ loadedBytes: 300, totalBytes: 300, filesDone: 3, filesTotal: 3 });

    releaseMedia(media);
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(3);
  });

  it('retries a failed download before giving up', async () => {
    let calls = 0;
    global.fetch = jest.fn(async (url: string) => {
      if (url === '/d.mp4' && calls++ === 0) throw new Error('network blip');
      return okResponse(10);
    }) as unknown as typeof fetch;
    const media = await preloadStudy(study, jest.fn());
    expect(media.size).toBe(3);
  });

  it('rejects when a file keeps failing', async () => {
    global.fetch = jest.fn(async (url: string) =>
      url === '/d.mp4' ? { ...okResponse(0), ok: false, status: 404 } : okResponse(10)
    ) as unknown as typeof fetch;
    await expect(preloadStudy(study, jest.fn())).rejects.toThrow('404');
  });
});
