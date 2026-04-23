import { middleware } from '../_core/trpc';
import type { TrpcContext } from '../_core/context';
import { 
  cache, 
  type CacheOptions, 
  CACHE_STRATEGIES 
} from '../services/cacheService.enhanced';
import { logger } from "../infrastructure/logger";

/**
 * TRPC CACHE MIDDLEWARE - Automatic Caching Layer
 */

export interface CacheMetadata {
  strategy?: keyof typeof CACHE_STRATEGIES;
  ttl?: number;
  tags?: string[];
  cacheKey?: string | ((input: any, ctx: TrpcContext) => string);
  disabled?: boolean;
  swr?: boolean;
}

function generateCacheKey(
  path: string,
  input: any,
  ctx: TrpcContext,
  metadata?: CacheMetadata
): string {
  if (metadata?.cacheKey) {
    if (typeof metadata.cacheKey === 'function') {
      return metadata.cacheKey(input, ctx);
    }
    return metadata.cacheKey;
  }

  const tenantId = ctx.tenantId ?? 'global';
  const inputHash = input ? JSON.stringify(input) : 'no-input';
  
  return `trpc:${tenantId}:${path}:${inputHash}`;
}

function getCacheOptions(metadata?: CacheMetadata): CacheOptions {
  if (!metadata || metadata.disabled) {
    return { ttl: 0 };
  }

  const strategyName = metadata.strategy || 'MEDIUM';
  const strategy = CACHE_STRATEGIES[strategyName];

  return {
    ttl: metadata.ttl ?? strategy.defaultTtl,
    tags: metadata.tags ?? [],
    staleWhileRevalidate: metadata.swr ?? strategy.swr,
  };
}

export const cacheMiddleware = middleware(async ({ ctx, next, path, type, meta }) => {
  if (type !== 'query') {
    return next();
  }

  const cacheMetadata = meta?.cache as CacheMetadata | undefined;

  if (cacheMetadata?.disabled || cacheMetadata?.strategy === 'NONE') {
    return next();
  }

  const cacheKey = generateCacheKey(path, undefined, ctx as TrpcContext, cacheMetadata);
  const cacheOptions = getCacheOptions(cacheMetadata);

  try {
    const cached = await cache.get(cacheKey, cacheOptions);

    if (cached !== null) {
      logger.debug('[CacheMiddleware] Cache HIT', { path, cacheKey });
      return {
        ok: true,
        data: cached,
        ctx,
      };
    }

    const result = await next();

    if (result.ok) {
      await cache.set(cacheKey, result.data, cacheOptions);
    }

    return result;
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error('[CacheMiddleware] Error', { error: msg, path, cacheKey });
    return next();
  }
});

export const invalidationMiddleware = middleware(async ({ ctx, next, path, type, meta }) => {
  if (type !== 'mutation') {
    return next();
  }

  const result = await next();

  if (result.ok) {
    const invalidateMetadata = meta?.invalidate as {
      tags?: string[];
      patterns?: string[];
      tenant?: boolean;
    } | undefined;

    if (invalidateMetadata) {
      try {
        if (invalidateMetadata.tags && invalidateMetadata.tags.length > 0) {
          await cache.invalidateByTags(invalidateMetadata.tags);
        }

        if (invalidateMetadata.patterns && invalidateMetadata.patterns.length > 0) {
          for (const pattern of invalidateMetadata.patterns) {
            await cache.invalidate(pattern);
          }
        }

        if (invalidateMetadata.tenant && (ctx as TrpcContext).tenantId) {
          await cache.invalidateTenant((ctx as TrpcContext).tenantId!);
        }
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        logger.error('[InvalidationMiddleware] Error during invalidation', { error: msg, path });
      }
    }
  }

  return result;
});

export const withCache = cacheMiddleware;
export const withInvalidation = invalidationMiddleware;
