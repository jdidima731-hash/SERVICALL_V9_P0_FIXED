import { router, tenantProcedure, publicProcedure } from "../procedures";
import { z } from "zod";
import { db, workflows, tenants } from "../db";
import { eq, and, desc } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { BlueprintCatalogService } from "../services/blueprintCatalogService";

export const blueprintMarketplaceRouter = router({
  /**
   * Liste tous les blueprints publics disponibles
   */
  listBlueprints: publicProcedure
    .input(z.object({
      category: z.string().optional(),
      limit: z.number().min(1).max(100).default(50),
      offset: z.number().default(0),
    }))
    .query(async ({ input }) => {
      // ✅ FIX P0: Utilisation du service de catalogue unique
      return await BlueprintCatalogService.list(input);
    }),

  /**
   * Importe un blueprint dans le tenant de l'utilisateur
   */
  importBlueprint: tenantProcedure
    .input(z.object({
      blueprintId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      // ✅ FIX P0: Utilisation du service d'import idempotent
      return await BlueprintCatalogService.import(input.blueprintId, ctx.tenantId!);
    }),

  /**
   * Publie un workflow du tenant vers la marketplace (nécessite admin)
   */
  publishToMarketplace: tenantProcedure
    .input(z.object({
      workflowId: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      const result = await db.update(workflows)
        .set({ isActive: true } as unknown)
        .where(and(
          eq(workflows.id, input.workflowId),
          eq(workflows.tenantId, ctx.tenantId!)
        ))
        .returning();

      if (result.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Workflow non trouvé ou accès refusé",
        });
      }

      return { success: true };
    }),
});
