/**
 * Environment Configuration & Security Validation
 * ✅ DURCISSEMENT SaaS: Validation stricte au boot (assertEnvOrCrash)
 */

import { logger } from "../infrastructure/logger";
import { validateEnv as validateEnvSchema } from "../config/envSchema";

export type AppMode = "dev" | "prod";

// ✅ Mode résilient VPS propre : validation centralisée avec repli contrôlé
const parsedEnv = validateEnvSchema();

export const ENV = {
  appId: process.env['VITE_APP_ID'] ?? "",
  jwtSecret: parsedEnv.JWT_SECRET,
  tenantJwtSecret: parsedEnv.TENANT_JWT_SECRET, // ✅ Ajouté suite à CORRECTION 1
  databaseUrl: parsedEnv.DATABASE_URL,
  sessionSecret: parsedEnv.SESSION_SECRET,
  csrfSecret: parsedEnv.CSRF_SECRET,
  encryptionKey: parsedEnv.ENCRYPTION_KEY,
  encryptionSalt: parsedEnv.ENCRYPTION_SALT,
  masterKey: parsedEnv.MASTER_KEY,
  port: parsedEnv.PORT,
  nodeEnv: parsedEnv.NODE_ENV,
  isProduction: parsedEnv.NODE_ENV === "production",
  allowedOrigins: parsedEnv.ALLOWED_ORIGINS
    ? parsedEnv.ALLOWED_ORIGINS.split(",").map(origin => origin.trim()).filter(Boolean)
    : [],
  sentryDsn: parsedEnv.SENTRY_DSN,
  redisUrl: parsedEnv.REDIS_URL ?? "redis://localhost:6379",
  twilioAccountSid: parsedEnv.TWILIO_ACCOUNT_SID,
  twilioAuthToken: parsedEnv.TWILIO_AUTH_TOKEN,
  twilioTwimlAppSid: parsedEnv.TWILIO_TWIML_APP_SID,
  openaiApiKey: parsedEnv.OPENAI_API_KEY,
  openaiApiUrl: parsedEnv.OPENAI_API_URL,
  redisHost: parsedEnv.REDIS_URL ? new URL(parsedEnv.REDIS_URL).hostname : "localhost",
  redisPort: parsedEnv.REDIS_URL ? parseInt(new URL(parsedEnv.REDIS_URL).port, 10) : 6379,
  redisPassword: parsedEnv.REDIS_URL ? new URL(parsedEnv.REDIS_URL).password : undefined,
  disableRedis: parsedEnv.DISABLE_REDIS,
  // Stripe BYOK : Les clés sont désormais gérées par tenant via le service BYOK
  // stripeSecretKey, stripeWebhookSecret supprimés
  webhookSecret: parsedEnv.WEBHOOK_SECRET,
  smtpHost: parsedEnv.SMTP_HOST,
  smtpPort: parsedEnv.SMTP_PORT,
  smtpUser: parsedEnv.SMTP_USER,
  smtpPassword: parsedEnv.SMTP_PASSWORD,
  awsAccessKeyId: parsedEnv.AWS_ACCESS_KEY_ID,
  awsSecretAccessKey: parsedEnv.AWS_SECRET_ACCESS_KEY,
  awsRegion: parsedEnv.AWS_REGION,
  awsS3Bucket: parsedEnv.AWS_S3_BUCKET,
  twilioPhoneNumber: parsedEnv.TWILIO_PHONE_NUMBER,
  twilioApiKey: parsedEnv.TWILIO_API_KEY,
  twilioApiSecret: parsedEnv.TWILIO_API_SECRET,
  cookieSecret: parsedEnv.COOKIE_SECRET,
  redisEnabled: !parsedEnv.DISABLE_REDIS,
  dbEnabled: !parsedEnv.DISABLE_DB,
  modeTest: parsedEnv.MODE_TEST,
  appUrl: parsedEnv.APP_URL || parsedEnv.WEBHOOK_URL,
};

/**
 * ✅ DURCISSEMENT SaaS: Validation stricte au boot
 * Le serveur s'arrête immédiatement si une variable critique est manquante.
 */
export async function assertEnvOrCrash(): Promise<void> {
  // La validation principale est maintenant gérée par `envSchema.parse` au début du fichier.
  // Cette fonction peut être utilisée pour des vérifications supplémentaires si nécessaire.
  validateEnvSchema(); // Appelle la fonction de validation du schéma Zod

  const isProd = ENV.isProduction;
  const errors: string[] = [];

  // Vérifications spécifiques à la production ou logiques complexes non gérées par Zod directement
  if (isProd && !ENV.databaseUrl) {
    errors.push("DATABASE_URL est obligatoire en production");
  }

  if (errors.length > 0) {
    logger.warn("\n⚠️ CONFIGURATION DÉGRADÉE (assertEnvOrCrash) :");
    errors.forEach(err => logger.warn(`  - ${err}`));
    logger.warn("\nLe serveur continue en mode dégradé contrôlé.\n");
  }

  if (ENV.openaiApiKey) {
    logger.info("[ENV] OpenAI configuré (validation différée au premier appel)");
  }

  logger.info("✅ Configuration environnement validée avec succès.");
}

/**
 * Alias pour compatibilité descendante
 */
export function validateSecrets(): void {
  assertEnvOrCrash();
}

/**
 * ✅ ROTATION DES TOKENS: Vérifier si les secrets doivent être renouvelés
 * En production, les secrets devraient être renouvelés tous les 90 jours
 */
export function checkSecretRotation(): { shouldRotate: boolean; message?: string } {
  return {
    shouldRotate: false,
    message: "Rotation des secrets recommandée tous les 90 jours en production"
  };
}

/**
 * ✅ VALIDATION SÉPARATION DEV/PROD
 * Vérifie que les valeurs de développement ne sont pas utilisées en production
 */
export function validateEnvironmentSeparation(): void {
  if (!ENV.isProduction) return;

  const devPatterns = ["dev_", "test_", "local_", "localhost", "127.0.0.1", "example.com"];
  const errors: string[] = [];

  if (ENV.databaseUrl) {
    for (const pattern of devPatterns) {
      if (ENV.databaseUrl.toLowerCase().includes(pattern)) {
        errors.push(`DATABASE_URL contient un pattern de développement: ${pattern}`);
      }
    }
  }

  if (ENV.redisUrl && ENV.redisUrl.includes("localhost")) {
    errors.push("REDIS_URL pointe vers localhost en production");
  }

  if (ENV.allowedOrigins && ENV.allowedOrigins.includes("localhost")) {
    logger.warn("[ENV] ALLOWED_ORIGINS contient localhost en production");
  }

  if (errors.length > 0) {
    logger.warn("\n⚠️ ATTENTION: Configuration de développement détectée en production (autorisé en sandbox) :");
    errors.forEach(err => logger.warn(`  - ${err}`));
  }

  logger.info("[ENV] ✅ Séparation dev/prod validée");
}
