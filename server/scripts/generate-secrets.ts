#!/usr/bin/env tsx
/**
 * Script de génération de secrets sécurisés
 * Usage: tsx server/scripts/generate-secrets.ts
 * 
 * Génère tous les secrets nécessaires pour le fichier .env
 */

import { randomBytes } from "crypto";
import { logger } from '../core/logger/index';

function generateSecret(length: number = 32): string {
  return randomBytes(length).toString("base64");
}

function main() {
  logger.info("\n=== SECRETS GÉNÉRÉS POUR SERVICALL CRM v2 ===\n");
  logger.info("Copiez ces valeurs dans votre fichier .env\n");
  logger.info("⚠️  ATTENTION: Ces secrets ne seront affichés qu'une seule fois!\n");
  logger.info("─".repeat(60));
  
  const secrets = {
    JWT_SECRET: generateSecret(32),
    SESSION_SECRET: generateSecret(32),
    ENCRYPTION_KEY: generateSecret(32),
    MASTER_KEY: generateSecret(32),
  };

  for (const [key, value] of Object.entries(secrets)) {
    logger.info(`${key}=${value}`);
  }

  logger.info("─".repeat(60));
  logger.info("\n✅ Secrets générés avec succès!");
  logger.info("\n📋 Prochaines étapes:");
  logger.info("1. Copiez ces valeurs dans votre fichier .env");
  logger.info("2. Configurez DATABASE_URL avec vos identifiants PostgreSQL");
  logger.info("3. Configurez les autres variables selon vos besoins");
  logger.info("4. Ne commitez JAMAIS le fichier .env dans Git!\n");
}

// Exécuter uniquement si appelé directement
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { generateSecret };
