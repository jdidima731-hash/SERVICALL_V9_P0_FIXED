/**
 * QUERY BUSINESS ENTITIES ACTION
 * Action workflow pour interroger les entités métier (produits, services, biens)
 */

import type { FinalExecutionContext } from '../structured-types';
import { businessKnowledgeService } from "../../services/BusinessKnowledgeService";
import { logger } from "../../lib/logger";

export interface QueryBusinessEntitiesConfig {
  type?: string; // Type d'entité (product, service, room, etc.)
  search_term?: string; // Terme de recherche
  filters?: {
    isActive?: boolean;
    minPrice?: number;
    maxPrice?: number;
  };
}

export interface QueryBusinessEntitiesResult {
  success: boolean;
  results: Record<string, unknown>[];
  total?: number;
  message?: string;
}

export class QueryBusinessEntitiesAction {
  name = "query_business_entities";

  /**
   * Exécute la recherche d'entités métier
   * ⚠️ ISOLATION TENANT STRICTE via context.tenantId
   */
  async execute(
    context: FinalExecutionContext,
    config: QueryBusinessEntitiesConfig
  ): Promise<QueryBusinessEntitiesResult> {
    try {
      // Validation du tenantId dans le contexte
      const tenantId = (context.event as { tenant_id?: number }).tenant_id ?? context.tenant?.id;
      if (!tenantId) {
        logger.error("[QueryBusinessEntitiesAction] Missing tenantId in context");
        return {
          success: false,
          results: [],
          message: "Missing tenant context",
        };
      }

      const { type, search_term, filters } = config;

      // Recherche des entités
      let results = await businessKnowledgeService.searchEntities(
        tenantId,
        search_term,
        type
      );

      // Application des filtres additionnels
      if (filters) {
        if (filters.isActive !== undefined) {
          results = results.filter((entity) => entity.isActive === filters.isActive);
        }

        if (filters.minPrice !== undefined) {
          results = results.filter((entity) => {
            const price = typeof entity.price === "string" 
              ? parseFloat(entity.price) 
              : entity.price;
            return price !== null && price !== undefined && price >= filters.minPrice!;
          });
        }

        if (filters.maxPrice !== undefined) {
          results = results.filter((entity) => {
            const price = typeof entity.price === "string" 
              ? parseFloat(entity.price) 
              : entity.price;
            return price !== null && price !== undefined && price <= filters.maxPrice!;
          });
        }
      }

      logger.info("[QueryBusinessEntitiesAction] Query executed", {
        tenantId,
        type,
        search_term,
        resultCount: results.length,
      });

      return {
        success: true,
        results: results.map((entity) => ({
          id: entity.id,
          type: entity.type,
          title: entity.title,
          description: entity.description,
          price: entity.price,
          availability: entity.availabilityJson,
          metadata: entity.metadataJson,
          isActive: entity.isActive,
        })),
        total: results.length,
        message: results.length > 0 
          ? `Found ${results.length} result(s)` 
          : "No results found",
      };
    } catch (error: unknown) {
      logger.error("[QueryBusinessEntitiesAction] Execution error", {
        config,
        error,
      });

      return {
        success: false,
        results: [],
        message: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Valide la configuration de l'action
   */
  validate(config: QueryBusinessEntitiesConfig): boolean {
    // Validation optionnelle : tous les paramètres sont facultatifs
    if (config.filters) {
      if (
        config.filters.minPrice !== undefined &&
        config.filters.maxPrice !== undefined &&
        config.filters.minPrice > config.filters.maxPrice
      ) {
        logger.error("[QueryBusinessEntitiesAction] Invalid config: minPrice > maxPrice");
        return false;
      }
    }

    return true;
  }
}

export default QueryBusinessEntitiesAction;
