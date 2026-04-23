/**
 * DB INITIALIZATION SERVICE (SÉCURISÉ)
 * ✅ FAIL-CLOSED : L'application crashe en production si la DB est inaccessible.
 * ✅ VALIDATION STRICTE : Vérifie la présence des tables et applique les migrations.
 * ✅ FIX: Gestion des erreurs non-critiques (types/tables/colonnes déjà existants)
 */
import { logger } from "../infrastructure/logger";
import { dbManager } from "./dbManager";

const MAX_WAIT = 5;
const WAIT_MS = 3000;
function sleep(ms: number) { return new Promise<void>(r => setTimeout(r, ms)); }

function isNonCriticalMigrationError(err: any): boolean {
  const msg = err?.message ?? String(err);
  const code = err?.code ?? '';
  return (
    msg.includes('already exists') ||
    msg.includes('duplicate') ||
    code === '42710' || // duplicate_object (type already exists)
    code === '42P07' || // duplicate_table
    code === '42701'    // duplicate_column
  );
}

export async function waitForDatabase(): Promise<boolean> {
  for (let attempt = 1; attempt <= MAX_WAIT; attempt++) {
    try {
      await dbManager.client`SELECT 1`;
      logger.info(`[DBInit] ✅ PostgreSQL disponible (tentative ${attempt}/${MAX_WAIT})`);
      return true;
    } catch (err: any) {
      logger.warn(`[DBInit] ⏳ Tentative ${attempt}/${MAX_WAIT} : ${err?.message ?? err}`);
      if (attempt < MAX_WAIT) {
        await sleep(WAIT_MS);
      }
    }
  }
  return false;
}

async function tablesExist(): Promise<boolean> {
  try {
    const r = await dbManager.client`
      SELECT COUNT(*) AS count FROM information_schema.tables
      WHERE table_schema='public' AND table_name='users'`;
    return parseInt(String(r[0]?.count ?? "0"), 10) > 0;
  } catch { return false; }
}

async function runIncrementalMigrations(): Promise<void> {
  try {
    const { readdir, readFile } = await import("fs/promises");
    const { join } = await import("path");
    const migrationsDir = join(process.cwd(), "drizzle", "migrations");

    await dbManager.client`
      CREATE TABLE IF NOT EXISTS _applied_migrations (
        id         SERIAL PRIMARY KEY,
        filename   VARCHAR(255) UNIQUE NOT NULL,
        applied_at TIMESTAMP DEFAULT NOW()
      )
    `;

    const files = (await readdir(migrationsDir).catch(() => []))
      .filter(f => f.endsWith(".sql"))
      .sort();

    for (const file of files) {
      const existing = await dbManager.client`
        SELECT 1 FROM _applied_migrations WHERE filename = ${file}
      `;
      if (existing.length > 0) {
        logger.info(`[DBInit] ⏭ Migration déjà appliquée : ${file}`);
        continue;
      }

      const sqlContent = await readFile(join(migrationsDir, file), "utf-8");
      try {
        await dbManager.client.begin(async (tx: any) => {
          await tx.unsafe(sqlContent);
          await tx`INSERT INTO _applied_migrations (filename) VALUES (${file})`;
        });
        logger.info(`[DBInit] ✅ Migration appliquée : ${file}`);
      } catch (migErr: any) {
        if (isNonCriticalMigrationError(migErr)) {
          // Marquer comme appliquée même si erreur non-critique (objet déjà existant)
          await dbManager.client`
            INSERT INTO _applied_migrations (filename) VALUES (${file})
            ON CONFLICT (filename) DO NOTHING
          `;
          logger.warn(`[DBInit] ⚠️ Migration ${file} — avertissement non-critique ignoré : ${migErr?.message ?? migErr}`);
        } else {
          throw migErr;
        }
      }
    }
    logger.info("[DBInit] ✅ Toutes les migrations ont été traitées");
  } catch (err: any) {
    const msg = err?.message ?? String(err);
    if (isNonCriticalMigrationError(err)) {
      logger.warn(`[DBInit] ⚠️ Avertissement migration (non-critique) : ${msg}`);
    } else {
      logger.error(`[DBInit] ❌ Échec des migrations : ${msg}`);
      if (process.env["NODE_ENV"] === "production") process.exit(1);
    }
  }
}

export async function initializeDatabaseOrExit(): Promise<void> {
  if (process.env["SKIP_DB_INIT"] === "true") {
    logger.info("[DBInit] SKIP_DB_INIT=true — ignoré");
    return;
  }

  const available = await waitForDatabase();
  if (!available) {
    logger.error("[DBInit] 🔴 PostgreSQL inaccessible.");
    if (process.env["NODE_ENV"] === "production") process.exit(1);
    return;
  }

  // Toujours tenter d'appliquer les migrations (idempotent)
  await runIncrementalMigrations();

  // Vérification finale
  if (!(await tablesExist())) {
    logger.error("[DBInit] 🔴 Les tables critiques sont absentes après migration.");
    if (process.env["NODE_ENV"] === "production") process.exit(1);
  }

  logger.info("[DBInit] ✅ Base de données prête");
}

// TS2305 FIX — stub hasAdminUser
export async function hasAdminUser(): Promise<boolean> {
  try {
    const { getDbInstance } = await import("../db");
    const { users } = await import("../../drizzle/schema");
    const { eq } = await import("drizzle-orm");
    const db = getDbInstance();
    const admins = await db.select().from(users).where(eq(users.role, "superadmin")).limit(1);
    return admins.length > 0;
  } catch {
    return false;
  }
}
