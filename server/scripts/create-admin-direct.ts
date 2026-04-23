/**
 * Script direct de création du compte admin
 * Connexion directe à PostgreSQL sans passer par le dbManager
 *
 * ✅ BLOC 1 CORRIGÉ: Identifiants codés en dur supprimés.
 * Utiliser les variables d'environnement :
 *   ADMIN_EMAIL     (requis)
 *   ADMIN_PASSWORD  (requis, min 12 caractères)
 *   ADMIN_NAME      (optionnel, défaut: "Administrateur Système")
 *   DATABASE_URL    (requis)
 */
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";
import { logger } from '../core/logger/index';

// ✅ BLOC 1: DATABASE_URL sans fallback codé en dur
const DATABASE_URL = process.env['DATABASE_URL'];
if (!DATABASE_URL) {
  logger.error("❌ DATABASE_URL est requis. Définissez-la dans votre fichier .env");
  process.exit(1);
}

// ✅ BLOC 1: Identifiants admin depuis les variables d'environnement uniquement
const adminEmail = process.env['ADMIN_EMAIL'];
const adminPassword = process.env['ADMIN_PASSWORD'];
const adminName = process.env['ADMIN_NAME'] ?? "Administrateur Système";

if (!adminEmail) {
  logger.error("❌ ADMIN_EMAIL est requis. Définissez-la dans votre fichier .env");
  process.exit(1);
}

if (!adminPassword) {
  logger.error("❌ ADMIN_PASSWORD est requis. Définissez-la dans votre fichier .env");
  process.exit(1);
}

if (adminPassword.length < 12) {
  logger.error("❌ ADMIN_PASSWORD doit contenir au moins 12 caractères pour des raisons de sécurité.");
  process.exit(1);
}

async function main() {
  logger.info("🔧 Connexion à PostgreSQL...");
  
  const client = postgres(DATABASE_URL!, { max: 1 });
  const db = drizzle(client, { schema });
  
  try {
    // Test connexion
    await client`SELECT 1`;
    logger.info("✅ Connexion PostgreSQL réussie");
    
    // Vérifier si l'admin existe déjà
    const existing = await db.select().from(schema.users).where(eq(schema.users.email, adminEmail!)).limit(1);
    
    let adminId: number;
    
    if (existing.length > 0) {
      const existingAdmin = existing[0];
      if (!existingAdmin) throw new Error("Admin record not found");
      adminId = existingAdmin.id;
      logger.info(`ℹ️  Admin déjà existant (id=${adminId}), mise à jour du mot de passe...`);
      const passwordHash = await bcrypt.hash(adminPassword!, 12);
      await db.update(schema.users)
        .set({ passwordHash, role: "admin", isActive: true })
        .where(eq(schema.users.email, adminEmail!));
      logger.info("✅ Mot de passe mis à jour");
    } else {
      const passwordHash = await bcrypt.hash(adminPassword!, 12);
      const openId = nanoid();
      
      const inserted = await db.insert(schema.users).values({
        openId,
        email: adminEmail!,
        name: adminName,
        passwordHash,
        loginMethod: "password",
        role: "admin",
        lastSignedIn: new Date(),
        isActive: true,
      }).returning();
      
      const newAdmin = inserted[0];
      if (!newAdmin) throw new Error("Failed to create admin user");
      adminId = newAdmin.id;
      logger.info(`✅ Administrateur créé (id=${adminId})`);
    }
    
    // Créer le tenant par défaut
    const existingTenant = await db.select().from(schema.tenants).where(eq(schema.tenants.slug, "default")).limit(1);
    let tenantId: number;
    
    if (existingTenant.length === 0) {
      const insertedTenant = await db.insert(schema.tenants).values({
        slug: "default",
        name: "ServiceCall Default",
        isActive: true,
        settings: {},
      }).returning();
      const newTenant = insertedTenant[0];
      if (!newTenant) throw new Error("Failed to create tenant");
      tenantId = newTenant.id;
      logger.info(`✅ Tenant par défaut créé (id=${tenantId})`);
    } else {
      const existingT = existingTenant[0];
      if (!existingT) throw new Error("Tenant record not found");
      tenantId = existingT.id;
      logger.info(`ℹ️  Tenant par défaut existe déjà (id=${tenantId})`);
    }
    
    // Lier l'admin au tenant
    const existingLink = await db.select().from(schema.tenantUsers)
      .where(eq(schema.tenantUsers.userId, adminId))
      .limit(1);
    
    if (existingLink.length === 0) {
      await db.insert(schema.tenantUsers).values({
        userId: adminId,
        tenantId: tenantId,
        role: "owner",
        isActive: true,
      });
      logger.info("✅ Admin lié au tenant");
    } else {
      logger.info("ℹ️  Lien admin-tenant déjà existant");
    }
    
    logger.info("\n========================================");
    logger.info("✅ COMPTE ADMIN CRÉÉ AVEC SUCCÈS");
    logger.info("========================================");
    logger.info(`  Email    : ${adminEmail}`);
    logger.info(`  Rôle     : admin`);
    logger.info(`  Tenant   : default (id=${tenantId})`);
    // ✅ BLOC 1: Ne jamais logger le mot de passe en clair
    logger.info("  Password : [défini via ADMIN_PASSWORD]");
    logger.info("========================================\n");
    
  } catch (error: any) {
    logger.error("❌ Erreur:", error);
    process.exit(1);
  } finally {
    await client.end();
  }
  
  process.exit(0);
}

main();
