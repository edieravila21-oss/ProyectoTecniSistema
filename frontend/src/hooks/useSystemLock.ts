import { useEffect, useState } from 'react';
import api from '@/api/client';

const POLL_MS = 20000;

// Consulta el backend periódicamente para saber si el sistema está bloqueado
// (interruptor manual en backend/src/config/systemLock.js). Así el bloqueo se
// activa solo en cualquier pestaña abierta, sin depender de que el usuario
// refresque ni de la caché del service worker.
export const useSystemLock = () => {
  const [bloqueado, setBloqueado] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      try {
        const { data } = await api.get('/system/status');
        if (!cancelled) setBloqueado(!!data?.data?.bloqueado);
      } catch {
        // Sin respuesta del servidor: no cambiamos el estado del bloqueo.
      }
    };

    check();
    const id = setInterval(check, POLL_MS);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  return bloqueado;
};
