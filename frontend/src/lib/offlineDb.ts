import { openDB } from 'idb';
import type { Servicio } from '@/types';

const DB_NAME = 'refri-offline';
const DB_VERSION = 2;

function db() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(database) {
      if (!database.objectStoreNames.contains('servicio-cache')) {
        database.createObjectStore('servicio-cache');
      }
      if (!database.objectStoreNames.contains('sync-queue')) {
        database.createObjectStore('sync-queue', { keyPath: 'id', autoIncrement: true });
      }
      if (!database.objectStoreNames.contains('auth')) {
        database.createObjectStore('auth');
      }
    },
  });
}

// ─── Servicio cache ────────────────────────────────────────────────────────

type CacheEntry = { data: Servicio; cachedAt: number };

export async function cacheServicio(servicio: Servicio) {
  const idb = await db();
  const entry: CacheEntry = { data: servicio, cachedAt: Date.now() };
  await idb.put('servicio-cache', entry, servicio.id);
}

export async function getCachedServicio(servicioId: string): Promise<Servicio | undefined> {
  const idb = await db();
  const raw = await idb.get('servicio-cache', servicioId);
  if (!raw) return undefined;
  // Handle both new format {data, cachedAt} and old format (raw Servicio object)
  if ('cachedAt' in raw) return (raw as CacheEntry).data;
  return raw as Servicio;
}

// Deletes completed/cancelled services older than 2 days, and any legacy entries without timestamp
export async function cleanupServicioCache() {
  const idb = await db();
  const keys = await idb.getAllKeys('servicio-cache');
  const TWO_DAYS = 2 * 24 * 60 * 60 * 1000;
  const now = Date.now();

  for (const key of keys) {
    const raw = await idb.get('servicio-cache', key);
    if (!raw) continue;

    const isNewFormat = raw && 'cachedAt' in raw;
    if (!isNewFormat) { await idb.delete('servicio-cache', key); continue; } // legacy entry

    const { data: servicio, cachedAt } = raw as CacheEntry;
    const isOld = now - cachedAt > TWO_DAYS;
    const isInactive = ['completado', 'cancelado'].includes(servicio?.estado ?? '');

    if (isOld && isInactive) await idb.delete('servicio-cache', key);
  }
}

// ─── Auth token (needed by service worker for Background Sync) ─────────────

export async function saveAuthToken(token: string) {
  const idb = await db();
  await idb.put('auth', token, 'token');
}

// ─── Sync queue ────────────────────────────────────────────────────────────

export type QueueEntry =
  | { id: number; type: 'checklist'; servicioId: string; itemId: string; timestamp: number }
  | { id: number; type: 'foto'; servicioId: string; tipo: 'antes' | 'durante' | 'despues'; blob: Blob; localUrl: string; timestamp: number };

function registerBackgroundSync() {
  if ('serviceWorker' in navigator && 'SyncManager' in window) {
    navigator.serviceWorker.ready
      .then((reg) => (reg as ServiceWorkerRegistration & { sync: { register(tag: string): Promise<void> } }).sync.register('offline-sync'))
      .catch(() => {});
  }
}

export async function enqueueChecklist(servicioId: string, itemId: string) {
  const idb = await db();
  await idb.add('sync-queue', { type: 'checklist', servicioId, itemId, timestamp: Date.now() });
  registerBackgroundSync();
}

export async function enqueueFoto(
  servicioId: string,
  tipo: 'antes' | 'durante' | 'despues',
  blob: Blob,
  localUrl: string,
) {
  const idb = await db();
  await idb.add('sync-queue', { type: 'foto', servicioId, tipo, blob, localUrl, timestamp: Date.now() });
  registerBackgroundSync();
}

export async function getPendingQueue(): Promise<QueueEntry[]> {
  const idb = await db();
  return idb.getAll('sync-queue');
}

export async function removeFromQueue(id: number) {
  const idb = await db();
  await idb.delete('sync-queue', id);
}
