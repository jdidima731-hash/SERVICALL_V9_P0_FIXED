/**
 * Cache Service — Point d'entrée unifié
 *
 * Proxy vers cacheService.enhanced (implémentation Redis complète).
 * Tous les imports existants fonctionnent sans modification grâce aux aliases.
 *
 * Aliases de compatibilité ascendante :
 *   deleteCache         → del
 *   CACHE_KEYS.ACTIVE_WORKFLOWS → WORKFLOWS_ACTIVE  (même clé Redis)
 *   CACHE_KEYS.DASHBOARD(id, range) → dashboard:${id}:${range}
 *   CACHE_TTL           → constantes locales
 */

export {
  cache,
  get,
  set,
  getOrSet,
  invalidate,
  invalidateTenant,
  invalidateByTag,
  invalidateByTags,
  getMetrics,
  healthCheck,
  CACHE_STRATEGIES,
} from "./cacheService.enhanced";

export type { CacheOptions, CacheMetrics, CacheStrategy } from "./cacheService.enhanced";

// deleteCache → alias de del
export { del as deleteCache } from "./cacheService.enhanced";

// CACHE_TTL : non présent dans enhanced, conservé ici pour compatibilité
export const CACHE_TTL = {
  WORKFLOWS: 3600,
  DASHBOARD: 300,
  CONFIG: 86400,
};

// CACHE_KEYS : enhanced + aliases pour les anciens importeurs
import { CACHE_KEYS as EK } from "./cacheService.enhanced";

export const CACHE_KEYS = {
  ...EK,
  /** @compat workflowService utilisait ACTIVE_WORKFLOWS */
  ACTIVE_WORKFLOWS: EK.WORKFLOWS_ACTIVE,
  /** @compat dashboardRouter utilisait DASHBOARD(tenantId, timeRange) */
  DASHBOARD: (tenantId: number, timeRange: string) =>
    `tenant:${tenantId}:dashboard:${timeRange}`,
};
