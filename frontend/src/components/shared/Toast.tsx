import { create } from 'zustand';
import { useEffect } from 'react';
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react';

interface Toast {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}

interface ToastState {
  toasts: Toast[];
  addToast: (type: Toast['type'], message: string) => void;
  removeToast: (id: string) => void;
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  addToast: (type, message) => {
    const id = crypto.randomUUID();
    set((s) => ({ toasts: [...s.toasts, { id, type, message }] }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 4000);
  },
  removeToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

export const toast = {
  success: (msg: string) => useToastStore.getState().addToast('success', msg),
  error: (msg: string) => useToastStore.getState().addToast('error', msg),
  info: (msg: string) => useToastStore.getState().addToast('info', msg),
};

const icons = { success: CheckCircle, error: AlertCircle, info: Info };
const colors = {
  success: 'bg-green-50 border-green-200 text-green-800',
  error: 'bg-red-50 border-red-200 text-red-800',
  info: 'bg-blue-50 border-blue-200 text-blue-800',
};

export const ToastContainer = () => {
  const { toasts, removeToast } = useToastStore();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
      {toasts.map((t) => {
        const Icon = icons[t.type];
        return (
          <div key={t.id} className={`flex items-center gap-2 p-3 rounded-lg border shadow-lg animate-in slide-in-from-top ${colors[t.type]}`}>
            <Icon className="h-4 w-4 shrink-0" />
            <span className="text-sm flex-1">{t.message}</span>
            <button onClick={() => removeToast(t.id)} className="shrink-0"><X className="h-4 w-4" /></button>
          </div>
        );
      })}
    </div>
  );
};
