#!/usr/bin/env tsx
/**
 * ✅ CORRECTION PRODUCTION-READY: Script d'initialisation admin idempotent
 */

import "dotenv/config";
import { getDbInstance } from "../db";
import { hashPassword, validatePasswordStrength } from "../services/passwordService";
import { logger } from "../infrastructure/logger";
import { nanoid } from "nanoid";
import * as readline from "readline";

interface AdminInput {
  email: string;
  password: string;
  name: string;
}

async function promptInput(question: string, hideInput: boolean = false): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise<string>((resolve) => {
    if (hideInput) {
      const stdin = process.stdin;
      if (stdin.isTTY) {
        stdin.setRawMode(true);
      }
      
      let password = '';
      process.stdout.write(question);
      
      const onData = (char: Buffer) => {
        const c = char.toString('utf8');
        
        switch (c) {
          case '\n':
          case '\r':
          case '\u0004':
            stdin.removeListener('data', onData);
            if (stdin.isTTY) {
              stdin.setRawMode(false);
            }
            stdin.pause();
            rl.close();
            process.stdout.write('\n');
            resolve(password);
            break;
          case '\u0003':
            process.exit();
            break;
          case '\u007f':
          case '\b':
            if (password.length > 0) {
              password = password.slice(0, -1);
              process.stdout.write('\b \b');
            }
            break;
          default:
            password += c;
            process.stdout.write('*');
            break;
        }
      };
      
      stdin.on('data', onData);
    } else {
      rl.question(question, (answer) => {
        rl.close();
        resolve(answer.trim());
      });
    }
  });
}

async function hasAdminUser(): Promise<boolean> {
  try {
    const { dbManager } = await import("../services/dbManager");
    await dbManager.initialize();
    
    const client = dbManager.client;
    if (!client) throw new Error("Database client not available");

    const result = await client`
      SELECT EXISTS (
        SELECT 1 FROM users WHERE role = 'admin' LIMIT 1
      ) as has_admin;
    `;

    const hasAdmin = result[0]?.['has_admin'] === true;
    logger.info("[InitAdmin] Vérification admin existant", { hasAdmin });
    return hasAdmin;
  } catch (error: unknown) {
    logger.error("[InitAdmin] Erreur lors de la vérification admin", { error });
    return false;
  }
}

async function getAdminInput(): Promise<AdminInput> {
  const envEmail = process.env['ADMIN_EMAIL'];
  const envPassword = process.env['ADMIN_PASSWORD'];
  const envName = process.env['ADMIN_NAME'];

  if (envEmail && envPassword && envName) {
    return { email: envEmail, password: envPassword, name: envName };
  }

  const defaultEmail = envEmail || "admin@servicall.io";
  const defaultPassword = envPassword || "ChangeMeNow!Dev#1";
  const defaultName = envName || "Administrateur";

  if (!process.stdin.isTTY) {
    return { email: defaultEmail, password: defaultPassword, name: defaultName };
  }

  logger.info("\n=== Initialisation Administrateur ===\n");
  const email = await promptInput(`Email administrateur [${defaultEmail}]: `) || defaultEmail;
  const name = await promptInput(`Nom complet [${defaultName}]: `) || defaultName;
  const password = await promptInput(`Mot de passe (min 8 caractères): `, true) || defaultPassword;

  return { email, password, name };
}

async function createAdmin(input: AdminInput): Promise<void> {
  const db = getDbInstance();
  if (!db) throw new Error("Database not available");

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(input.email)) throw new Error("Email invalide");

  const { users } = await import("../../drizzle/schema");
  const { eq } = await import("drizzle-orm");
  
  const existingUser = await db.select().from(users).where(eq(users.email, input.email)).limit(1);
  if (existingUser.length > 0) throw new Error(`L'utilisateur ${input.email} existe déjà`);

  const passwordHash = await hashPassword(input.password);
  const openId = nanoid();
  
  await db.insert(users).values({
    openId,
    email: input.email,
    name: input.name,
    passwordHash,
    loginMethod: "password",
    role: "admin",
    lastSignedIn: new Date(),
  });

  logger.info("[InitAdmin] ✅ Administrateur créé avec succès", { email: input.email });
}

async function createDefaultTenant(adminId: number): Promise<void> {
  try {
    const db = getDbInstance();
    if (!db) throw new Error("Database not available");

    const { tenants, tenantUsers } = await import("../../drizzle/schema");
    
    const [tenant] = await db.insert(tenants).values({
      slug: "default",
      name: "ServiceCall Default",
      isActive: true,
    }).returning();

    if (tenant) {
      await db.insert(tenantUsers).values({
        userId: adminId,
        tenantId: tenant.id,
        role: "owner",
        isActive: true,
      });
      logger.info("[InitAdmin] ✅ Tenant par défaut créé", { tenantId: tenant.id });
    }
  } catch (error: unknown) {
    logger.error("[InitAdmin] Erreur lors de la création du tenant", { error });
  }
}

async function main() {
  try {
    if (await hasAdminUser()) {
      logger.info("✅ Un administrateur existe déjà. Aucune action nécessaire.");
      process.exit(0);
    }

    const input = await getAdminInput();
    await createAdmin(input);

    const db = getDbInstance();
    if (db) {
      const { users } = await import("../../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      const [admin] = await db.select().from(users).where(eq(users.email, input.email)).limit(1);
      if (admin) await createDefaultTenant(admin.id);
    }

    process.exit(0);
  } catch (error: unknown) {
    logger.error("[InitAdmin] Erreur fatale", { error });
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { createAdmin, getAdminInput, hasAdminUser };
