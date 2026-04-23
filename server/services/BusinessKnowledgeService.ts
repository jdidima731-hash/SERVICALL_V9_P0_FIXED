/**
 * BUSINESS KNOWLEDGE SERVICE
 * Gestion des entités métier (produits, services, biens) avec isolation tenant stricte
 */

import { eq, and, sql } from "drizzle-orm";
import { getDbInstance } from "../db";
import * as schema from "../../drizzle/schema";
import { logger } from "../infrastructure/logger";

export interface BusinessEntityFilter {
  type?: string;
  isActive?: boolean;
  searchTerm?: string;
}

export interface BusinessEntityCreate {
  tenantId: number;
  type: string;
  title: string;
  description?: string;
  price?: number;
  vatRate?: number;
  availabilityJson?: Record<string, any>;
  metadataJson?: Record<string, any>;
  isActive?: boolean;
}

export interface BusinessEntityUpdate {
  type?: string;
  title?: string;
  description?: string;
  price?: number;
  vatRate?: number;
  availabilityJson?: Record<string, any>;
  metadataJson?: Record<string, any>;
  isActive?: boolean;
}

export class BusinessKnowledgeService {
  /**
   * Recherche d'entités avec filtres
   * ⚠️ ISOLATION TENANT STRICTE
   */
  async searchEntities(
    tenantId: number,
    query?: string,
    type?: string
  ): Promise<schema.BusinessEntity[]> {
    try {
      const db = getDbInstance();
      
      // Construction de la requête avec isolation tenant
      const conditions = [eq(schema.businessEntities.tenantId, tenantId)];
      
      if (type) {
        
        conditions.push(eq(schema.businessEntities.type, type as unknown));
      }
      
      if (query && query.trim()) {
        conditions.push(
          sql`(${schema.businessEntities.title} ILIKE ${`%${query}%`} OR ${schema.businessEntities.description} ILIKE ${`%${query}%`})`
        );
      }
      
      const results = await db
        .select()
        .from(schema.businessEntities)
        .where(and(...conditions))
        .orderBy(schema.businessEntities.title);
      
      logger.info("[BusinessKnowledgeService] searchEntities", {
        tenantId,
        query,
        type,
        count: results.length,
      });
      
      return results;
    } catch (error: any) {
      logger.error("[BusinessKnowledgeService] searchEntities error", {
        tenantId,
        error,
      });
      throw error;
    }
  }

  /**
   * Récupère toutes les entités d'un type spécifique
   * ⚠️ ISOLATION TENANT STRICTE
   */
  async getByType(tenantId: number, type: string): Promise<schema.BusinessEntity[]> {
    try {
      const db = getDbInstance();
      
      const results = await db
        .select()
        .from(schema.businessEntities)
        .where(
          and(
            eq(schema.businessEntities.tenantId, tenantId),
            
            eq(schema.businessEntities.type, type as unknown)
          )
        )
        .orderBy(schema.businessEntities.title);
      
      logger.info("[BusinessKnowledgeService] getByType", {
        tenantId,
        type,
        count: results.length,
      });
      
      return results;
    } catch (error: any) {
      logger.error("[BusinessKnowledgeService] getByType error", {
        tenantId,
        type,
        error,
      });
      throw error;
    }
  }

  /**
   * Récupère les entités disponibles (isActive = true)
   * ⚠️ ISOLATION TENANT STRICTE
   */
  async getAvailable(tenantId: number, type?: string): Promise<schema.BusinessEntity[]> {
    try {
      const db = getDbInstance();
      
      const conditions = [
        eq(schema.businessEntities.tenantId, tenantId),
        eq(schema.businessEntities.isActive, true),
      ];
      
      if (type) {
        
        conditions.push(eq(schema.businessEntities.type, type as unknown));
      }
      
      const results = await db
        .select()
        .from(schema.businessEntities)
        .where(and(...conditions))
        .orderBy(schema.businessEntities.title);
      
      logger.info("[BusinessKnowledgeService] getAvailable", {
        tenantId,
        type,
        count: results.length,
      });
      
      return results;
    } catch (error: any) {
      logger.error("[BusinessKnowledgeService] getAvailable error", {
        tenantId,
        type,
        error,
      });
      throw error;
    }
  }

  /**
   * Calcule le total d'une liste d'items
   */
  calculateTotal(items: Array<{ price?: number | string; quantity?: number }>): number {
    try {
      const total = items.reduce((sum, item) => {
        const price = typeof item.price === "string" ? parseFloat(item.price) : (item.price ?? 0);
        const quantity = item.quantity ?? 1;
        return sum + (price * quantity);
      }, 0);
      
      return Math.round(total * 100) / 100; // Arrondi à 2 décimales
    } catch (error: any) {
      logger.error("[BusinessKnowledgeService] calculateTotal error", { error });
      return 0;
    }
  }

  /**
   * Crée une nouvelle entité
   * ⚠️ ISOLATION TENANT STRICTE
   */
  async createEntity(data: BusinessEntityCreate): Promise<schema.BusinessEntity> {
    try {
      const db = getDbInstance();
      
      // Validation tenant_id
      if (!data.tenantId || data.tenantId <= 0) {
        throw new Error("Invalid tenantId");
      }
      
      const [result] = await db
        .insert(schema.businessEntities)
        
        .values({
          tenantId: data.tenantId,
          type: data.type as unknown,
          title: data.title,
          description: data.description,
          price: data.price?.toString(),
          vatRate: data.vatRate?.toString() || "20.00",
          availabilityJson: data.availabilityJson,
          metadataJson: data.metadataJson,
          isActive: data.isActive ?? true,
        })
        .returning();
      
      logger.info("[BusinessKnowledgeService] createEntity", {
        tenantId: data.tenantId,
        entityId: result.id,
        type: data.type,
      });
      
      return result;
    } catch (error: any) {
      logger.error("[BusinessKnowledgeService] createEntity error", {
        tenantId: data.tenantId,
        error,
      });
      throw error;
    }
  }

  /**
   * Met à jour une entité existante
   * ⚠️ ISOLATION TENANT STRICTE - Vérifie que l'entité appartient au tenant
   */
  async updateEntity(
    id: number,
    tenantId: number,
    data: BusinessEntityUpdate
  ): Promise<schema.BusinessEntity> {
    try {
      const db = getDbInstance();
      
      // Vérification de l'appartenance au tenant
      const existing = await db
        .select()
        .from(schema.businessEntities)
        .where(
          and(
            eq(schema.businessEntities.id, id),
            eq(schema.businessEntities.tenantId, tenantId)
          )
        )
        .limit(1);
      
      if (!existing || existing.length === 0) {
        throw new Error("Entity not found or access denied");
      }
      
      const updateData: any= {
        updatedAt: new Date(),
      };
      
      if (data.type !== undefined) updateData.type = data.type;
      if (data.title !== undefined) updateData.title = data.title;
      if (data.description !== undefined) updateData.description = data.description;
      if (data.price !== undefined) updateData.price = data.price.toString();
      if (data.vatRate !== undefined) updateData.vatRate = data.vatRate.toString();
      if (data.availabilityJson !== undefined) updateData.availabilityJson = data.availabilityJson;
      if (data.metadataJson !== undefined) updateData.metadataJson = data.metadataJson;
      if (data.isActive !== undefined) updateData.isActive = data.isActive;
      
      const [result] = await db
        .update(schema.businessEntities)
        .set(updateData)
        .where(
          and(
            eq(schema.businessEntities.id, id),
            eq(schema.businessEntities.tenantId, tenantId)
          )
        )
        .returning();
      
      logger.info("[BusinessKnowledgeService] updateEntity", {
        tenantId,
        entityId: id,
      });
      
      return result;
    } catch (error: any) {
      logger.error("[BusinessKnowledgeService] updateEntity error", {
        tenantId,
        entityId: id,
        error,
      });
      throw error;
    }
  }

  /**
   * Supprime une entité
   * ⚠️ ISOLATION TENANT STRICTE - Vérifie que l'entité appartient au tenant
   */
  async deleteEntity(id: number, tenantId: number): Promise<boolean> {
    try {
      const db = getDbInstance();
      
      // Vérification de l'appartenance au tenant avant suppression
      const result = await db
        .delete(schema.businessEntities)
        .where(
          and(
            eq(schema.businessEntities.id, id),
            eq(schema.businessEntities.tenantId, tenantId)
          )
        )
        .returning();
      
      if (!result || result.length === 0) {
        throw new Error("Entity not found or access denied");
      }
      
      logger.info("[BusinessKnowledgeService] deleteEntity", {
        tenantId,
        entityId: id,
      });
      
      return true;
    } catch (error: any) {
      logger.error("[BusinessKnowledgeService] deleteEntity error", {
        tenantId,
        entityId: id,
        error,
      });
      throw error;
    }
  }

  /**
   * Récupère une entité par ID avec vérification tenant
   * ⚠️ ISOLATION TENANT STRICTE
   */
  async getById(id: number, tenantId: number): Promise<schema.BusinessEntity | null> {
    try {
      const db = getDbInstance();
      
      const [result] = await db
        .select()
        .from(schema.businessEntities)
        .where(
          and(
            eq(schema.businessEntities.id, id),
            eq(schema.businessEntities.tenantId, tenantId)
          )
        )
        .limit(1);
      
      return result ?? null;
    } catch (error: any) {
      logger.error("[BusinessKnowledgeService] getById error", {
        tenantId,
        entityId: id,
        error,
      });
      throw error;
    }
  }
}

// Export singleton
export const businessKnowledgeService = new BusinessKnowledgeService();