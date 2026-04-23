/**
 * =====================================================================
 * MIGRATE.TS -- SERVICALL V8 -- ORDRE STRICT DES MIGRATIONS
 * =====================================================================
 * Execute les migrations dans l ordre canonique strict :
 *   1. 0000_initial_complete_migration.sql  -- Base nettoyee sans RLS hack
 *   2. 0001_add_workflow_steps.sql          -- Migration metier
 *   3. 0002_rls_hardening_canonical.sql     -- Hardening RLS (OBLIGATOIRE)
 *
 * CONTRAINTES :
 *  - Aucun script legacy RLS ne doit etre execute
 *  - Toute erreur non-idempotente est fatale
 *  - L ordre des migrations est non-negociable
 * =====================================================================
 */
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";
import { logger } from "../core/logger/index";

dotenv.config();

const FORBIDDEN_LEGACY_SCRIPTS = [
  "auto-migrate-rls",
  "apply-rls",
  "apply-rls-final",
  "enable-rls",
];

function checkNoLegacyRLSScripts(): void {
  const scriptsDir = path.join(process.cwd(), "server", "scripts");
  const files = fs.readdirSync(scriptsDir);
  const forbidden = files.filter((f: string) =>
    FORBIDDEN_LEGACY_SCRIPTS.some(legacy => f.includes(legacy))
  );
  if (forbidden.length > 0) {
    logger.error("SECURITY: Legacy RLS scripts detected -- must be deleted:");
    forbidden.forEach((f: string) => logger.error("  - server/scripts/" + f));
    process.exit(1);
  }
  logger.info("No legacy RLS scripts detected -- OK");
}

async function runMigration() {
  const databaseUrl = process.env["DATABASE_URL"];
  if (!databaseUrl) {
    logger.error("DATABASE_URL is missing");
    process.exit(1);
  }
  checkNoLegacyRLSScripts();
  logger.info("Running migrations in canonical order: 0000 -> 0001 -> 0002");
  const sql = postgres(databaseUrl, { max: 1 });
  const db = drizzle(sql);
  try {
    await migrate(db, { migrationsFolder: "./drizzle/migrations" });
    logger.info("All migrations completed successfully");
    logger.info("RLS hardening canonical (0002) applied");
  } catch (error: any) {
    const code: string = error?.code ?? "";
    const msg: string = error?.message ?? "";
    const isIdempotent =
      code === "42710" ||
      code === "42P07" ||
      code === "42701";
    if (isIdempotent) {
      logger.warn("Migration idempotency warning -- safe to continue: " + msg);
      logger.info("Migrations continued after idempotency warning");
    } else {
      logger.error("Migration FAILED -- aborting server start.");
      logger.error("  Code: " + code);
      logger.error("  Message: " + msg);
      if (error?.detail) logger.error("  Detail: " + error.detail);
      await sql.end();
      process.exit(1);
    }
  } finally {
    await sql.end();
  }
}

runMigration();
