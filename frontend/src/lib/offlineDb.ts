import { openDB } from 'idb';
import type { Servicio } from '@/types';

const DB_NAME = 'refri-offline';
const DB_VERSION = 1;

function db() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(database) {
      if (!database.objectStoreNames.contains('servicio-cache')) {
        database.createObjectStore('servicio-cache');
      }
      if (!database.objectStoreNames.contains('sync-queue')) {
        database.createObjectStore('sync-queue', { keyPath: 'id', autoIncrement: true });
      }
    },
  });
}

export async function cacheServicio(servicio: Servicio) {
  const idb = await db();
  await idb.put('servicio-cache', servicio, servicio.id);
}

export async function getCachedServicio(servicioId: string): Promise<Servicio | undefined> {
  const idb = await db();
  return idb.get('servicio-cache', servicioId);
}

export type QueueEntry =
  | { id: number; type: 'checklist'; servicioId: string; itemId: string; timestamp: number }
  | { id: number; type: 'foto'; servicioId: string; tipo: 'antes' | 'durante' | 'despues'; blob: Blob; localUrl: string; timestamp: number };

export async function enqueueChecklist(servicioId: string, itemId: string) {
  const idb = await db();
  await idb.add('sync-queue', { type: 'checklist', servicioId, itemId, timestamp: Date.now() });
}

export async function enqueueFoto(
  servicioId: string,
  tipo: 'antes' | 'durante' | 'despues',
  blob: Blob,
  localUrl: string,
) {
  const idb = await db();
  await idb.add('sync-queue', { type: 'foto', servicioId, tipo, blob, localUrl, timestamp: Date.now() });
}

export async function getPendingQueue(): Promise<QueueEntry[]> {
  const idb = await db();
  return idb.getAll('sync-queue');
}

export async function removeFromQueue(id: number) {
  const idb = await db();
  await idb.delete('sync-queue', id);
}
