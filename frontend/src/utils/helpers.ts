import { format, formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

export const formatCurrency = (amount: number): string =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(amount);

// Forzar mediodía local para evitar que "2026-06-17T00:00:00Z" → UTC-5 = "16 jun"
const toLocalNoon = (date: string | Date): Date => {
  const s = String(date).substring(0, 10); // "YYYY-MM-DD" en UTC
  return new Date(s + 'T12:00:00');         // mediodía local → sin desfase
};

export const formatDate = (date: string | Date): string =>
  format(toLocalNoon(date), 'dd/MM/yyyy', { locale: es });

export const formatDateTime = (date: string | Date): string =>
  format(new Date(date), "dd/MM/yyyy hh:mm a", { locale: es });

export const formatTime = (date: string | Date): string =>
  format(new Date(date), "hh:mm a", { locale: es });

export const formatRelative = (date: string | Date): string =>
  formatDistanceToNow(new Date(date), { addSuffix: true, locale: es });

export const estadoConfig: Record<string, { label: string; color: string; bg: string }> = {
  pendiente: { label: 'Pendiente', color: 'text-gray-700', bg: 'bg-gray-100' },
  asignado: { label: 'Asignado', color: 'text-blue-700', bg: 'bg-blue-100' },
  en_camino: { label: 'En camino', color: 'text-yellow-700', bg: 'bg-yellow-100' },
  en_servicio: { label: 'En servicio', color: 'text-orange-700', bg: 'bg-orange-100' },
  completado: { label: 'Completado', color: 'text-green-700', bg: 'bg-green-100' },
  cancelado: { label: 'Cancelado', color: 'text-red-700', bg: 'bg-red-100' },
};

export const tipoEquipoLabel: Record<string, string> = {
  aire_acondicionado: 'Aire Acondicionado',
  nevera: 'Nevera',
  otro: 'Otro',
};

export const especialidadLabel: Record<string, string> = {
  aires: 'Aires',
  neveras: 'Neveras',
  ambos: 'Ambos',
};

export const cn = (...classes: (string | undefined | false)[]) =>
  classes.filter(Boolean).join(' ');
