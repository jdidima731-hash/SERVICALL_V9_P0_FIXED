/**
 * ENV SCHEMA — Validation Zod (SÉCURISÉ)
 * ✅ FAIL-CLOSED : l'application s'arrête si les secrets critiques ou la base de données sont manquants.
 * ✅ Intégrations conditionnelles : les services externes optionnels ne doivent être activés qu'avec une configuration valide.
 */
import { z } from "zod";

function normalizeEnv(rawEnv: NodeJS.ProcessEnv): { normalizedEnv: NodeJS.ProcessEnv; warnings: string[] } {
  const normalizedEnv: NodeJS.ProcessEnv = { ...rawEnv };
  const warnings: string[] = [];

  if (!normalizedEnv.NODE_ENV) {
    normalizedEnv.NODE_ENV = "production";
  }

  if (!normalizedEnv.ALLOWED_ORIGINS && normalizedEnv.NODE_ENV === "production") {
    warnings.push("ALLOWED_ORIGINS absent : aucune origine navigateur externe ne sera autorisée en production.");
  }

  return { normalizedEnv, warnings };
}

export const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().default(5000),
  DATABASE_URL: z
    .string()
    .min(1, "DATABASE_URL est obligatoire")
    .refine(
      (url) => url.startsWith("postgres://") || url.startsWith("postgresql://"),
      "DATABASE_URL doit commencer par postgres:// ou postgresql://"
    ),
  REDIS_URL: z.string().url().optional().superRefine((val, ctx) => {
    if (!val && process.env["NODE_ENV"] === "production" && process.env["DISABLE_REDIS"] !== "true") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "REDIS_URL est obligatoire en production tant que Redis n'est pas explicitement désactivé via DISABLE_REDIS=true.",
      });
    }
  }),
  // Secrets critiques : OBLIGATOIRES, pas de fallback
  SESSION_SECRET: z.string().min(32, "SESSION_SECRET doit faire au moins 32 caractères"),
  JWT_SECRET: z.string().min(32, "JWT_SECRET doit faire au moins 32 caractères"),
  JWT_REFRESH_SECRET: z.string().min(32, "JWT_REFRESH_SECRET doit faire au moins 32 caractères"),
  TENANT_JWT_SECRET: z.string().min(32, "TENANT_JWT_SECRET doit faire au moins 32 caractères"),
  CSRF_SECRET: z.string().min(32, "CSRF_SECRET doit faire au moins 32 caractères"),
  ENCRYPTION_KEY: z.string().length(32, "ENCRYPTION_KEY doit faire exactement 32 caractères (AES-256)"),
  ENCRYPTION_SALT: z.string().min(32, "ENCRYPTION_SALT doit faire au moins 32 caractères"),
  MASTER_KEY: z.string().min(32, "MASTER_KEY doit faire au moins 32 caractères"),
  
  COOKIE_SECRET: z.string().min(32).optional(),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_ORG_ID: z.string().optional(),
  OPENAI_API_URL: z.string().url().default("https://api.openai.com/v1"),
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_FROM_NUMBER: z.string().optional(),
  TWILIO_WEBHOOK_URL: z.string().url().optional(),
  TWILIO_TWIML_APP_SID: z.string().optional(),
  TWILIO_API_KEY: z.string().optional(),
  TWILIO_API_SECRET: z.string().optional(),
  TWILIO_PHONE_NUMBER: z.string().optional(),
  WEBHOOK_URL: z.string().url().optional(),
  RESEND_API_KEY: z.string().optional(),
  RESEND_FROM_EMAIL: z.string().email().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_CALLBACK_URL: z.string().url().optional(),
  AWS_REGION: z.string().optional(),
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  AWS_S3_BUCKET: z.string().optional(),
  SENTRY_DSN: z.string().optional(),
  SENTRY_ENVIRONMENT: z.string().optional(),
  ALLOWED_ORIGINS: z.string().optional(),
  WEBHOOK_SECRET: z.string().optional(),
  DEFAULT_TENANT_ID: z.string().optional(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().optional().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  DISABLE_REDIS: z.string().optional().transform((v) => v === "true"),
  DISABLE_DB: z.string().optional().transform((v) => v === "true"),
  MODE_TEST: z.string().optional().transform((v) => v === "true"),
  SKIP_DB_INIT: z.string().optional().transform((v) => v === "true"),
  AUTO_MIGRATE: z.string().optional().transform((v) => v === "true"),
  LOG_LEVEL: z.string().optional().default("info"),
  APP_URL: z.string().url().optional(),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(): Env {
  const { normalizedEnv, warnings } = normalizeEnv(process.env);
  
  Object.assign(process.env, normalizedEnv);

  if (warnings.length > 0) {
    console.warn("\n⚠️ ALERTES CONFIGURATION :\n");
    for (const warning of warnings) {
      console.warn(`  • ${warning}`);
    }
    console.warn("");
  }

  const result = envSchema.safeParse(normalizedEnv);

  if (!result.success) {
    console.error("\n❌ ERREUR CRITIQUE DE CONFIGURATION :\n");
    for (const issue of result.error.issues) {
      const key = String(issue.path[0] ?? "unknown");
      console.error(`  • ${key} : ${issue.message}`);
    }
    console.error("\nL'application ne peut pas démarrer avec cette configuration. Corrigez les variables requises avant lancement.\n");
    process.exit(1);
  }

  console.log("✅ Variables d'environnement validées.\n");
  return result.data;
}
