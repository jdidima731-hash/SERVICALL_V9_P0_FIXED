/**
 * BUSINESS ENTITIES ROUTER
 * API pour la gestion des entités métier (produits, services, biens)
 * ⚠️ ISOLATION TENANT STRICTE
 */

import { z } from "zod";
import { tenantProcedure, router } from "../procedures";
import {
  createBusinessEntitySchema,
  updateBusinessEntitySchema,
  searchBusinessEntitiesSchema,
  idSchema,
} from "../validation/schemas";
import { businessKnowledgeService } from "../services/BusinessKnowledgeService";
import { logger } from "../infrastructure/logger";
import { TRPCError } from "@trpc/server";

// ============================================
// VALIDATION SCHEMAS
// ============================================

// Schémas importés depuis validation/schemas.ts

// ============================================
// ROUTER
// ============================================

export const businessEntitiesRouter = router({
  /**
   * Liste toutes les entités du tenant
   * GET /api/business-entities/list
   */
  list: tenantProcedure.query(async ({ ctx }) => {
    try {
      const tenantId = ctx.tenantId!;
      if (!tenantId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "No tenant context",
        });
      }

      const entities = await businessKnowledgeService.searchEntities(tenantId);

      logger.info("[BusinessEntitiesRouter] list", {
        tenantId,
        count: entities.length,
      });

      return {
        success: true,
        data: entities,
      };
    } catch (error: any) {
      logger.error("[BusinessEntitiesRouter] list error", { error });
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: error instanceof Error ? error.message : "Failed to list entities",
      });
    }
  }),

  /**
   * Recherche d'entités avec filtres
   * POST /api/business-entities/search
   */
  search: tenantProcedure
    .input(searchBusinessEntitiesSchema)
    .query(async ({ ctx, input }) => {
      try {
        const tenantId = ctx.tenantId!;
        if (!tenantId) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "No tenant context",
          });
        }

        const entities = await businessKnowledgeService.searchEntities(
          tenantId,
          input.query,
          input.type
        );

        logger.info("[BusinessEntitiesRouter] search", {
          tenantId,
          query: input.query,
          type: input.type,
          count: entities.length,
        });

        return {
          success: true,
          data: entities,
        };
      } catch (error: any) {
        logger.error("[BusinessEntitiesRouter] search error", { error });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : "Failed to search entities",
        });
      }
    }),

  /**
   * Récupère une entité par ID
   * GET /api/business-entities/:id
   */
  getById: tenantProcedure
    .input(z.object({ id: idSchema }))
    .query(async ({ ctx, input }) => {
      try {
        const tenantId = ctx.tenantId!;
        if (!tenantId) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "No tenant context",
          });
        }

        const entity = await businessKnowledgeService.getById(input.id, tenantId);

        if (!entity) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Entity not found",
          });
        }

        logger.info("[BusinessEntitiesRouter] getById", {
          tenantId,
          entityId: input.id,
        });

        return {
          success: true,
          data: entity,
        };
      } catch (error: any) {
        logger.error("[BusinessEntitiesRouter] getById error", { error });
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : "Failed to get entity",
        });
      }
    }),

  /**
   * Crée une nouvelle entité
   * POST /api/business-entities/create
   */
  create: tenantProcedure
    .input(createBusinessEntitySchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const tenantId = ctx.tenantId!;
        if (!tenantId) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "No tenant context",
          });
        }

        const entity = await businessKnowledgeService.createEntity({
          tenantId,
          type: input.type,
          title: input.title,
          description: input.description,
          price: input.price,
          vatRate: input.vatRate,
          availabilityJson: input.availabilityJson,
          metadataJson: input.metadataJson,
          isActive: input.isActive,
        });

        logger.info("[BusinessEntitiesRouter] create", {
          tenantId,
          entityId: entity.id,
        });

        return {
          success: true,
          data: entity,
        };
      } catch (error: any) {
        logger.error("[BusinessEntitiesRouter] create error", { error });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : "Failed to create entity",
        });
      }
    }),

  /**
   * Met à jour une entité existante
   * PUT /api/business-entities/:id
   */
  update: tenantProcedure
    .input(updateBusinessEntitySchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const tenantId = ctx.tenantId!;
        if (!tenantId) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "No tenant context",
          });
        }

        const { id, ...updateData } = input;

        const entity = await businessKnowledgeService.updateEntity(
          id,
          tenantId,
          updateData
        );

        logger.info("[BusinessEntitiesRouter] update", {
          tenantId,
          entityId: id,
        });

        return {
          success: true,
          data: entity,
        };
      } catch (error: any) {
        logger.error("[BusinessEntitiesRouter] update error", { error });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : "Failed to update entity",
        });
      }
    }),

  /**
   * Supprime une entité
   * DELETE /api/business-entities/:id
   */
  delete: tenantProcedure
    .input(z.object({ id: idSchema }))
    .mutation(async ({ ctx, input }) => {
      try {
        const tenantId = ctx.tenantId!;
        if (!tenantId) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "No tenant context",
          });
        }

        await businessKnowledgeService.deleteEntity(input.id, tenantId);

        logger.info("[BusinessEntitiesRouter] delete", {
          tenantId,
          entityId: input.id,
        });

        return {
          success: true,
          message: "Entity deleted successfully",
        };
      } catch (error: any) {
        logger.error("[BusinessEntitiesRouter] delete error", { error });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : "Failed to delete entity",
        });
      }
    }),

  /**
   * Récupère les entités disponibles (isActive = true)
   * GET /api/business-entities/available
   */
  getAvailable: tenantProcedure
    .input(z.object({ type: z.enum(["product", "service", "property", "room", "appointment", "menu_item", "other"]).optional() }))
    .query(async ({ ctx, input }) => {
      try {
        const tenantId = ctx.tenantId!;
        if (!tenantId) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "No tenant context",
          });
        }

        const entities = await businessKnowledgeService.getAvailable(
          tenantId,
          input.type
        );

        logger.info("[BusinessEntitiesRouter] getAvailable", {
          tenantId,
          type: input.type,
          count: entities.length,
        });

        return {
          success: true,
          data: entities,
        };
      } catch (error: any) {
        logger.error("[BusinessEntitiesRouter] getAvailable error", { error });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : "Failed to get available entities",
        });
      }
    }),
});
