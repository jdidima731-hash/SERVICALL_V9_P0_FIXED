/**
 * PROSPECT SERVICE — SERVICALL V8
 * ─────────────────────────────────────────────────────────────
 * Service canonique pour la gestion des prospects.
 * ✅ BLOC 2 FIX: Architecture API -> Service -> Domain -> Infra
 */

import { db, prospects } from "../db";
import { eq, and } from "drizzle-orm";

export class ProspectService {
  /**
   * Récupère un prospect par son ID
   */
  static async getById(id: number, tenantId: number) {
    const [prospect] = await db.select().from(prospects)
      .where(and(eq(prospects.id, id), eq(prospects.tenantId, tenantId)))
      .limit(1);
    return prospect || null;
  }

  /**
   * Liste les prospects d'un tenant
   */
  static async list(tenantId: number, limit: number = 50, offset: number = 0) {
    return await db.select().from(prospects)
      .where(eq(prospects.tenantId, tenantId))
      .limit(limit)
      .offset(offset);
  }
}
