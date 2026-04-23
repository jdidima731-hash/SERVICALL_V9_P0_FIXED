import { z } from "zod";
import { tenantProcedure } from "../procedures";
import { router } from "../_core/trpc";
import { CommandValidationService } from "../services/commandValidationService";
import { TRPCError } from "@trpc/server";

/**
 * Router pour la validation des commandes
 */

export const commandValidationRouter = router({
  /**
   * Valide automatiquement une commande (IA)
   */
  validateAutomatically: tenantProcedure
    .input(
      z.object({
        invoiceId: z.number().int().positive(),
      })
    )
    .mutation(async ({ input, ctx }: any) => {
      const { invoiceId } = input;

      // Vérifier les permissions
      const db = import("../db").then(m => m.getDbInstance());
      if (!db) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Database not available",
        });
      }

      const { customerInvoices } = await import("../../drizzle/schema");
      const { eq } = await import("drizzle-orm");

      const invoiceResults = await db
        .select()
        .from(customerInvoices)
        .where(eq(customerInvoices.id, invoiceId))
        .limit(1);

      if (invoiceResults.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Invoice not found",
        });
      }

      const invoice = invoiceResults[0] ?? undefined;
      if (!invoice) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Invoice not found after initial check",
        });
      }

      if (invoice.tenantId !== ctx.tenantId!) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You don't have access to this invoice",
        });
      }

      const result = await CommandValidationService.validateAutomatically(invoiceId);

      if (!result.success) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to validate automatically",
        });
      }

      return result;
    }),

  /**
   * Valide manuellement une commande (Humain)
   */
  validateManually: tenantProcedure
    .input(
      z.object({
        invoiceId: z.number().int().positive(),
        approved: z.boolean(),
        reason: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }: any) => {
      const { invoiceId, approved, reason } = input;

      // Vérifier les permissions
      const db = import("../db").then(m => m.getDbInstance());
      if (!db) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Database not available",
        });
      }

      const { customerInvoices } = await import("../../drizzle/schema");
      const { eq } = await import("drizzle-orm");

      const invoiceResults = await db
        .select()
        .from(customerInvoices)
        .where(eq(customerInvoices.id, invoiceId))
        .limit(1);

      if (invoiceResults.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Invoice not found",
        });
      }

      const invoice = invoiceResults[0] ?? undefined;
      if (!invoice) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Invoice not found after initial check",
        });
      }

      if (invoice.tenantId !== ctx.tenantId!) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You don't have access to this invoice",
        });
      }

      const success = await CommandValidationService.validateManually(
        invoiceId,
        ctx.user!.id,
        (ctx.user!.name || ctx.user!.email) ?? "Unknown",
        approved,
        reason
      );

      if (!success) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to validate manually",
        });
      }

      return {
        success: true,
        message: approved ? "Invoice approved" : "Invoice rejected",
      };
    }),

  /**
   * Récupère la validation d'une facture
   */
  getValidation: tenantProcedure
    .input(
      z.object({
        invoiceId: z.number().int().positive(),
      })
    )
    .query(async ({ input, ctx }: any) => {
      const { invoiceId } = input;

      // Vérifier les permissions
      const db = import("../db").then(m => m.getDbInstance());
      if (!db) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Database not available",
        });
      }

      const { customerInvoices } = await import("../../drizzle/schema");
      const { eq } = await import("drizzle-orm");

      const invoiceResults = await db
        .select()
        .from(customerInvoices)
        .where(eq(customerInvoices.id, invoiceId))
        .limit(1);

      if (invoiceResults.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Invoice not found",
        });
      }

      const invoice = invoiceResults[0] ?? undefined;
      if (!invoice) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Invoice not found after initial check",
        });
      }

      if (invoice.tenantId !== ctx.tenantId!) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You don't have access to this invoice",
        });
      }

      const validation = await CommandValidationService.getValidation(invoiceId);

      if (!validation) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Validation not found for this invoice",
        });
      }

      return validation;
    }),

  /**
   * Liste les validations en attente de revue humaine
   */
  listPendingReviews: tenantProcedure
    .input(
      z.object({
        limit: z.number().int().positive().max(100).default(50),
        offset: z.number().int().min(0).default(0),
      })
    )
    .query(async ({ input, ctx }: any) => {
      const { limit, offset } = input;

      const pendingReviews = await CommandValidationService.listPendingReviews(
        ctx.tenantId!,
        limit,
        offset
      );

      return {
        pendingReviews,
        total: pendingReviews.length,
      };
    }),

  /**
   * Récupère les statistiques de validation
   */
  getStatistics: tenantProcedure.query(async ({ ctx }) => {
    const stats = await CommandValidationService.getStatistics(ctx.tenantId!);

    if (!stats) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to get statistics",
      });
    }

    return stats;
  }),
});
