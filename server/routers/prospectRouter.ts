/**
 * PROSPECT ROUTER
 * ✅ Optimized with Redis Caching
 * ✅ Centralized Validation from shared/validation/crm
 */

import { router } from "../_core/trpc";
import { tenantProcedure, adminProcedure } from "../procedures";
import * as db from "../db";
import { paginationInput, paginate } from "../_core/pagination";
import { count, eq, and } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { logger } from "../infrastructure/logger";
import { normalizeDbRecords, normalizeDbRecord } from "../_core/responseNormalizer";
import type { PaginatedResponse } from "../../shared/types/workflow";
import type { Prospect } from "../../shared/types/prospect";
import { cache, CACHE_KEYS } from "../services/cacheService";
import { 
  ProspectCreateSchema as createProspectSchema, 
  ProspectUpdateSchema as updateProspectSchema, 
  ProspectIdSchema as prospectIdSchema 
} from "../../shared/validation/crm";

export const prospectRouter = router({
  /**
   * Liste les prospects d'un tenant
   */
  list: tenantProcedure
    .input(paginationInput)
    .query(async ({ input, ctx }): Promise<PaginatedResponse<Prospect>> => {
      const { page, limit } = input;
      const offset = (page - 1) * limit;
      
      try {
        if (!ctx.tenantId) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "ID du tenant requis" });
        }
        const cacheKey = CACHE_KEYS.PROSPECT_LIST(ctx.tenantId!, page);
        const cached = await cache.get(cacheKey);
        if (cached) {
          logger.info("[Prospect Router] Returning cached list", { tenantId: ctx.tenantId!, page });
          return cached as PaginatedResponse<Prospect>;
        }

        logger.info("[Prospect Router] Listing prospects paginated", {
          tenantId: ctx.tenantId!,
          userId: ctx.user!.id,
          page,
          limit
        });

        const userId = ctx.user!.role === "agent" ? ctx.user!.id : undefined;
        
        const [results, totalResult] = await Promise.all([
          db.getProspectsByTenant(ctx.tenantId!, limit, offset, userId),
          db.db.select({ value: count() })
            .from(db.prospects)
            .where(
              userId 
                ? and(eq(db.prospects.tenantId, ctx.tenantId!), eq(db.prospects.assignedTo, userId))
                : eq(db.prospects.tenantId, ctx.tenantId!)
            )
        ]);
        
        const normalizedData = normalizeDbRecords(results || []) as unknown as Prospect[];
        const response = paginate(normalizedData, totalResult[0]?.value ?? 0, input);

        // Cache for 30s
        await cache.set(cacheKey, response, { ttl: 30 });
        
        return response;
      } catch (error: any) {
        logger.error("[Prospect Router] Error listing prospects", { error, tenantId: ctx.tenantId! });
        return paginate([], 0, input);
      }
    }),

  /**
   * Récupère un prospect par ID
   */
  getById: tenantProcedure
    .input(prospectIdSchema)
    .query(async ({ input, ctx }): Promise<Prospect> => {
      try {
        if (!ctx.tenantId) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Tenant ID manquant" });
        }

        const prospect = await db.getProspectById(input.prospectId, ctx.tenantId!);
        
        if (!prospect) {
          throw new TRPCError({ 
            code: "NOT_FOUND",
            message: `Prospect #${input.prospectId} non trouvé`
          });
        }

        if (ctx.user!.role === "agent" && prospect.assignedTo !== ctx.user!.id) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Vous n'avez pas accès à ce prospect"
          });
        }
        
        return normalizeDbRecord(prospect) as unknown as Prospect;
      } catch (error: any) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Erreur lors de la récupération du prospect",
        });
      }
    }),

  /**
   * Crée un nouveau prospect
   */
  create: tenantProcedure
    .input(createProspectSchema.omit({ tenantId: true } as unknown))
    .mutation(async ({ ctx, input }): Promise<Prospect> => {
      try {
        if (!ctx.tenantId) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "ID du tenant requis" });
        }
        logger.info("[Prospect Router] Creating prospect", { tenantId: ctx.tenantId! });
        
        const prospect = await db.createProspectOptimized(
          {
            ...input,
            tenantId: ctx.tenantId!,
          } as unknown
        );

        if (!prospect) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Échec de la création du prospect",
          });
        }

        // Invalidation du cache
        await cache.invalidate(`tenant:${ctx.tenantId!}:prospects:*`);
        await cache.invalidate(`tenant:${ctx.tenantId!}:dashboard:*`);
        
        return normalizeDbRecord(prospect) as unknown as Prospect;
      } catch (error: any) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Erreur lors de la création du prospect",
        });
      }
    }),

  /**
   * Met à jour un prospect
   */
  update: tenantProcedure
    .input(updateProspectSchema)
    .mutation(async ({ input, ctx }: any) => {
      const { prospectId, ...data } = input;

      try {
        if (!ctx.tenantId) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "ID du tenant requis" });
        }
        const prospect = await db.getProspectById(prospectId, ctx.tenantId!);
        if (!prospect) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Prospect non trouvé" });
        }

        if (ctx.user!.role === "agent" && prospect.assignedTo !== ctx.user!.id) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Accès refusé" });
        }

        const updated = await db.updateProspect(prospectId, data, ctx.tenantId!);

        // Invalidation du cache
        await cache.invalidate(`tenant:${ctx.tenantId!}:prospects:*`);
        await cache.invalidate(`tenant:${ctx.tenantId!}:dashboard:*`);

        return updated;
      } catch (error: any) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Erreur lors de la mise à jour",
        });
      }
    }),

  /**
   * Supprime un prospect
   */
  delete: adminProcedure
    .input(prospectIdSchema)
    .mutation(async ({ input, ctx }: any) => {
      try {
        if (!ctx.tenantId) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "ID du tenant requis" });
        }
        const prospect = await db.getProspectById(input.prospectId, ctx.tenantId!);
        if (!prospect) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Prospect non trouvé" });
        }
        const result = await db.deleteProspect(input.prospectId, ctx.tenantId!);

        // Invalidation du cache
        await cache.invalidate(`tenant:${ctx.tenantId!}:prospects:*`);
        await cache.invalidate(`tenant:${ctx.tenantId!}:dashboard:*`);

        return result;
      } catch (error: any) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Erreur lors de la suppression",
        });
      }
    }),

  /**
   * Get badge count for sidebar
   */
  getBadgeCount: tenantProcedure.query(async ({ ctx }) => {
    if (!ctx.tenantId) throw new TRPCError({ code: "BAD_REQUEST" });
    try {
      const userId = ctx.user!.role === "agent" ? ctx.user!.id : undefined;
      
      const result = await db.db.select({ value: count() })
        .from(db.prospects)
        .where(
          userId 
            ? and(eq(db.prospects.tenantId, ctx.tenantId!), eq(db.prospects.assignedTo, userId))
            : eq(db.prospects.tenantId, ctx.tenantId!)
        );
      
      return result[0]?.value ?? 0;
    } catch (error: any) {
      logger.error("[Prospect Router] Error getting badge count", { error });
      return 0;
    }
  }),
});
