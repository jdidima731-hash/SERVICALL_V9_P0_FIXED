/**
 * Rate Limit Middleware — Protection contre les abus et attaques DDoS légères
 * ✅ FIX ERR_ERL_CREATED_IN_REQUEST_HANDLER: Les limiteurs sont créés UNE SEULE FOIS
 *    au démarrage du module, pas à l'intérieur des handlers de requête.
 *    express-rate-limit v7+ interdit l'instanciation dans un handler.
 */

import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import { logger } from '../infrastructure/logger';

/**
 * Crée un store Redis lazily au premier appel — mais le LIMITER lui-même est
 * instancié une seule fois à l'initialisation du module, hors handler.
 */
const buildLimiter = (options: Parameters<typeof rateLimit>[0]) => {
  // ✅ Instanciation HORS handler — conforme à express-rate-limit v7+
  return rateLimit({
    ...options,
    // Le store Redis est résolu dynamiquement via la factory interne de rateLimit
    // Fallback mémoire automatique si Redis indisponible
    store: (() => {
      try {
        const { getRedisClient } = require('../infrastructure/redis/redis.client');
        const client = getRedisClient();
        if (!client || typeof client.call !== 'function') return undefined;
        const RedisStore = require('rate-limit-redis');
        return new RedisStore({
          sendCommand: (...args: string[]) => client.call(...args),
        });
      } catch {
        return undefined; // fallback mémoire
      }
    })(),
  });
};

// ✅ FIX P5.1: Rate limiter global (par IP) — instancié au démarrage du module
export const globalRateLimiter = buildLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: 'Trop de requêtes depuis cette IP, veuillez réessayer après 15 minutes.',
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: Request, res: Response, _next: NextFunction, options: any) => {
    logger.warn('[RateLimit] Global rate limit exceeded', {
      ip: req.ip,
      method: req.method,
      path: req.path,
      max: options.max,
      window: options.windowMs,
    });
    res.status(options.statusCode).send(options.message);
  },
});

// ✅ FIX P5.1: Rate limiter auth — instancié au démarrage du module
export const authRateLimiter = buildLimiter({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 5,
  message: 'Trop de tentatives de connexion, veuillez réessayer après 5 minutes.',
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: Request, res: Response, _next: NextFunction, options: any) => {
    logger.warn('[RateLimit] Auth rate limit exceeded', {
      ip: req.ip,
      method: req.method,
      path: req.path,
      max: options.max,
      window: options.windowMs,
    });
    res.status(options.statusCode).send(options.message);
  },
});

// ✅ FIX P5.1: Rate limiter par utilisateur — instancié au démarrage du module
export const userRateLimiter = buildLimiter({
  windowMs: 60 * 60 * 1000, // 1 heure
  max: 1000,
  keyGenerator: (req: Request) => {
    return req.user?.id?.toString() || req.ip || 'unknown';
  },
  message: 'Trop de requêtes, veuillez réessayer plus tard.',
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: Request, res: Response, _next: NextFunction, options: any) => {
    logger.warn('[RateLimit] User rate limit exceeded', {
      userId: req.user?.id,
      ip: req.ip,
      method: req.method,
      path: req.path,
      max: options.max,
      window: options.windowMs,
    });
    res.status(options.statusCode).send(options.message);
  },
});
