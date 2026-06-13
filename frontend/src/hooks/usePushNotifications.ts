import { useEffect, useRef } from 'react';
import api from '@/api/client';

const SW_URL = '/sw.js';

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

export function usePushNotifications(enabled: boolean) {
  const attemptedRef = useRef(false);

  useEffect(() => {
    if (!enabled || attemptedRef.current) return;
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

    attemptedRef.current = true;

    const setup = async () => {
      try {
        // 1. Obtener la clave pública VAPID del servidor
        const { data: keyRes } = await api.get<{ success: boolean; data: { publicKey: string } }>('/push/vapid-public-key');
        const publicKey = keyRes.data.publicKey;
        if (!publicKey) return;

        // 2. Registrar el service worker
        const registration = await navigator.serviceWorker.register(SW_URL, { scope: '/' });
        await navigator.serviceWorker.ready;

        // 3. Pedir permiso de notificaciones
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') return;

        // 4. Suscribirse al push
        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        });

        // 5. Enviar suscripción al backend
        await api.post('/push/subscribe', subscription.toJSON());
      } catch (err) {
        console.warn('[Push] No se pudo suscribir:', err);
      }
    };

    setup();
  }, [enabled]);
}
