import sharp from 'sharp';
import { maxIntakePhotoPixels } from './photo-intake-limits.mjs';

export const PUBLIC_REALIZATION_IMAGE_WIDTHS = [360, 720, 1080] as const;
const publicWidths = new Set<number>(PUBLIC_REALIZATION_IMAGE_WIDTHS);

export class PublicRealizationMediaBusyError extends Error {
  constructor() {
    super('public-realization-media-busy');
  }
}

export function parsePublicRealizationImageWidth(requestUrl: string) {
  const value = new URL(requestUrl).searchParams.get('w');
  if (value === null) return null;
  const width = Number(value);
  return publicWidths.has(width) ? width : undefined;
}

export async function resizePublicRealizationPhoto(bytes: Uint8Array, width: number) {
  return sharp(Buffer.from(bytes), {
    limitInputPixels: maxIntakePhotoPixels,
    failOn: 'error',
    sequentialRead: true,
  })
    .resize({ width, height: Math.round(width * 2 / 3), fit: 'cover', position: 'centre' })
    .jpeg({ quality: 82 })
    .toBuffer();
}

type VariantStoreOptions = {
  maxCacheBytes?: number;
  ttlMs?: number;
  maxActiveTransforms?: number;
  maxQueuedTransforms?: number;
  now?: () => number;
  resize?: (bytes: Uint8Array, width: number) => Promise<Buffer>;
};

export function createPublicRealizationPhotoVariantStore(options: VariantStoreOptions = {}) {
  const maxCacheBytes = options.maxCacheBytes ?? 24 * 1024 * 1024;
  const ttlMs = options.ttlMs ?? 5 * 60_000;
  const maxActiveTransforms = options.maxActiveTransforms ?? 4;
  const maxQueuedTransforms = options.maxQueuedTransforms ?? 12;
  const now = options.now ?? Date.now;
  const resize = options.resize ?? resizePublicRealizationPhoto;
  const cache = new Map<string, { bytes: Buffer; expiresAt: number }>();
  const inFlight = new Map<string, Promise<Buffer>>();
  const queue: Array<{
    task: () => Promise<Buffer>;
    resolve: (bytes: Buffer) => void;
    reject: (error: unknown) => void;
  }> = [];
  let cacheBytes = 0;
  let activeTransforms = 0;

  const removeCached = (key: string) => {
    const cached = cache.get(key);
    if (!cached) return;
    cache.delete(key);
    cacheBytes -= cached.bytes.byteLength;
  };

  const trimCache = (at: number, incomingBytes: number) => {
    for (const [key, value] of cache) {
      if (value.expiresAt <= at) removeCached(key);
    }
    while (cache.size > 0 && cacheBytes + incomingBytes > maxCacheBytes) {
      const oldestKey = cache.keys().next().value;
      if (typeof oldestKey !== 'string') break;
      removeCached(oldestKey);
    }
  };

  const drainQueue = () => {
    while (activeTransforms < maxActiveTransforms && queue.length > 0) {
      const item = queue.shift();
      if (!item) break;
      activeTransforms += 1;
      void item.task().then(item.resolve, item.reject).finally(() => {
        activeTransforms -= 1;
        drainQueue();
      });
    }
  };

  const schedule = (task: () => Promise<Buffer>) => {
    if (activeTransforms >= maxActiveTransforms && queue.length >= maxQueuedTransforms) {
      return Promise.reject(new PublicRealizationMediaBusyError());
    }
    const promise = new Promise<Buffer>((resolve, reject) => queue.push({ task, resolve, reject }));
    drainQueue();
    return promise;
  };

  return {
    async get(storageKey: string, width: number, loadVerifiedSource: () => Promise<Buffer>) {
      const cacheKey = `${storageKey}:${width}`;
      const at = now();
      const cached = cache.get(cacheKey);
      if (cached && cached.expiresAt > at) {
        cache.delete(cacheKey);
        cache.set(cacheKey, cached);
        return cached.bytes;
      }
      if (cached) removeCached(cacheKey);

      const existing = inFlight.get(cacheKey);
      if (existing) return existing;

      const pending = schedule(async () => {
        const source = await loadVerifiedSource();
        const bytes = await resize(source, width);
        trimCache(now(), bytes.byteLength);
        if (bytes.byteLength <= maxCacheBytes) {
          cache.set(cacheKey, { bytes, expiresAt: now() + ttlMs });
          cacheBytes += bytes.byteLength;
        }
        return bytes;
      });
      inFlight.set(cacheKey, pending);
      try {
        return await pending;
      } finally {
        inFlight.delete(cacheKey);
      }
    },
    snapshot() {
      return { cacheEntries: cache.size, cacheBytes, inFlight: inFlight.size, activeTransforms, queuedTransforms: queue.length };
    },
  };
}

const publicVariantStore = createPublicRealizationPhotoVariantStore();

export const getPublicRealizationPhotoVariant = publicVariantStore.get;
