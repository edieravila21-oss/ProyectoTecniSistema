import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
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
  const navigate = useNavigate();

  // Escucha mensajes del service worker para navegar al tocar una notificación
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const handler = (event: MessageEvent) => {
      if (event.data?.type === 'NAVIGATE' && event.data.url) {
        navigate(event.data.url);
      }
    };
    navigator.serviceWorker.addEventListener('message', handler);
    return () => navigator.serviceWorker.removeEventListener('message', handler);
  }, [navigate]);

  // Suscripción al push (solo una vez por sesión)
  useEffect(() => {
    if (!enabled || attemptedRef.current) return;
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    attemptedRef.current = true;

    const setup = async () => {
      try {
        const { data: keyRes } = await api.get<{ success: boolean; data: { publicKey: string } }>('/push/vapid-public-key');
        const publicKey = keyRes.data.publicKey;
        if (!publicKey) return;

        const registration = await navigator.serviceWorker.register(SW_URL, { scope: '/' });
        await navigator.serviceWorker.ready;

        const permission = await Notification.requestPermission();
        if (permission !== 'granted') return;

        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        });

        await api.post('/push/subscribe', subscription.toJSON());
      } catch (err) {
        console.warn('[Push] No se pudo suscribir:', err);
      }
    };

    setup();
  }, [enabled]);
}

// Actualiza el badge del ícono de la app con el número de items pendientes
export function actualizarBadge(count: number) {
  if ('setAppBadge' in navigator) {
    if (count > 0) {
      (navigator as Navigator & { setAppBadge: (n: number) => Promise<void> })
        .setAppBadge(count).catch(() => {});
    } else {
      (navigator as Navigator & { clearAppBadge: () => Promise<void> })
        .clearAppBadge?.().catch(() => {});
    }
  }
}
