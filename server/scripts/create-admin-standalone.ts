// ⚠️  AVERTISSEMENT : Ce script contient des identifiants par défaut.
// NE PAS UTILISER EN PRODUCTION. Utiliser reset-admin-password.ts avec ADMIN_PASSWORD.

import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";

const databaseUrl = process.env['DATABASE_URL'] || 'postgresql://postgres:postgres@localhost:5432/servicall';

async function main() {
  const client = postgres(databaseUrl, { max: 1 });
  const db = drizzle(client, { schema });  const adminEmail = process.env["ADMIN_EMAIL"];
  if (!adminEmail) throw new Error("[create-admin] ADMIN_EMAIL est requis. Ajoutez-la dans votre fichier .env.");
  const adminPassword = process.env["ADMIN_PASSWORD"];
  if (!adminPassword) throw new Error("[create-admin] ADMIN_PASSWORD est requis. Ajoutez-la dans votre fichier .env.");
  const adminName = "Administrateur";

  console.log("[Admin] Connexion à la base de données...");

  // Vérifier si admin existe
  const existing = await db.select().from(schema.users).where(eq(schema.users.email, adminEmail)).limit(1);
  
  if (existing.length > 0) {
    console.log("[Admin] ✅ Admin existe déjà:", adminEmail);
    // Mettre à jour le mot de passe
    const hash = await bcrypt.hash(adminPassword, 12);
    await db.update(schema.users).set({ passwordHash: hash, role: "admin" }).where(eq(schema.users.email, adminEmail));
    console.log("[Admin] ✅ Mot de passe mis à jour");
  } else {
    const hash = await bcrypt.hash(adminPassword, 12);
    const openId = nanoid();
    
    await db.insert(schema.users).values({
      openId,
      email: adminEmail,
      name: adminName,
      passwordHash: hash,
      loginMethod: "password",
      role: "admin",
      lastSignedIn: new Date(),
    });
    console.log("[Admin] ✅ Administrateur créé:", adminEmail);
  }

  // Créer tenant par défaut
  const existingTenant = await db.select().from(schema.tenants).where(eq(schema.tenants.slug, "default")).limit(1);
  let tenantId: number;
  
  if (existingTenant.length === 0) {
    const [t] = await db.insert(schema.tenants).values({
      slug: "default",
      name: "ServiceCall Default",
      isActive: true,
    }).returning();
    tenantId = t.id;
    console.log("[Admin] ✅ Tenant par défaut créé");
  } else {
    tenantId = existingTenant[0].id;
    console.log("[Admin] ✅ Tenant par défaut existe déjà");
  }

  // Lier admin au tenant
  const adminUser = await db.select().from(schema.users).where(eq(schema.users.email, adminEmail)).limit(1);
  if (adminUser.length > 0) {
    const existingLink = await db.select().from(schema.tenantUsers)
      .where(eq(schema.tenantUsers.userId, adminUser[0].id)).limit(1);
    
    if (existingLink.length === 0) {
      await db.insert(schema.tenantUsers).values({
        userId: adminUser[0].id,
        tenantId,
        role: "admin",
        isActive: true,
      });
      console.log("[Admin] ✅ Admin lié au tenant");
    } else {
      console.log("[Admin] ✅ Lien admin-tenant existe déjà");
    }
  }

  console.log("\n=== COMPTE ADMIN ===");
  console.log("Email:", adminEmail);
  console.log("Mot de passe: [masqué pour sécurité]");
  console.log("===================\n");

  await client.end();
}

main().catch(e => { console.error(e); process.exit(1); });
