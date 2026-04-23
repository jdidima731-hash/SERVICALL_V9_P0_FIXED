/**
 * ✅ BLOC 1 CORRIGÉ: Identifiants codés en dur supprimés.
 * Utiliser les variables d'environnement :
 *   ADMIN_EMAIL     (requis)
 *   ADMIN_PASSWORD  (requis, min 12 caractères)
 *   ADMIN_NAME      (optionnel)
 */
import "dotenv/config";
import { dbManager } from "../services/dbManager";
import { hashPassword } from "../services/passwordService";
import { nanoid } from "nanoid";
import * as schema from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import { logger } from '../core/logger/index';

// ✅ BLOC 1: Identifiants depuis les variables d'environnement uniquement
const adminEmail = process.env['ADMIN_EMAIL'];
const adminPassword = process.env['ADMIN_PASSWORD'];
const adminName = process.env['ADMIN_NAME'] ?? "Administrateur Système";

if (!adminEmail || !adminPassword) {
  logger.error("[InitAdminRobust] ❌ ADMIN_EMAIL et ADMIN_PASSWORD sont requis dans les variables d'environnement.");
  process.exit(1);
}

if (adminPassword.length < 12) {
  logger.error("[InitAdminRobust] ❌ ADMIN_PASSWORD doit contenir au moins 12 caractères.");
  process.exit(1);
}

async function main() {
  try {
    logger.info("Starting Robust Admin Init...");
    
    // Forcer l'initialisation de la DB
    await dbManager.initialize();
    const db = dbManager.db;
    
    if (!db || !dbManager.client) {
        throw new Error("DB initialization failed - no database instance");
    }

    // Vérifier si l'utilisateur existe
    const existingUsers = await db.select().from(schema.users).where(eq(schema.users.email, adminEmail!));
    
    let adminId: number;

    if (existingUsers.length === 0) {
      const passwordHash = await hashPassword(adminPassword!);
      const openId = nanoid();
      
      const [newAdmin] = await db.insert(schema.users).values({
        openId,
        email: adminEmail!,
        name: adminName,
        passwordHash,
        loginMethod: "password",
        role: "admin",
        lastSignedIn: new Date(),
      }).returning();
      
      adminId = newAdmin.id;
      logger.info("✅ Admin created with ID:", adminId);
    } else {
      adminId = existingUsers[0].id;
      logger.info("ℹ️ Admin already exists with ID:", adminId);
    }

    // Créer le tenant par défaut
    const existingTenants = await db.select().from(schema.tenants).where(eq(schema.tenants.slug, "default"));
    let tenantId: number;

    if (existingTenants.length === 0) {
      const [newTenant] = await db.insert(schema.tenants).values({
        slug: "default",
        name: "ServiceCall Default",
        isActive: true,
      }).returning();
      tenantId = newTenant.id;
      logger.info("✅ Default tenant created with ID:", tenantId);
    } else {
      tenantId = existingTenants[0].id;
      logger.info("ℹ️ Default tenant already exists with ID:", tenantId);
    }

    // Lier l'admin au tenant
    const existingLinks = await db.select().from(schema.tenantUsers)
      .where(eq(schema.tenantUsers.userId, adminId));

    if (existingLinks.length === 0) {
      await db.insert(schema.tenantUsers).values({
        userId: adminId,
        tenantId: tenantId,
        role: "owner",
        isActive: true,
      });
      logger.info("✅ Admin linked to tenant");
    } else {
        logger.info("ℹ️ Admin already linked to tenant");
    }

    logger.info("SUCCESS: Admin initialization complete");
    await dbManager.close();
    process.exit(0);
  } catch (error: any) {
    logger.error("CRITICAL FAILURE:", error);
    process.exit(1);
  }
}

main();
