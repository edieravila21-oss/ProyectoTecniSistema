import { create } from 'zustand';
import { io, Socket } from 'socket.io-client';

interface SocketState {
  socket: Socket | null;
  conectado: boolean;
  whatsappConectado: boolean;
  inicializar: () => void;
  destruir: () => void;
  setWhatsappConectado: (conectado: boolean) => void;
}

export const useSocketStore = create<SocketState>((set, get) => ({
  socket: null,
  conectado: false,
  whatsappConectado: false,
  inicializar: () => {
    if (get().socket) return;
    const socketUrl = import.meta.env.VITE_SOCKET_URL || window.location.origin;
    const newSocket = io(socketUrl, { transports: ['polling', 'websocket'], reconnection: true, reconnectionAttempts: 10, reconnectionDelay: 2000 });

    newSocket.on('connect', () => {
      set({ conectado: true });
      newSocket.emit('admin_conectado');
    });
    newSocket.on('disconnect', () => set({ conectado: false }));
    newSocket.on('whatsapp_estado', (data: { conectado: boolean }) => {
      set({ whatsappConectado: data.conectado });
    });

    set({ socket: newSocket });
  },
  destruir: () => {
    get().socket?.disconnect();
    set({ socket: null, conectado: false });
  },
  setWhatsappConectado: (conectado) => set({ whatsappConectado: conectado }),
}));
