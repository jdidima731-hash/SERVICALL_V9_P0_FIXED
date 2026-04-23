/**
 * Cache Service — Gestion centralisée du cache Redis
 * ✅ FIX P4.1: Réduction latence requêtes lourdes
 * 
 * Stratégie :
 * - Prospects : 5 min TTL
 * - Appels : 10 min TTL
 * - Rapports : 30 min TTL
 * - Invalidation automatique sur modifications
 */

import { Redis } from "ioredis";
import { logger } from "../logger";

export class CacheService {
  private redis: Redis;
  private readonly DEFAULT_TTL = 300; // 5 minutes
  private readonly CACHE_STATS = new Map<string, { hits: number; misses: number }>();

  constructor(redis: Redis) {
    this.redis = redis;
  }

  /**
   * ✅ FIX P4.1: Récupérer ou calculer une valeur en cache
   */
  async getOrCompute<T>(
    key: string,
    compute: () => Promise<T>,
    ttl: number = this.DEFAULT_TTL
  ): Promise<T> {
    try {
      // 1. Essayer de récupérer du cache
      const cached = await this.redis.get(key);
      if (cached) {
        this.recordHit(key);
        logger.debug("[CacheService] Cache hit", { key });
        return JSON.parse(cached);
      }

      // 2. Calculer la valeur
      this.recordMiss(key);
      logger.debug("[CacheService] Cache miss, computing", { key });
      const value = await compute();

      // 3. Stocker en cache
      await this.redis.setex(key, ttl, JSON.stringify(value));

      return value;
    } catch (error: any) {
      logger.warn("[CacheService] Cache error, computing without cache", {
        key,
        error: error.message,
      });
      // Fallback : calculer sans cache
      return await compute();
    }
  }

  /**
   * ✅ FIX P4.1: Récupérer une valeur du cache (sans calcul)
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const cached = await this.redis.get(key);
      if (cached) {
        this.recordHit(key);
        return JSON.parse(cached);
      }
      this.recordMiss(key);
      return null;
    } catch (error: any) {
      logger.warn("[CacheService] Get error", { key, error: error.message });
      return null;
    }
  }

  /**
   * ✅ FIX P4.1: Stocker une valeur en cache
   */
  async set<T>(key: string, value: T, ttl: number = this.DEFAULT_TTL): Promise<void> {
    try {
      await this.redis.setex(key, ttl, JSON.stringify(value));
      logger.debug("[CacheService] Value cached", { key, ttl });
    } catch (error: any) {
      logger.warn("[CacheService] Set error", { key, error: error.message });
    }
  }

  /**
   * ✅ FIX P4.1: Invalider un pattern de cache
   */
  async invalidate(pattern: string): Promise<number> {
    try {
      const keys = await this.redis.keys(pattern);
      if (keys.length > 0) {
        await this.redis.del(...keys);
        logger.debug("[CacheService] Cache invalidated", { pattern, count: keys.length });
        return keys.length;
      }
      return 0;
    } catch (error: any) {
      logger.warn("[CacheService] Invalidation error", { pattern, error: error.message });
      return 0;
    }
  }

  /**
   * ✅ FIX P4.1: Vider tout le cache (attention!)
   */
  async flush(): Promise<void> {
    try {
      await this.redis.flushdb();
      logger.info("[CacheService] Cache flushed");
    } catch (error: any) {
      logger.error("[CacheService] Flush error", { error: error.message });
    }
  }

  /**
   * ✅ FIX P4.1: Obtenir les statistiques du cache
   */
  getStats(): Record<string, { hits: number; misses: number; ratio: number }> {
    const stats: Record<string, any> = {};

    for (const [key, value] of this.CACHE_STATS.entries()) {
      const total = value.hits + value.misses;
      stats[key] = {
        ...value,
        ratio: total > 0 ? (value.hits / total * 100).toFixed(2) + "%" : "N/A",
      };
    }

    return stats;
  }

  /**
   * ✅ FIX P4.1: Réinitialiser les statistiques
   */
  resetStats(): void {
    this.CACHE_STATS.clear();
    logger.debug("[CacheService] Stats reset");
  }

  /**
   * Enregistrer un hit de cache
   */
  private recordHit(key: string): void {
    const prefix = key.split(":")[0];
    const stats = this.CACHE_STATS.get(prefix) || { hits: 0, misses: 0 };
    stats.hits++;
    this.CACHE_STATS.set(prefix, stats);
  }

  /**
   * Enregistrer un miss de cache
   */
  private recordMiss(key: string): void {
    const prefix = key.split(":")[0];
    const stats = this.CACHE_STATS.get(prefix) || { hits: 0, misses: 0 };
    stats.misses++;
    this.CACHE_STATS.set(prefix, stats);
  }
}

// ✅ FIX P4.1: Instance singleton
let cacheServiceInstance: CacheService | null = null;

export function initCacheService(redis: any): CacheService {
  cacheServiceInstance = new CacheService(redis);
  return cacheServiceInstance;
}

export function getCacheService(): CacheService {
  if (!cacheServiceInstance) {
    throw new Error("CacheService not initialized. Call initCacheService first.");
  }
  return cacheServiceInstance;
}
