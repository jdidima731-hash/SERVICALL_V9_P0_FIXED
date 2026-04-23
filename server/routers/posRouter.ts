/**
 * POS ROUTER
 * API pour la configuration et la gestion des systèmes de caisse (POS)
 */

import { z } from "zod";
import { router } from "../procedures";
import { tenantProcedure, adminProcedure } from "../procedures";
import { TRPCError } from "@trpc/server";
import { posConnectorService } from "../services/POSConnectorService";
import { db } from "../db";
import { tenants, posOrders } from "../../drizzle/schema";
import { eq, desc } from "drizzle-orm";
import { logger } from "../infrastructure/logger";
import { POSConfigSchema, mapToPOSConfig } from "../../shared/validation/jsonb-business-config";

// Schéma de validation pour la config POS
const posConfigSchema = z.object({
  apiKey: z.string().optional(),
  accessToken: z.string().optional(),
  clientId: z.string().optional(),
  clientSecret: z.string().optional(),
  merchantId: z.string().optional(),
  apiUrl: z.string().url().optional(),
});

export const posRouter = router({
  /**
   * Récupérer la configuration POS actuelle
   */
  getConfig: tenantProcedure
    .output(z.object({
      provider: z.string(),
      syncEnabled: z.boolean(),
      config: POSConfigSchema,
    }))
    .query(async ({ ctx }) => {
      if (!ctx.tenantId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Tenant ID is required" });
      }
      const tenant = await db.select().from(tenants).where(eq(tenants.id, ctx.tenantId!)).limit(1);
      
      if (!tenant || tenant.length === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Tenant introuvable" });
      }

      return {
        provider: tenant[0].posProvider ?? "none",
        syncEnabled: tenant[0].posSyncEnabled ?? false,
        config: mapToPOSConfig(tenant[0].posConfig),
      };
    }),

  /**
   * Mettre à jour la configuration POS
   */
  updateConfig: adminProcedure
    .input(z.object({
      provider: z.enum(["lightspeed", "sumup", "zettle", "square", "tiller", "none"]),
      syncEnabled: z.boolean(),
      config: posConfigSchema,
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        if (!ctx.tenantId) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Tenant ID is required" });
        }
        await db.update(tenants)
          .set({
            posProvider: input.provider,
            posSyncEnabled: input.syncEnabled,
            posConfig: input.config,
          })
          .where(eq(tenants.id, ctx.tenantId!));

        logger.info("[POSRouter] Config updated", { tenantId: ctx.tenantId!, provider: input.provider });
        return { success: true };
      } catch (error: any) {
        logger.error("[POSRouter] Failed to update config", { tenantId: ctx.tenantId!, error });
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Échec de la mise à jour de la configuration POS" });
      }
    }),

  /**
   * Tester la connexion avec le provider sélectionné
   */
  testConnection: adminProcedure
    .input(z.object({
      provider: z.string(),
      config: posConfigSchema,
    }))
    .mutation(async ({ input }: any) => {
      try {
        const success = await posConnectorService.testConnection(input.provider, input.config);
        return { success };
      } catch (error: any) {
        return { success: false, error: error instanceof Error ? error.message : String(error) };
      }
    }),

  /**
   * Récupérer l'historique des synchronisations de commandes
   */
  getSyncHistory: tenantProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).default(20),
      offset: z.number().min(0).default(0),
    }))
    .query(async ({ ctx, input }) => {
      if (!ctx.tenantId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Tenant ID is required" });
      }
      const history = await db.select()
        .from(posOrders)
        .where(eq(posOrders.tenantId, ctx.tenantId!))
        .orderBy(desc(posOrders.createdAt))
        .limit(input.limit)
        .offset(input.offset);

      return { history };
    }),

  /**
   * Synchroniser manuellement une commande vers le POS
   */
  syncManualOrder: adminProcedure
    .input(z.object({
      crmOrderId: z.string(),
      items: z.array(z.object({
        id: z.string(),
        name: z.string(),
        quantity: z.number(),
        price: z.number(),
        vatRate: z.number(),
      })),
      totalAmount: z.number(),
      vatAmount: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenantId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Tenant ID is required" });
      }
      // 1. Récupérer la config du tenant
      const tenant = await db.select().from(tenants).where(eq(tenants.id, ctx.tenantId!)).limit(1);
      if (!tenant[0]?.posProvider || tenant[0].posProvider === "none") {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Aucun système POS configuré" });
      }

      // 2. Appeler le service de synchronisation
      const result = await posConnectorService.syncOrder(
        tenant[0].posProvider,
        tenant[0].posConfig,
        {
          id: input.crmOrderId,
          tenantId: ctx.tenantId!,
          items: input.items,
          totalAmount: input.totalAmount,
          vatAmount: input.vatAmount,
        }
      );

      // 3. Enregistrer dans l'historique (isolation tenant garantie par l'insertion)
      await db.insert(posOrders).values({
        tenantId: ctx.tenantId!,
        crmOrderId: input.crmOrderId,
        posOrderId: result.posOrderId ?? null,
        provider: tenant[0].posProvider,
        status: result.success ? "synced" : "failed",
        totalAmount: input.totalAmount.toString(),
        vatAmount: input.vatAmount.toString(),
        syncLog: result.error ? { error: result.error } : null,
      });

      return result;
    }),
});
