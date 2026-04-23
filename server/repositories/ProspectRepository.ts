import { BaseRepository, type Database } from "./BaseRepository";
import { prospects } from "../../drizzle/schema";
import { logger } from "../infrastructure/logger";

/**
 * ProspectRepository — Accès sécurisé aux prospects
 */

export type ProspectSelect = typeof prospects.$inferSelect;
export type ProspectInsert = typeof prospects.$inferInsert;

export class ProspectRepository extends BaseRepository<ProspectSelect> {
  constructor(db: Database) {
    super(db, prospects, prospects.tenantId);
  }

  /**
   * ✅ FIX P2.2: Créer un prospect avec validation atomique
   */
  async createProspect(
    tenantId: number,
    prospectData: Omit<ProspectInsert, 'tenantId'>
  ): Promise<ProspectSelect> {
    try {
      return await this.create(tenantId, prospectData as Partial<ProspectSelect>);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error("[ProspectRepository] Failed to create prospect", { tenantId, error: msg });
      throw error;
    }
  }

  /**
   * ✅ FIX P2.2: Mettre à jour le statut avec vérification tenant
   */
  async updateProspectStatus(
    prospectId: number,
    tenantId: number,
    newStatus: string
  ): Promise<ProspectSelect | null> {
    try {
      return await this.update(prospectId, tenantId, { status: newStatus } as Partial<ProspectSelect>);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error("[ProspectRepository] Failed to update prospect status", { prospectId, tenantId, error: msg });
      throw error;
    }
  }

  /**
   * ✅ FIX P2.2: Supprimer un prospect avec vérification tenant
   */
  async deleteProspect(prospectId: number, tenantId: number): Promise<boolean> {
    try {
      return await this.delete(prospectId, tenantId);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error("[ProspectRepository] Failed to delete prospect", { prospectId, tenantId, error: msg });
      throw error;
    }
  }
}
