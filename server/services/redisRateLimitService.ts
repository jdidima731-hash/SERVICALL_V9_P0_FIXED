/**
 * Redis Rate Limit Service
 * Implémentation scalable du rate limiting avec Redis
 */

import { logger } from "../infrastructure/logger";
import { getRedisClient } from "../infrastructure/redis/redis.client";

/**
 * Helper pour obtenir le client Redis de manière sécurisée
 */
function getClient() {
  try {
    return getRedisClient();
  } catch (error: any) {
    return null;
  }
}

/**
 * Vérifier le rate limit avec Redis
 */
export async function checkRedisRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): Promise<{ allowed: boolean; remaining: number; resetAt: number; retryAfter?: number }> {
  const redis = getClient();
  if (!redis) {
    return { allowed: true, remaining: maxRequests, resetAt: Date.now() + windowMs };
  }

  try {
    const now = Date.now();
    const redisKey = `ratelimit:${key}`;
    const multi = redis.multi();
    multi.incr(redisKey);
    multi.ttl(redisKey);
    
    const results = await multi.exec();
    if (!results) throw new Error("Redis transaction failed");

    const [[err1, count], [err2, ttl]] = results as [[Error | null, number], [Error | null, number]];
    if (err1 || err2) throw new Error("Redis command failed");

    if (count === 1) await redis.pexpire(redisKey, windowMs);

    const resetAt = ttl > 0 ? now + (ttl * 1000) : now + windowMs;
    const remaining = Math.max(0, maxRequests - count);

    if (count > maxRequests) {
      const retryAfter = Math.ceil((resetAt - now) / 1000);
      logger.warn("[RedisRateLimit] Rate limit exceeded", { key, count, maxRequests, retryAfter });
      return { allowed: false, remaining: 0, resetAt, retryAfter };
    }

    return { allowed: true, remaining, resetAt };
  } catch (error: any) {
    logger.error("[RedisRateLimit] Error checking rate limit", { error, key });
    return { allowed: true, remaining: maxRequests, resetAt: Date.now() + windowMs };
  }
}

/**
 * Réinitialiser le rate limit pour une clé
 */
export async function resetRateLimit(key: string): Promise<void> {
  const redis = getClient();
  if (!redis) return;
  try {
    await redis.del(`ratelimit:${key}`);
    logger.info("[RedisRateLimit] Rate limit reset", { key });
  } catch (error: any) {
    logger.error("[RedisRateLimit] Error resetting rate limit", { error, key });
  }
}

/**
 * Obtenir le statut actuel du rate limit
 */
export async function getRateLimitStatus(
  key: string,
  maxRequests: number,
  windowMs: number
): Promise<{ count: number; remaining: number; resetAt: number }> {
  const redis = getClient();
  if (!redis) return { count: 0, remaining: maxRequests, resetAt: Date.now() + windowMs };

  try {
    const redisKey = `ratelimit:${key}`;
    const now = Date.now();
    const multi = redis.multi();
    multi.get(redisKey);
    multi.ttl(redisKey);

    const results = await multi.exec();
    if (!results) return { count: 0, remaining: maxRequests, resetAt: now + windowMs };

    const [[err1, countStr], [err2, ttl]] = results as [[Error | null, string | null], [Error | null, number]];
    if (err1 || err2) throw new Error("Redis command failed");

    const count = countStr ? parseInt(countStr, 10) : 0;
    const remaining = Math.max(0, maxRequests - count);
    const resetAt = ttl > 0 ? now + (ttl * 1000) : now + windowMs;

    return { count, remaining, resetAt };
  } catch (error: any) {
    logger.error("[RedisRateLimit] Error getting rate limit status", { error, key });
    return { count: 0, remaining: maxRequests, resetAt: Date.now() + windowMs };
  }
}

/**
 * Middleware de rate limiting pour tRPC avec Redis
 */
export function createRedisRateLimitMiddleware(
  maxRequests: number = 100,
  windowMs: number = 60000
) {
  return async (opts: any) => {
    const { ctx, next } = opts;
    const identifier = (ctx.user?.id || ctx.req?.ip) ?? "anonymous";
    const result = await checkRedisRateLimit(identifier, maxRequests, windowMs);

    if (!result.allowed) {
      const error = new Error(`Rate limit exceeded. Try again in ${result.retryAfter} seconds`) as unknown;
      (error as { code?: string; retryAfter: number })["code"] = "RATE_LIMIT_EXCEEDED";
      
      (error as { code?: string; retryAfter: number }).retryAfter = result.retryAfter;
      throw error;
    }

    if (ctx.res) {
      ctx.res.setHeader("X-RateLimit-Limit", maxRequests.toString());
      ctx.res.setHeader("X-RateLimit-Remaining", result.remaining.toString());
      ctx.res.setHeader("X-RateLimit-Reset", result.resetAt.toString());
    }

    return next();
  };
}

export async function closeRedisRateLimitConnection(): Promise<void> {
  // Géré par l'infrastructure centralisée
}

export async function checkRedisRateLimitHealth(): Promise<boolean> {
  const redis = getClient();
  if (!redis) return false;
  try {
    await redis.ping();
    return true;
  } catch (error: any) {
    return false;
  }
}