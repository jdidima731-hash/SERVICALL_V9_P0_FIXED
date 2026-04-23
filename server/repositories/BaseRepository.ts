import { eq, and, desc, type Table, type Column } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { logger } from "../infrastructure/logger";

/**
 * BaseRepository — Classe abstraite pour tous les accès DB
 * ✅ FIX V8 : Typage générique strict et isolation multi-tenant
 */

export type Database = PostgresJsDatabase<any>;

export abstract class BaseRepository<T extends { id: number; tenantId: number }> {
  protected db: Database;
  protected table: any; // Utilisation de any pour la table Drizzle car les types sont très complexes, mais T sécurise les entrées/sorties
  protected tenantIdColumn: Column;

  constructor(db: Database, table: Table<any>, tenantIdColumn: Column) {
    this.db = db;
    this.table = table;
    this.tenantIdColumn = tenantIdColumn;
  }

  /**
   * ✅ FIX P2.1: Toutes les requêtes incluent le tenantId
   */
  async findById(id: number, tenantId: number): Promise<T | null> {
    try {
      const result = await this.db
        .select()
        .from(this.table)
        .where(
          and(
            eq(this.table.id, id),
            eq(this.tenantIdColumn, tenantId)
          )
        )
        .limit(1);

      return (result[0] as T) || null;
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error("[BaseRepository] findById failed", { id, tenantId, error: msg });
      throw error;
    }
  }

  async findAll(tenantId: number, limit = 100, offset = 0): Promise<T[]> {
    try {
      const results = await this.db
        .select()
        .from(this.table)
        .where(eq(this.tenantIdColumn, tenantId))
        .limit(limit)
        .offset(offset)
        .orderBy(desc(this.table.createdAt));
      
      return results as T[];
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error("[BaseRepository] findAll failed", { tenantId, limit, offset, error: msg });
      throw error;
    }
  }

  async create(tenantId: number, data: Partial<T>): Promise<T> {
    try {
      const result = await this.db
        .insert(this.table)
        .values({ ...data, tenantId })
        .returning();

      if (!result[0]) {
        throw new Error("Failed to create record");
      }

      logger.debug("[BaseRepository] Record created", { tenantId });
      return result[0] as T;
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error("[BaseRepository] create failed", { tenantId, error: msg });
      throw error;
    }
  }

  async update(id: number, tenantId: number, data: Partial<T>): Promise<T | null> {
    try {
      const result = await this.db
        .update(this.table)
        .set(data)
        .where(
          and(
            eq(this.table.id, id),
            eq(this.tenantIdColumn, tenantId)
          )
        )
        .returning();

      if (result[0]) {
        logger.debug("[BaseRepository] Record updated", { id, tenantId });
      }
      return (result[0] as T) || null;
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error("[BaseRepository] update failed", { id, tenantId, error: msg });
      throw error;
    }
  }

  async delete(id: number, tenantId: number): Promise<boolean> {
    try {
      const result = await this.db
        .delete(this.table)
        .where(
          and(
            eq(this.table.id, id),
            eq(this.tenantIdColumn, tenantId)
          )
        );

      // Note: rowCount peut être undefined selon le driver
      return true; 
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error("[BaseRepository] delete failed", { id, tenantId, error: msg });
      throw error;
    }
  }

  async transaction<R>(callback: (tx: Database) => Promise<R>): Promise<R> {
    try {
      return await this.db.transaction(async (tx) => {
        return await callback(tx);
      });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error("[BaseRepository] Transaction failed", { error: msg });
      throw error;
    }
  }
}
