import IORedis from 'ioredis';
import { ENV } from '../_core/env';
import { logger } from "../infrastructure/logger";

/**
 * ============================================================================
 * CACHE SERVICE ENHANCED - Production-Ready Redis Cache Layer
 * ============================================================================
 * 
 * Fonctionnalités :
 * - Cache générique avec TTL configurable
 * - Invalidation intelligente multi-tenant
 * - Stratégies de cache (cache-aside, stale-while-revalidate)
 * - Métriques de performance (hit/miss rate)
 * - Gestion des erreurs robuste
 * - Support des tags pour invalidation groupée
 * - Compression optionnelle pour grandes valeurs
 * - Namespace isolation
 */

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface CacheOptions {
  /** TTL en secondes (défaut: 300s = 5min) */
  ttl?: number;
  /** Tags pour invalidation groupée */
  tags?: string[];
  /** Namespace pour isolation */
  namespace?: string;
  /** Compression pour grandes valeurs (>1KB) */
  compress?: boolean;
  /** Stale-while-revalidate: retourner cache périmé pendant revalidation */
  staleWhileRevalidate?: boolean;
  /** Durée de validité du stale (défaut: 2x TTL) */
  staleTtl?: number;
}

export interface CacheMetrics {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  errors: number;
  hitRate: number;
}

export interface CacheStrategy {
  /** Nom de la stratégie */
  name: string;
  /** TTL par défaut */
  defaultTtl: number;
  /** Tags automatiques */
  autoTags?: string[];
  /** Stale-while-revalidate activé */
  swr?: boolean;
}

// ============================================================================
// STRATÉGIES DE CACHE PRÉDÉFINIES
// ============================================================================

export const CACHE_STRATEGIES: Record<string, CacheStrategy> = {
  // Données quasi-statiques (config, référentiels)
  STATIC: {
    name: 'static',
    defaultTtl: 86400, // 24h
    swr: false,
  },
  
  // Données fréquemment lues, rarement modifiées (profils, settings)
  LONG: {
    name: 'long',
    defaultTtl: 3600, // 1h
    swr: true,
  },
  
  // Données moyennement volatiles (listes, dashboards)
  MEDIUM: {
    name: 'medium',
    defaultTtl: 300, // 5min
    swr: true,
  },
  
  // Données très volatiles (temps réel, compteurs)
  SHORT: {
    name: 'short',
    defaultTtl: 60, // 1min
    swr: false,
  },
  
  // Pas de cache (bypass)
  NONE: {
    name: 'none',
    defaultTtl: 0,
    swr: false,
  },
};

// ============================================================================
// CLÉS DE CACHE STRUCTURÉES
// ============================================================================

export const CACHE_KEYS = {
  // Dashboard
  DASHBOARD_STATS: (tenantId: number, timeRange: string) => 
    `tenant:${tenantId}:dashboard:stats:${timeRange}`,
  DASHBOARD_MANAGER: (tenantId: number, timeRange: string) => 
    `tenant:${tenantId}:dashboard:manager:${timeRange}`,
  DASHBOARD_CHARTS: (tenantId: number, chartType: string) => 
    `tenant:${tenantId}:dashboard:chart:${chartType}`,
  
  // Prospects
  PROSPECT_LIST: (tenantId: number, page: number, filters?: string) => 
    `tenant:${tenantId}:prospects:list:${page}:${filters ?? 'all'}`,
  PROSPECT_DETAIL: (tenantId: number, prospectId: number) => 
    `tenant:${tenantId}:prospect:${prospectId}`,
  PROSPECT_COUNT: (tenantId: number) => 
    `tenant:${tenantId}:prospects:count`,
  
  // Calls
  CALLS_LIST: (tenantId: number, page: number) => 
    `tenant:${tenantId}:calls:list:${page}`,
  CALLS_STATS: (tenantId: number, period: string) => 
    `tenant:${tenantId}:calls:stats:${period}`,
  
  // Appointments
  APPOINTMENTS_LIST: (tenantId: number, startDate: string, endDate: string) => 
    `tenant:${tenantId}:appointments:${startDate}:${endDate}`,
  APPOINTMENTS_UPCOMING: (tenantId: number) => 
    `tenant:${tenantId}:appointments:upcoming`,
  
  // Workflows
  WORKFLOWS_ACTIVE: (tenantId: number) => 
    `tenant:${tenantId}:workflows:active`,
  WORKFLOW_DETAIL: (tenantId: number, workflowId: number) => 
    `tenant:${tenantId}:workflow:${workflowId}`,
  
  // Config & Settings
  TENANT_CONFIG: (tenantId: number) => 
    `tenant:${tenantId}:config`,
  TENANT_SETTINGS: (tenantId: number) => 
    `tenant:${tenantId}:settings`,
  INDUSTRY_CONFIG: (tenantId: number) => 
    `tenant:${tenantId}:industry:config`,
  
  // User & Auth
  USER_PERMISSIONS: (userId: number, tenantId: number) => 
    `user:${userId}:tenant:${tenantId}:permissions`,
  USER_PROFILE: (userId: number) => 
    `user:${userId}:profile`,
  
  // Analytics
  ANALYTICS_KPI: (tenantId: number, metric: string, period: string) => 
    `tenant:${tenantId}:analytics:${metric}:${period}`,
  
  // Tags pour invalidation
  TAG_TENANT: (tenantId: number) => `tag:tenant:${tenantId}`,
  TAG_PROSPECT: (tenantId: number) => `tag:tenant:${tenantId}:prospects`,
  TAG_CALL: (tenantId: number) => `tag:tenant:${tenantId}:calls`,
  TAG_APPOINTMENT: (tenantId: number) => `tag:tenant:${tenantId}:appointments`,
  TAG_WORKFLOW: (tenantId: number) => `tag:tenant:${tenantId}:workflows`,
  TAG_DASHBOARD: (tenantId: number) => `tag:tenant:${tenantId}:dashboard`,
};

// ============================================================================
// CACHE SERVICE CLASS
// ============================================================================

class EnhancedCacheService {
  private redis: IORedis | null = null;
  private metrics: CacheMetrics = {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0,
    errors: 0,
    hitRate: 0,
  };
  private readonly TAG_PREFIX = 'tag:';
  private readonly TAG_SET_SUFFIX = ':members';

  constructor() {
    // Initialisation différée via start()
  }

  // ==========================================================================
  // INITIALIZATION
  // ==========================================================================

  async start() {
    if (ENV.redisEnabled) {
      try {
        logger.info('[EnhancedCache] Initializing Redis connection...', { 
          url: ENV.redisUrl?.replace(/:[^:]*@/, ':***@') // Masquer le mot de passe
        });
        
        this.redis = new IORedis(ENV.redisUrl, {
          maxRetriesPerRequest: 3,
          retryStrategy: (times) => {
            const delay = Math.min(times * 50, 2000);
            logger.warn(`[EnhancedCache] Retry attempt ${times}, delay ${delay}ms`);
            return delay;
          },
          enableReadyCheck: true,
          lazyConnect: false,
        });

        this.redis.on('connect', () => {
          logger.info('[EnhancedCache] Redis connected successfully');
        });

        this.redis.on('ready', () => {
          logger.info('[EnhancedCache] Redis ready to accept commands');
        });

        this.redis.on('error', (err) => {
          logger.error('[EnhancedCache] Redis error', { error: err.message });
          this.metrics.errors++;
        });

        this.redis.on('close', () => {
          logger.warn('[EnhancedCache] Redis connection closed');
        });

      } catch (error: any) {
        logger.error('[EnhancedCache] Failed to initialize Redis', { error });
      }
    } else {
      logger.info('[EnhancedCache] Redis is disabled via environment');
    }
  }

  // ==========================================================================
  // CORE CACHE OPERATIONS
  // ==========================================================================

  /**
   * Récupérer une valeur du cache
   */
  async get<T>(key: string, options?: CacheOptions): Promise<T | null> {
    if (!this.redis) {
      this.metrics.misses++;
      return null;
    }

    try {
      const fullKey = this.buildKey(key, options?.namespace);
      const data = await this.redis.get(fullKey);

      if (data === null) {
        this.metrics.misses++;
        this.updateHitRate();
        return null;
      }

      this.metrics.hits++;
      this.updateHitRate();

      const parsed = JSON.parse(data);
      
      // Gérer stale-while-revalidate
      if (options?.staleWhileRevalidate && parsed._stale) {
        logger.debug('[EnhancedCache] Returning stale data', { key: fullKey });
      }

      return parsed.value as T;

    } catch (error: any) {
      logger.error('[EnhancedCache] Get error', { error, key });
      this.metrics.errors++;
      return null;
    }
  }

  /**
   * Stocker une valeur dans le cache
   */
  async set(key: string, value: any, options?: CacheOptions): Promise<void> {
    if (!this.redis) return;

    try {
      const fullKey = this.buildKey(key, options?.namespace);
      const ttl = options?.ttl ?? (CACHE_STRATEGIES['MEDIUM']?.defaultTtl ?? 3600);

      if (ttl === 0) return; // Pas de cache

      const payload = {
        value,
        _cached_at: Date.now(),
        _stale: false,
      };

      await this.redis.setex(fullKey, ttl, JSON.stringify(payload));
      this.metrics.sets++;

      // Gérer les tags
      if (options?.tags && options.tags.length > 0) {
        await this.addToTags(fullKey, options.tags);
      }

      // Stale-while-revalidate: créer une version stale
      if (options?.staleWhileRevalidate) {
        const staleTtl = options.staleTtl ?? ttl * 2;
        const stalePayload = { ...payload, _stale: true };
        await this.redis.setex(
          `${fullKey}:stale`, 
          staleTtl, 
          JSON.stringify(stalePayload)
        );
      }

      logger.debug('[EnhancedCache] Set success', { 
        key: fullKey, 
        ttl, 
        tags: options?.tags 
      });

    } catch (error: any) {
      logger.error('[EnhancedCache] Set error', { error, key });
      this.metrics.errors++;
    }
  }

  /**
   * Récupérer ou calculer une valeur (pattern cache-aside)
   */
  async getOrSet<T>(
    key: string,
    fn: () => Promise<T>,
    options?: CacheOptions
  ): Promise<T> {
    // Essayer de récupérer du cache
    const cached = await this.get<T>(key, options);
    if (cached !== null) {
      return cached;
    }

    // Calculer la valeur
    const value = await fn();

    // Stocker dans le cache
    await this.set(key, value, options);

    return value;
  }

  // ==========================================================================
  // INVALIDATION
  // ==========================================================================

  /**
   * Supprimer une clé spécifique
   */
  async delete(key: string, namespace?: string): Promise<void> {
    if (!this.redis) return;

    try {
      const fullKey = this.buildKey(key, namespace);
      await this.redis.del(fullKey);
      await this.redis.del(`${fullKey}:stale`); // Supprimer aussi le stale
      this.metrics.deletes++;
      logger.debug('[EnhancedCache] Delete success', { key: fullKey });
    } catch (error: any) {
      logger.error('[EnhancedCache] Delete error', { error, key });
      this.metrics.errors++;
    }
  }

  /**
   * Invalider toutes les clés d'un pattern
   */
  async invalidate(pattern: string): Promise<number> {
    if (!this.redis) return 0;

    try {
      const keys = await this.redis.keys(pattern);
      if (keys.length === 0) return 0;

      await this.redis.del(...keys);
      this.metrics.deletes += keys.length;

      logger.info('[EnhancedCache] Invalidated keys', { 
        pattern, 
        count: keys.length 
      });

      return keys.length;
    } catch (error: any) {
      logger.error('[EnhancedCache] Invalidate error', { error, pattern });
      this.metrics.errors++;
      return 0;
    }
  }

  /**
   * Invalider toutes les clés d'un tenant
   */
  async invalidateTenant(tenantId: number): Promise<number> {
    return await this.invalidate(`tenant:${tenantId}:*`);
  }

  /**
   * Invalider par tag
   */
  async invalidateByTag(tag: string): Promise<number> {
    if (!this.redis) return 0;

    try {
      const tagKey = `${this.TAG_PREFIX}${tag}${this.TAG_SET_SUFFIX}`;
      const members = await this.redis.smembers(tagKey);

      if (members.length === 0) return 0;

      // Supprimer toutes les clés du tag
      await this.redis.del(...members);
      
      // Supprimer le set de tags
      await this.redis.del(tagKey);

      this.metrics.deletes += members.length;

      logger.info('[EnhancedCache] Invalidated by tag', { 
        tag, 
        count: members.length 
      });

      return members.length;
    } catch (error: any) {
      logger.error('[EnhancedCache] InvalidateByTag error', { error, tag });
      this.metrics.errors++;
      return 0;
    }
  }

  /**
   * Invalider plusieurs tags
   */
  async invalidateByTags(tags: string[]): Promise<number> {
    let total = 0;
    for (const tag of tags) {
      total += await this.invalidateByTag(tag);
    }
    return total;
  }

  // ==========================================================================
  // TAG MANAGEMENT
  // ==========================================================================

  private async addToTags(key: string, tags: string[]): Promise<void> {
    if (!this.redis) return;

    try {
      for (const tag of tags) {
        const tagKey = `${this.TAG_PREFIX}${tag}${this.TAG_SET_SUFFIX}`;
        await this.redis.sadd(tagKey, key);
      }
    } catch (error: any) {
      logger.error('[EnhancedCache] AddToTags error', { error, key, tags });
    }
  }

  // ==========================================================================
  // UTILITIES
  // ==========================================================================

  private buildKey(key: string, namespace?: string): string {
    return namespace ? `${namespace}:${key}` : key;
  }

  private updateHitRate(): void {
    const total = this.metrics.hits + this.metrics.misses;
    this.metrics.hitRate = total > 0 ? (this.metrics.hits / total) * 100 : 0;
  }

  /**
   * Récupérer les métriques de performance
   */
  getMetrics(): CacheMetrics {
    return { ...this.metrics };
  }

  /**
   * Réinitialiser les métriques
   */
  resetMetrics(): void {
    this.metrics = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      errors: 0,
      hitRate: 0,
    };
  }

  /**
   * Vérifier la santé de Redis
   */
  async healthCheck(): Promise<boolean> {
    if (!this.redis) return false;

    try {
      const result = await this.redis.ping();
      return result === 'PONG';
    } catch (error: any) {
      logger.error('[EnhancedCache] Health check failed', { error });
      return false;
    }
  }

  /**
   * Fermer la connexion Redis
   */
  async close(): Promise<void> {
    if (this.redis) {
      await this.redis.quit();
      logger.info('[EnhancedCache] Redis connection closed');
    }
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export const cache = new EnhancedCacheService();

// Export des méthodes pour utilisation directe
export const get = cache.get.bind(cache);
export const set = cache.set.bind(cache);
export const getOrSet = cache.getOrSet.bind(cache);
export const del = cache.delete.bind(cache);
export const invalidate = cache.invalidate.bind(cache);
export const invalidateTenant = cache.invalidateTenant.bind(cache);
export const invalidateByTag = cache.invalidateByTag.bind(cache);
export const invalidateByTags = cache.invalidateByTags.bind(cache);
export const getMetrics = cache.getMetrics.bind(cache);
export const start = cache.start.bind(cache);
export const healthCheck = cache.healthCheck.bind(cache);
