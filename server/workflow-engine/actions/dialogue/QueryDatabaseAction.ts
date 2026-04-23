/**
 * FIX SÉCURITÉ APPLIQUÉ:
 *
 * CRIT-2: sql.raw(key) — injection SQL sur les noms de colonnes
 *   Avant (ligne 44): whereSql = sql`${whereSql} AND ${sql.raw(key)} = ${value}`;
 *          key vient du config workflow (entrée externe) → injection SQL possible.
 *   Après: validation regex + whitelist avant tout usage dans sql.raw().
 *          Colonnes sensibles (password, token, secret...) explicitement interdites.
 *          Nombre de conditions limité à 5.
 *          Limite de résultats plafonnée à 100.
 */

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../../../drizzle/schema";
import { sql } from "drizzle-orm";
import { logger } from "../../lib/logger";

export interface QueryDatabaseConfig {
  table: string;
  query: Record<string, unknown>;
  limit?: number;
}

// Colonnes INTERDITES même si la table est autorisée
const FORBIDDEN_COLUMNS = new Set([
  'password', 'password_hash', 'secret', 'token', 'api_key', 'auth_token',
  'access_token', 'refresh_token', 'waba_access_token', 'twilio_auth_token',
  'stripe_secret_key', 'openai_api_key', 'private_key', 'encryption_key',
  'salt', 'hash', 'otp_secret', 'two_factor_secret',
]);

// Regex stricte: lettres, chiffres, underscore uniquement, commence par lettre/underscore
const SAFE_IDENTIFIER_RE = /^[a-zA-Z_][a-zA-Z0-9_]{0,62}$/;

function isColumnSafe(name: string): boolean {
  if (!SAFE_IDENTIFIER_RE.test(name)) return false;
  if (FORBIDDEN_COLUMNS.has(name.toLowerCase())) return false;
  return true;
}

function isTableSafe(name: string): boolean {
  return SAFE_IDENTIFIER_RE.test(name);
}

export class QueryDatabaseAction {
  private db: ReturnType<typeof drizzle<typeof schema>>;

  constructor(connectionString?: string) {
    const connStr =
      connectionString ||
      process.env['DATABASE_URL'] ||
      process.env['DATABASE_URL'] || (() => { throw new Error("DATABASE_URL environment variable is required"); })();
    const client = postgres(connStr);
    this.db = drizzle(client, { schema });
  }

  async execute(config: QueryDatabaseConfig, _context: Record<string, unknown>): Promise<unknown> {
    try {
      const { table, query, limit = 10 } = config;

      // 1. Whitelist table via schéma Drizzle + validation du nom
      const allowedTables = Object.keys(schema);
      if (!allowedTables.includes(table) || !isTableSafe(table)) {
        return { success: false, error: `Table "${table}" not found or not allowed` };
      }

      const entries = Object.entries(query);

      // 2. Limiter le nombre de conditions (prévention d'abus)
      if (entries.length > 5) {
        return { success: false, error: "Too many query conditions (max 5)" };
      }

      // 3. FIX CRIT-2: Valider CHAQUE nom de colonne avant sql.raw()
      for (const [key] of entries) {
        if (!isColumnSafe(key)) {
          logger.warn("[QueryDatabaseAction] Unsafe column name rejected", { table, column: key });
          return { success: false, error: `Column name "${key}" is not allowed` };
        }
      }

      // 4. Construire la requête — sql.raw() est sûr car chaque key est validé ci-dessus
      let whereSql = sql`1=1`;
      for (const [key, value] of entries) {
        // key est garanti: seulement [a-zA-Z0-9_], pas de mot-clé SQL dangereux
        whereSql = sql`${whereSql} AND ${sql.raw(key)} = ${value}`;
      }

      // 5. Plafond à 100 résultats max
      const safeLimit = Math.min(Math.max(1, limit), 100);

      const results = await this.db.execute(
        sql`SELECT * FROM ${sql.raw(table)} WHERE ${whereSql} LIMIT ${safeLimit}`
      );

      const rows = Array.isArray(results) ? results : (results as { rows?: unknown[] }).rows ?? [];

      return { success: true, table, results: rows, count: rows.length };
    } catch (error: unknown) {
      logger.error("Error in QueryDatabaseAction:", error);
      return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
  }
}

export default QueryDatabaseAction;
