import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {});
}

// On startup: sync any queued offline actions, then clean stale cache.
// Delayed 3 s so it doesn't compete with the initial render.
setTimeout(() => {
  if (navigator.onLine) {
    import('./lib/syncManager').then(({ processSyncQueue }) => {
      processSyncQueue().catch(() => {});
    });
  }
  import('./lib/cacheCleanup').then(({ runCacheCleanup }) => {
    runCacheCleanup().catch(() => {});
  });
}, 3000);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
