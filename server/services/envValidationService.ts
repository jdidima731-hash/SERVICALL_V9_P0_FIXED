/**
 * Environment Variables Validation Service — NON-BLOQUANT
 * Variables CRITIQUES  → exit(1) si absentes EN PRODUCTION seulement
 * Variables OPTIONNELLES → warning, jamais exit
 */
import { logger } from "../infrastructure/logger";

const CRITICAL_VARS = ["DATABASE_URL", "SESSION_SECRET", "JWT_SECRET"];
const OPTIONAL_VARS = [
  "TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_FROM_NUMBER",
  "OPENAI_API_KEY", "SENTRY_DSN", "REDIS_URL",
  "ALLOWED_ORIGINS", "CSRF_SECRET",
];

export async function validateEnvironmentOrExit(): Promise<void> {
  logger.info("[EnvValidation] Démarrage de la validation...");
  const isProduction = process.env["NODE_ENV"] === "production";

  const missingCritical = CRITICAL_VARS.filter((v: any) => !process.env[v]?.trim());
  if (missingCritical.length > 0) {
    if (isProduction) {
      logger.error(`[EnvValidation] ❌ Variables CRITIQUES manquantes : ${missingCritical.join(", ")}. Arrêt.`);
      process.exit(1);
    } else {
      logger.warn(`[EnvValidation] ⚠️ Variables critiques manquantes (dev) : ${missingCritical.join(", ")}`);
    }
  }

  const missingOptional = OPTIONAL_VARS.filter((v: any) => !process.env[v]?.trim());
  if (missingOptional.length > 0) {
    logger.warn(`[EnvValidation] ⚠️ Variables optionnelles absentes : ${missingOptional.join(", ")}`);
  }

  logger.info("[EnvValidation] ✅ Validation terminée");
}

export function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value?.trim()) throw new Error(`Variable d'environnement requise manquante : ${name}`);
  return value;
}

export function getOptionalEnv(name: string, defaultValue: string): string {
  const value = process.env[name];
  return value?.trim() ? value : defaultValue;
}
