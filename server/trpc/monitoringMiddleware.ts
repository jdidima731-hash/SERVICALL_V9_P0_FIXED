import { logger } from "../infrastructure/logger";
import { metrics } from "../services/metricsService";

/**
 * tRPC Middleware for performance monitoring and error tracking
 */
export const monitoringMiddleware = async (opts: any) => {
  const { path, type, next, ctx } = opts;
  const start = Date.now();
  const tenantId = ctx.tenant?.id;
  const userId = ctx.user?.id;

  try {
    const result = await next();
    const duration = Date.now() - start;

    // Record successful request
    metrics.recordRequest(path, type, 200, duration);
    
    // Log slow requests (> 1s)
    if (duration > 1000) {
      logger.warn(`[tRPC Monitoring] Slow procedure detected: ${path}`, {
        path,
        type,
        duration_ms: duration,
        tenantId,
        userId
      });
    }

    return result;
  } catch (error: any) {
    const duration = Date.now() - start;
    const statusCode = (error as { code: string }).code === 'UNAUTHORIZED' ? 401 : 500;

    // Record failed request
    metrics.recordRequest(path, type, statusCode, duration);

    // Log error with context
    logger.error(`[tRPC Monitoring] Procedure failed: ${path}`, error, {
      path,
      type,
      duration_ms: duration,
    });

    throw error;
  }
};
