import { create } from 'zustand';
import type { Usuario } from '@/types';

interface AuthState {
  usuario: Usuario | null;
  token: string | null;
  login: (token: string, usuario: Usuario) => void;
  logout: () => void;
  setUsuario: (usuario: Usuario) => void;
}

const storedToken = localStorage.getItem('token');
const storedUsuario = (() => {
  try {
    const raw = localStorage.getItem('usuario');
    return raw ? JSON.parse(raw) as Usuario : null;
  } catch {
    return null;
  }
})();

export const useAuthStore = create<AuthState>((set) => ({
  usuario: storedToken && storedUsuario ? storedUsuario : null,
  token: storedToken ?? null,
  login: (token, usuario) => {
    localStorage.setItem('token', token);
    localStorage.setItem('usuario', JSON.stringify(usuario));
    set({ token, usuario });
  },
  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('usuario');
    set({ token: null, usuario: null });
  },
  setUsuario: (usuario) => {
    localStorage.setItem('usuario', JSON.stringify(usuario));
    set({ usuario });
  },
}));
