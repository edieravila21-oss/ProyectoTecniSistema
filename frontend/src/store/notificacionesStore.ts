import { create } from 'zustand';
import type { Notificacion } from '@/types';

interface NotificacionesState {
  notificaciones: Notificacion[];
  mensajesNuevos: number;
  agregarNotificacion: (n: Omit<Notificacion, 'id' | 'leida' | 'createdAt'>) => void;
  marcarLeida: (id: string) => void;
  marcarTodasLeidas: () => void;
  incrementarMensajes: () => void;
  resetMensajes: () => void;
}

export const useNotificacionesStore = create<NotificacionesState>((set) => ({
  notificaciones: [],
  mensajesNuevos: 0,
  agregarNotificacion: (n) =>
    set((state) => ({
      notificaciones: [
        { ...n, id: crypto.randomUUID(), leida: false, createdAt: new Date().toISOString() },
        ...state.notificaciones,
      ].slice(0, 50),
    })),
  marcarLeida: (id) =>
    set((state) => ({
      notificaciones: state.notificaciones.map((n) => (n.id === id ? { ...n, leida: true } : n)),
    })),
  marcarTodasLeidas: () =>
    set((state) => ({
      notificaciones: state.notificaciones.map((n) => ({ ...n, leida: true })),
    })),
  incrementarMensajes: () => set((state) => ({ mensajesNuevos: state.mensajesNuevos + 1 })),
  resetMensajes: () => set({ mensajesNuevos: 0 }),
}));
