/**
 * STRICT ENVIRONMENT VALIDATION - Hard CTO Mode
 * PHASE 6 - Validation with Zod
 *
 * NOTE : Ce fichier est un schema de validation secondaire conservé pour compatibilité.
 * Le schema PRINCIPAL utilisé au boot est : server/config/envSchema.ts
 * (importé par server/_core/env.ts et server/index.ts)
 *
 * Toutes les règles de sécurité prod (JWT_SECRET ≥ 32, CSRF_SECRET requis,
 * REDIS_URL requis) sont définitivement appliquées dans envSchema.ts.
 */
import { z } from 'zod';
import { logger } from "../infrastructure/logger";

const isProd = process.env['NODE_ENV'] === 'production';

const envSchema = z.object({
  // --- CORE CONFIG ---
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().transform(Number).default('3000'),

  // --- DATABASE ---
  DATABASE_URL: z.string().url(),

  // --- SECURITY ---
  ENCRYPTION_KEY: z.string().min(32, "Encryption key must be at least 32 characters"),

  // JWT_SECRET : min 32 chars en prod (openssl rand -base64 48 recommandé)
  JWT_SECRET: isProd
    ? z.string().min(32, "JWT_SECRET must be at least 32 characters in production")
    : z.string().min(16, "JWT secret must be at least 16 characters"),

  // CSRF_SECRET : requis en production pour activer la protection CSRF
  CSRF_SECRET: isProd
    ? z.string().min(32, "CSRF_SECRET must be at least 32 characters in production")
    : z.string().optional(),

  // REDIS_URL : requis en production (JWT revocation distribuée, rate-limiting, BullMQ)
  REDIS_URL: isProd
    ? z.string().url("REDIS_URL must be a valid URL in production")
    : z.string().optional(),

  // --- SERVICES (CRITICAL) ---
  OPENAI_API_KEY: z.string().optional(),
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),

  // --- OPTIONAL ---
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error', 'fatal']).default('info'),
  SENTRY_DSN: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

export const validateEnv = (): Env => {
  try {
    const parsed = envSchema.parse(process.env);
    logger.info("✅ Environment validation successful");
    return parsed;
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      const missingVars = (error as z.ZodError).errors.map((e: any) => e.path.join(".")).join(", ");
      logger.fatal(`❌ FATAL: Environment validation failed. Missing or invalid variables: ${missingVars}`);
      if (process.env["NODE_ENV"] === "production") {
        logger.error(`\nFATAL: Missing or invalid environment variables: ${missingVars}\n`);
        process.exit(1);
      }
    }
    throw error;
  }
};

// Singleton instance
export const env = validateEnv();

export default env;
