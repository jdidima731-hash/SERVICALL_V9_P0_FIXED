// PWAManager - Stub pour la production (PWA optionnel)
import { useEffect } from 'react';

export function PWAManager() {
  useEffect(() => {
    // PWA service worker registration (optionnel en production)
    if ('serviceWorker' in navigator && import.meta.env.PROD) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').catch(() => {
          // Service worker non disponible, continuer sans PWA
        });
      });
    }
  }, []);

  return null;
}

export default PWAManager;
