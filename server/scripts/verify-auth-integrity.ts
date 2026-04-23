/**
 * 🔒 SCRIPT DE VÉRIFICATION D'INTÉGRITÉ AUTH (PRODUCTION GRADE)
 * Ce script est l'ultime rempart : si il échoue, le déploiement est REJETÉ.
 */

import "dotenv/config";
import { dbManager } from "../services/dbManager";
import { hasAdminUser } from "../services/dbInitializationService";
import { logger } from "../infrastructure/logger";

async function verify() {
  logger.info("[Verify] 🔍 Vérification finale de l'intégrité du déploiement...");

  try {
    // 1. Test de connexion DB
    await dbManager.initialize();
    const client = dbManager.client;
    logger.info("[Verify] ✅ Connexion PostgreSQL établie");

    // 2. Vérification de l'existence de l'admin
    const adminExists = await hasAdminUser();
    if (!adminExists) {
      logger.error("[Verify] ❌ ERREUR CRITIQUE : Aucun administrateur trouvé en base !");
      process.exit(1);
    }
    logger.info("[Verify] ✅ Utilisateur administrateur détecté");

    // 3. Vérification de la validité du hash (Bcrypt test)
    const [admin] = await client`SELECT password_hash FROM users WHERE role = 'admin' LIMIT 1`;
    if (!admin || !admin['password_hash'] || !admin['password_hash'].startsWith('$2')) {
      logger.error("[Verify] ❌ ERREUR CRITIQUE : Hash de mot de passe invalide ou manquant");
      process.exit(1);
    }
    logger.info("[Verify] ✅ Format du hash de mot de passe validé");

    // 4. Vérification de la liaison Tenant
    const [tenantLink] = await client`
      SELECT count(*) as count 
      FROM tenant_users tu
      JOIN users u ON u.id = tu.user_id
      WHERE u.role = 'admin'
    `;
    if (parseInt(tenantLink!['count']) === 0) {
      logger.error("[Verify] ❌ ERREUR CRITIQUE : L'admin n'est lié à aucun tenant !");
      process.exit(1);
    }
    logger.info("[Verify] ✅ Liaison Admin <-> Tenant validée");

    logger.info("\n🚀 DÉPLOIEMENT VALIDÉ : L'application est prête pour la production.\n");
    process.exit(0);
  } catch (error: any) {
    logger.error("[Verify] ❌ ÉCHEC DE LA VÉRIFICATION", { error });
    process.exit(1);
  }
}

verify();
