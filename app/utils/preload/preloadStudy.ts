/**
 * app/utils/preload/preloadStudy.ts
 *
 * Downloads every video and custom button icon in a study before the session starts,
 * so nothing is fetched over the network while a participant is swiping.
 * Each file is turned into an in-memory object URL; call releaseMedia() when the session ends.
 */

import type { Study } from '@/app/types';

export interface PreloadProgress {
  loadedBytes: number;
  /** Sum of Content-Length headers seen so far; 0 until servers report sizes */
  totalBytes: number;
  filesDone: number;
  filesTotal: number;
}

/** Maps an original media URL to its local object URL */
export type MediaMap = Map<string, string>;

const CONCURRENCY = 3;
const MAX_ATTEMPTS = 3;

export function collectMediaUrls(study: Study): string[] {
  const urls = study.blocks.flatMap((block) => (block.type === 'video' ? [block.videoUrl] : []));
  if (study.display.leftIcon) urls.push(study.display.leftIcon);
  if (study.display.rightIcon) urls.push(study.display.rightIcon);
  return [...new Set(urls)];
}

async function downloadOnce(
  url: string,
  onBytes: (delta: number) => void,
  onTotal: (bytes: number) => void,
  signal?: AbortSignal
): Promise<Blob> {
  const response = await fetch(url, { signal });
  if (!response.ok) {
    throw new Error(`Failed to download ${url} (${response.status})`);
  }
  const type = response.headers.get('Content-Type') ?? '';
  onTotal(Number(response.headers.get('Content-Length') ?? 0));

  // Stream the body so we can report byte-level progress.
  if (!response.body) {
    const blob = await response.blob();
    onBytes(blob.size);
    return blob;
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    onBytes(value.byteLength);
  }
  return new Blob(chunks as BlobPart[], { type });
}

export async function preloadStudy(
  study: Study,
  onProgress: (progress: PreloadProgress) => void,
  signal?: AbortSignal
): Promise<MediaMap> {
  const urls = collectMediaUrls(study);
  const progress: PreloadProgress = { loadedBytes: 0, totalBytes: 0, filesDone: 0, filesTotal: urls.length };
  const report = () => onProgress({ ...progress });
  const media: MediaMap = new Map();
  // One controller for all downloads: a failed file or a caller abort stops every worker.
  const controller = new AbortController();
  signal?.addEventListener('abort', () => controller.abort(), { once: true });
  report();

  const loadWithRetry = async (url: string) => {
    for (let attempt = 1; ; attempt++) {
      let attemptBytes = 0;
      let attemptTotal = 0;
      try {
        const blob = await downloadOnce(
          url,
          (delta) => {
            attemptBytes += delta;
            progress.loadedBytes += delta;
            report();
          },
          (bytes) => {
            attemptTotal = bytes;
            progress.totalBytes += bytes;
          },
          controller.signal
        );
        if (controller.signal.aborted) return;
        media.set(url, URL.createObjectURL(blob));
        progress.filesDone += 1;
        report();
        return;
      } catch (error) {
        // Roll back this attempt's progress before retrying.
        progress.loadedBytes -= attemptBytes;
        progress.totalBytes -= attemptTotal;
        if (controller.signal.aborted || attempt >= MAX_ATTEMPTS) throw error;
      }
    }
  };

  const queue = [...urls];
  const worker = async () => {
    while (queue.length > 0) {
      await loadWithRetry(queue.shift()!);
    }
  };

  try {
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, urls.length) }, worker));
  } catch (error) {
    controller.abort();
    releaseMedia(media);
    throw error;
  }
  return media;
}

export function releaseMedia(media: MediaMap): void {
  media.forEach((objectUrl) => URL.revokeObjectURL(objectUrl));
  media.clear();
}
