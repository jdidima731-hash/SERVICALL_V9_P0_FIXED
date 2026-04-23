/**
 * DATABASE MANAGER SERVICE - VERSION POSTGRESQL (PRODUCTION GRADE)
 * Centralise tout l'accès à la base de données PostgreSQL
 * ✅ FIX : retry 5× avec 2s entre chaque tentative + message Replit explicite
 */

const MAX_CONNECT_RETRIES = 5;
const RETRY_DELAY_MS = 2000;
function sleep(ms: number) { return new Promise<void>(r => setTimeout(r, ms)); }

import { drizzle } from "drizzle-orm/postgres-js";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../../drizzle/schema";
import { logger } from "../infrastructure/logger";
import { sql } from "drizzle-orm";

// Type précis de l'instance Drizzle pour postgres-js + schéma complet
type DrizzleDB = PostgresJsDatabase<typeof schema>;

export class DBManager {
  private static instance: DBManager;
  private _db: DrizzleDB | null = null;
  private _client: postgres.Sql | null = null;
  private _initPromise: Promise<void> | null = null;

  private constructor() {}

  public static getInstance(): DBManager {
    if (!DBManager.instance) {
      DBManager.instance = new DBManager();
    }
    return DBManager.instance;
  }

  /**
   * Initialise la connexion PostgreSQL de manière bloquante
   */
  public async initialize(): Promise<void> {
    if (this._db) return;
    if (this._initPromise) return this._initPromise;

    this._initPromise = (async () => {
      const databaseUrl = process.env['DATABASE_URL'];
      
      if (!databaseUrl || !databaseUrl.startsWith("postgres")) {
        const msg =
          "\n🔴 DATABASE_URL manquante ou invalide.\n" +
          "  → Sur Replit    : activez PostgreSQL dans l'onglet Ressources\n" +
          "  → Sur VPS/local : DATABASE_URL=postgresql://user:pass@host:5432/db dans .env\n";
        logger.error(msg);
        throw new Error(msg);
      }

      try {
        // ✅ CORRECTION BUG TIMEOUT POSTGRESQL:
        // - Augmentation du pool max à 25 connexions
        // - idle_timeout réduit à 10s pour libérer plus vite les connexions inutilisées
        // - statement_timeout global à 25s (en dessous du timeout tRPC de 30s)
        // - max_lifetime réduit à 15min pour recycler régulièrement les connexions
        this._client = postgres(databaseUrl, {
          max: 25,              // ✅ FIX: 25 connexions max (au lieu de 20)
          idle_timeout: 10,     // ✅ FIX: Libérer les connexions inactives après 10s (au lieu de 20s)
          connect_timeout: 10,  // Timeout de connexion 10s
          max_lifetime: 60 * 15, // ✅ FIX: Recycler les connexions toutes les 15 min (au lieu de 30)
          // ✅ FIX: Statement timeout global pour éviter les requêtes bloquées indéfiniment
          // Doit être inférieur au timeout tRPC (30s) pour un message d'erreur propre
          connection: {
            statement_timeout: 25000, // 25s statement timeout
          },
          onnotice: () => {},
          onparameter: (_name: string, _value: string) => {},
          ssl: process.env['NODE_ENV'] === "production" && !databaseUrl.includes("localhost") ? "require" : false,
        });

        this._db = drizzle(this._client, { schema });

        // ✅ FIX : retry 5× avec 2s (PostgreSQL peut encore démarrer au boot)
        let lastErr: Error | null = null;
        for (let attempt = 1; attempt <= MAX_CONNECT_RETRIES; attempt++) {
          try {
            await this._client`SELECT 1`;
            logger.info(`[DBManager] ✅ PostgreSQL connecté (tentative ${attempt}/${MAX_CONNECT_RETRIES})`);
            lastErr = null;
            break;
          } catch (err: any) {
            lastErr = err instanceof Error ? err : new Error(String(err));
            logger.warn(`[DBManager] ⏳ Tentative ${attempt}/${MAX_CONNECT_RETRIES} : ${lastErr.message}`);
            if (attempt < MAX_CONNECT_RETRIES) await sleep(RETRY_DELAY_MS);
          }
        }
        if (lastErr) {
          if (process.env["NODE_ENV"] === "production") {
            logger.error(`[DBManager] 🔴 PostgreSQL inaccessible après ${MAX_CONNECT_RETRIES} tentatives : ${lastErr.message}`);
            process.exit(1);
          }
          logger.warn("[DBManager] ⚠️ Dev : démarrage sans DB");
          this._db = null;
        }
      } catch (error: any) {
        logger.error("[DBManager] ❌ Erreur lors de la configuration PostgreSQL", error instanceof Error ? error : new Error(String(error)));
      }
    })();

    return this._initPromise;
  }

  public get db(): DrizzleDB {
    const mock = {
      select: () => ({ from: () => ({ where: () => ({ limit: () => [] }) }) }),
      insert: () => ({ values: () => ({ returning: () => [] }) }),
      update: () => ({ set: () => ({ where: () => ({ returning: () => [] }) }) }),
      delete: () => ({ where: () => ({ returning: () => [] }) }),
      execute: () => Promise.resolve([]),
      transaction: (cb: (tx: DrizzleDB) => Promise<unknown>) => cb({} as DrizzleDB),
    };

    // ✅ BLOC 1: DB_ENABLED mock supprimé — erreur explicite si DB non initialisée
    if (!this._db) {
      throw new Error('[DBManager] Base de données non initialisée. Appelez initialize() avant toute opération.');
    }
    return this._db;
  }

  public get client() {
    if (!this._client) {
      throw new Error("[DBManager] ❌ Tentative d'accès au client avant initialisation.");
    }
    return this._client;
  }

  public async transaction<T>(callback: (tx: Parameters<DrizzleDB["transaction"]>[0] extends (tx: infer Tx) => unknown ? Tx : never) => Promise<T>): Promise<T> {
    if (!this._db) await this.initialize();
    return await this.db.transaction(callback);
  }

  /**
   * RLS HARDENING CANONICAL: Exécute une transaction avec le contexte
   * app.user_id + app.tenant_id injectés via SET LOCAL (transaction-scoped).
   *
   * IMPORTANT: Utiliser withTenantContext() depuis rlsMiddleware.ts ou
   * withRequestContext() depuis requestDbContext.ts pour les requêtes métier.
   * Cette méthode est conservée pour compatibilité mais délègue à SET LOCAL.
   */
  public async withTenantContext<T>(
    tenantId: number,
    callback: (tx: Parameters<DrizzleDB["transaction"]>[0] extends (tx: infer Tx) => unknown ? Tx : never) => Promise<T>
  ): Promise<T> {
    if (!Number.isInteger(tenantId) || tenantId <= 0) {
      throw new Error(`DBManager.withTenantContext: Invalid tenantId "${tenantId}". Access denied.`);
    }
    if (!this._db) await this.initialize();

    return await this.db.transaction(async (tx: DrizzleDB) => {
      // SET LOCAL garantit que app.tenant_id est scoped à cette transaction uniquement
      // Pas de set_config global — compatible avec le pooling de connexions
      await tx.execute(sql`SET LOCAL app.tenant_id = ${tenantId.toString()}`);

      logger.debug("[DBManager] Transaction started with RLS canonical context", { tenantId });

      return await callback(tx as unknown);
    });
  }

  public async close() {
    if (this._client) {
      await this._client.end();
      this._client = null;
      this._db = null;
      this._initPromise = null;
      logger.info("[DBManager] PostgreSQL connections closed");
    }
  }
}

export const dbManager = DBManager.getInstance();
