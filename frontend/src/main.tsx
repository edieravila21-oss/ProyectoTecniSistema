import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {});

  // A page load is still served by whichever SW was already controlling it —
  // a freshly-installed SW only takes over starting with the *next* navigation.
  // Reload once when that handoff happens so a new deploy (e.g. the kill-switch
  // flag) takes effect on the very next visit instead of needing two refreshes.
  let reloadedForNewWorker = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloadedForNewWorker) return;
    reloadedForNewWorker = true;
    window.location.reload();
  });
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
