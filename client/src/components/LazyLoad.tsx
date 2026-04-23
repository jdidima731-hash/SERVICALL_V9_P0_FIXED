import React, { lazy, ComponentType, LazyExoticComponent } from 'react';

/**
 * Wrapper de lazy loading avec retry automatique en cas d'échec
 * Utile pour gérer les erreurs de chargement de chunks (ex: déploiement en cours)
 */
export function lazyWithRetry<T extends ComponentType<any>>(
  componentImport: () => Promise<{ default: T }>,
  retries = 3,
  interval = 1000
): LazyExoticComponent<T> {
  return lazy(() => {
    return new Promise<{ default: T }>((resolve, reject) => {
      const attemptLoad = (attemptsLeft: number) => {
        componentImport()
          .then(resolve)
          .catch((error) => {
            if (attemptsLeft === 1) {
              reject(error);
              return;
            }
            
            console.warn(
              `Failed to load component, retrying... (${retries - attemptsLeft + 1}/${retries})`,
              error
            );
            
            setTimeout(() => {
              attemptLoad(attemptsLeft - 1);
            }, interval);
          });
      };
      
      attemptLoad(retries);
    });
  });
}

/**
 * Préchargement d'un composant lazy
 * Permet de charger un composant avant qu'il ne soit affiché (ex: au survol d'un lien)
 */
export function preloadComponent<T extends ComponentType<any>>(
  componentImport: () => Promise<{ default: T }>
): void {
  componentImport().catch((error) => {
    console.error('Failed to preload component:', error);
  });
}

/**
 * Hook pour précharger un composant au survol
 */
export function usePreload<T extends ComponentType<any>>(
  componentImport: () => Promise<{ default: T }>
) {
  const handleMouseEnter = React.useCallback(() => {
    preloadComponent(componentImport);
  }, [componentImport]);
  
  return { onMouseEnter: handleMouseEnter };
}
