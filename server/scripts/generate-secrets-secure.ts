#!/usr/bin/env tsx
/**
 * Script de génération de secrets sécurisés pour l'environnement
 * Usage: tsx server/scripts/generate-secrets-secure.ts
 */

import { randomBytes } from "crypto";
import { writeFileSync, existsSync } from "fs";
import { join } from "path";
import { logger } from '../core/logger/index';

function generateSecret(length: number = 32): string {
  return randomBytes(length).toString("base64").slice(0, length);
}

function generateSecureEnv() {
  const secrets = {
    JWT_SECRET: generateSecret(48),
    SESSION_SECRET: generateSecret(48),
    CSRF_SECRET: generateSecret(48),
    ENCRYPTION_KEY: generateSecret(32),
    ENCRYPTION_SALT: generateSecret(32),
    MASTER_KEY: generateSecret(64),
  };

  const envContent = `# ============================================
# SECRETS GÉNÉRÉS AUTOMATIQUEMENT
# Date: ${new Date().toISOString()}
# ⚠️ NE JAMAIS COMMITER CE FICHIER
# ============================================

# Secrets critiques (générés automatiquement)
JWT_SECRET=${secrets.JWT_SECRET}
SESSION_SECRET=${secrets.SESSION_SECRET}
CSRF_SECRET=${secrets.CSRF_SECRET}
ENCRYPTION_KEY=${secrets.ENCRYPTION_KEY}
ENCRYPTION_SALT=${secrets.ENCRYPTION_SALT}
MASTER_KEY=${secrets.MASTER_KEY}

# Configuration de base (à personnaliser)
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/servicall_dev
REDIS_URL=redis://localhost:6379
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173
`;

  const envPath = join(process.cwd(), ".env.generated");
  
  if (existsSync(envPath)) {
    logger.info("⚠️  Le fichier .env.generated existe déjà.");
    logger.info("   Renommez-le ou supprimez-le avant de générer de nouveaux secrets.");
    process.exit(1);
  }

  writeFileSync(envPath, envContent, "utf-8");

  logger.info("✅ Secrets générés avec succès !");
  logger.info(`📄 Fichier créé : ${envPath}`);
  logger.info("\n🔐 Secrets générés :");
  logger.info("   - JWT_SECRET (48 caractères)");
  logger.info("   - SESSION_SECRET (48 caractères)");
  logger.info("   - CSRF_SECRET (48 caractères)");
  logger.info("   - ENCRYPTION_KEY (32 caractères)");
  logger.info("   - ENCRYPTION_SALT (32 caractères)");
  logger.info("   - MASTER_KEY (64 caractères)");
  logger.info("\n📋 Prochaines étapes :");
  logger.info("   1. Renommez .env.generated en .env");
  logger.info("   2. Complétez les autres variables d'environnement");
  logger.info("   3. Vérifiez que .env est dans .gitignore");
  logger.info("\n⚠️  IMPORTANT : Ne partagez JAMAIS ces secrets !");
}

// Exécution
generateSecureEnv();
