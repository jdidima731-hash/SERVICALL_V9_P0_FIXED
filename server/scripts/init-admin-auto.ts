/**
 * Script d'initialisation admin automatique (non-interactif)
 * Utilisé pour l'initialisation initiale sans interaction utilisateur
 */
import * as dotenv from "dotenv";
dotenv.config();

import { logger } from "../infrastructure/logger";
import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";

async function getDb() {
  try {
    const { db } = await import("../db");
    return db;
  } catch (error: any) {
    logger.error("[InitAdmin] Erreur connexion DB", { error });
    return null;
  }
}

async function main() {
  // ✅ BLOC 1: Fallback codé en dur supprimé — ADMIN_EMAIL requis
  const adminEmail = process.env['ADMIN_EMAIL'];
  if (!adminEmail) {
    logger.error('[InitAdminAuto] ❌ ADMIN_EMAIL est requis dans les variables d\'environnement.');
    process.exit(1);
  }
  // ✅ FIX — plus de mot de passe par défaut codé en dur : ADMIN_PASSWORD obligatoire
  const adminPassword = process.env['ADMIN_PASSWORD'];
  if (!adminPassword || adminPassword.length < 8) {
    logger.error('[InitAdminAuto] ❌ ADMIN_PASSWORD est requis dans les variables d\'environnement (min 8 caractères).');
    process.exit(1);
  }
  const adminName = process.env['ADMIN_NAME'] || "Administrateur Servicall";

  try {
    logger.info("[InitAdmin-Auto] Démarrage de l'initialisation automatique");

    const db = await getDb();
    if (!db) {
      logger.error("❌ Impossible de se connecter à la base de données");
      process.exit(1);
    }

    const { users, tenants, tenantUsers } = await import("../../drizzle/schema");
    const { eq } = await import("drizzle-orm");

    // Vérifier si un admin existe déjà
    const existingAdmin = await db
      .select()
      .from(users)
      .where(eq(users.email, adminEmail))
      .limit(1);

    if (existingAdmin.length > 0) {
      logger.info(`\n✅ Administrateur existant détecté: ${adminEmail}`);
      logger.info("Aucune action nécessaire.\n");
      process.exit(0);
    }

    // Hasher le mot de passe
    const passwordHash = await bcrypt.hash(adminPassword, 12);
    const openId = nanoid();

    // Créer l'utilisateur admin
    const [admin] = await db
      .insert(users)
      .values({
        openId,
        email: adminEmail,
        name: adminName,
        passwordHash,
        loginMethod: "password",
        role: "admin",
        lastSignedIn: new Date(),
      })
      .returning();

    if (!admin) {
      throw new Error("Échec de la création de l'administrateur");
    }

    logger.info(`\n✅ Administrateur créé avec succès!`);
    logger.info(`   Email    : ${adminEmail}`);
    logger.info(`   Nom      : ${adminName}`);
    logger.info(`   Rôle     : admin`);

    // Créer un tenant par défaut
    try {
      const existingTenant = await db
        .select()
        .from(tenants)
        .where(eq(tenants.slug, "default"))
        .limit(1);

      let tenantId: number;

      if (existingTenant.length > 0) {
        tenantId = existingTenant[0]!.id;
        logger.info(`   Tenant   : ${tenantId} (existant)`);
      } else {
        const [tenant] = await db
          .insert(tenants)
          .values({
            slug: "default",
            name: "ServiceCall Default",
            domain: null,
            logo: null,
            settings: {},
            isActive: true,
          })
          .returning();

        if (!tenant) throw new Error("Échec de la création du tenant");
        tenantId = tenant.id;
        logger.info(`   Tenant   : ${tenantId} (créé)`);
      }

      // Lier l'admin au tenant
      await db.insert(tenantUsers).values({
        userId: admin.id,
        tenantId,
        role: "owner",
        isActive: true,
      });

      logger.info(`\n✅ Tenant par défaut configuré (ID: ${tenantId})`);
    } catch (tenantError) {
      logger.warn(`⚠️ Avertissement tenant: ${tenantError instanceof Error ? tenantError.message : tenantError}`);
    }

    logger.info("\n🔑 Identifiants de connexion:");
    logger.info(`   Email    : ${adminEmail}`);
    logger.info(`   Mot de passe : ${adminPassword}`);
    logger.info("\n");

    process.exit(0);
  } catch (error: any) {
    logger.error("[InitAdmin-Auto] Erreur", { error });
    logger.error("\n❌ Erreur:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
