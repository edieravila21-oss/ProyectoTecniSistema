import { getPendingQueue, removeFromQueue } from './offlineDb';
import { marcarChecklistItem, subirFoto } from '@/api/servicios';

let syncing = false;

export async function processSyncQueue(): Promise<number> {
  if (syncing || !navigator.onLine) return 0;
  syncing = true;
  let synced = 0;

  try {
    const queue = await getPendingQueue();
    for (const entry of queue) {
      try {
        if (entry.type === 'checklist') {
          await marcarChecklistItem(entry.servicioId, entry.itemId);
          synced++;
        } else if (entry.type === 'foto') {
          const formData = new FormData();
          formData.append('foto', entry.blob, 'foto.jpg');
          formData.append('tipo', entry.tipo);
          await subirFoto(entry.servicioId, formData);
          URL.revokeObjectURL(entry.localUrl);
          synced++;
        }
        await removeFromQueue(entry.id);
      } catch (err: unknown) {
        const status = (err as { response?: { status?: number } })?.response?.status;
        // 4xx = server rejected (already processed, limit exceeded, etc.) — remove to avoid infinite loop
        if (status && status >= 400 && status < 500) {
          await removeFromQueue(entry.id);
        }
        // Network errors: keep in queue for next sync attempt
      }
    }
  } finally {
    syncing = false;
  }

  return synced;
}
