import { cleanupServicioCache } from './offlineDb';

const MAX_IMAGES = 150; // ~30 MB worst case
const MAX_API    = 100;

export async function runCacheCleanup() {
  await cleanupServicioCache().catch(() => {});
  await trimCache('refri-img-v1', MAX_IMAGES).catch(() => {});
  await trimCache('refri-api-v1', MAX_API).catch(() => {});
}

// Cache.keys() returns entries in insertion order (oldest first).
// When we exceed the limit, slice off the oldest ones.
async function trimCache(cacheName: string, maxEntries: number) {
  if (!('caches' in window)) return;
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length <= maxEntries) return;
  const toDelete = keys.slice(0, keys.length - maxEntries);
  await Promise.all(toDelete.map((req) => cache.delete(req)));
}
