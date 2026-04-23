import { z } from "zod";
import { router, tenantProcedure, publicProcedure } from "../procedures";
import { TRPCError } from "@trpc/server";
import { InvoiceService } from "../services/invoiceService";
import { logger } from "../infrastructure/logger";
import { AuditService } from "../services/auditService";
import { getStripeForTenant } from "../services/stripeService";
import * as db from "../db";

/**
 * Router pour la gestion des paiements Stripe BYOK
 * Permet aux clients de payer les factures sans authentification
 */
export const paymentRouter = router({
  /**
   * Récupère la clé publique Stripe pour un tenant (via token facture)
   * Endpoint PUBLIC
   */
  getStripePublicKey: publicProcedure
    .input(
      z.object({
        token: z.string(), // Token de sécurité de la facture
      })
    )
    .query(async ({ input }: any) => {
      try {
        const { token } = input;

        // Valider le token et récupérer la facture
        const validation = await InvoiceService.validateSecureLink(token);
        if (!validation.valid || !validation.invoiceId) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Invalid or expired token",
          });
        }

        const invoice = await InvoiceService.getInvoiceById(validation.invoiceId);
        if (!invoice) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Invoice not found",
          });
        }

        // Récupérer la clé publique du tenant
        const publicKey = await getStripeForTenant(invoice.tenantId);

        return {
          success: true,
          publicKey,
        };
      } catch (error: any) {
        logger.error("[PaymentRouter] Failed to get Stripe public key", { error });
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to get Stripe configuration",
        });
      }
    }),

  /**
   * Crée une Payment Intent Stripe pour une facture
   * Endpoint PUBLIC
   */
  createPaymentIntent: publicProcedure
    .input(
      z.object({
        invoiceId: z.number().int().positive(),
        token: z.string(), // Token de sécurité de la facture
      })
    )
    .mutation(async ({ input }: any) => {
      try {
        const result = await InvoiceService.createPaymentIntent(input.invoiceId, input.token);
        return {
          success: true,
          ...result,
        };
      } catch (error: any) {
        logger.error("[PaymentRouter] Failed to create payment intent", { error });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message || "Failed to create payment intent",
        });
      }
    }),

  /**
   * Confirme le paiement après succès Stripe
   * Endpoint PUBLIC
   */
  confirmPayment: publicProcedure
    .input(
      z.object({
        invoiceId: z.number().int().positive(),
        paymentIntentId: z.string(),
        token: z.string(), // Token de sécurité de la facture
      })
    )
    .mutation(async ({ input }: any) => {
      // ✅ FIX P0: confirmPayment ne modifie plus la DB. Seul le webhook Stripe signé fait évoluer l'état.
      const { invoiceId } = input;
      logger.info("[PaymentRouter] confirmPayment called but mutation is disabled. Waiting for Stripe webhook.", { invoiceId, paymentIntentId: input.paymentIntentId });
      return {
        success: true,
        message: "Payment confirmation acknowledged. Invoice status will update via webhook.",
        invoiceId,
      };
    }),

  /**
   * Récupère le statut d'un Payment Intent
   * Endpoint PUBLIC
   */
  getPaymentStatus: publicProcedure
    .input(
      z.object({
        paymentIntentId: z.string(),
        token: z.string(), // Token de sécurité de la facture
      })
    )
    .query(async ({ input }: any) => {
      try {
        const { paymentIntentId, token } = input;

        // Valider le token
        const validation = await InvoiceService.validateSecureLink(token);
        if (!validation.valid || !validation.invoiceId) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Invalid or expired token",
          });
        }

        const invoice = await InvoiceService.getInvoiceById(validation.invoiceId);
        if (!invoice) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Invoice not found",
          });
        }

        const stripe = await getStripeForTenant(invoice.tenantId);
        const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

        return {
          success: true,
          status: paymentIntent.status,
          amount: paymentIntent.amount,
          currency: paymentIntent.currency,
          clientSecret: paymentIntent.client_secret,
        };
      } catch (error: any) {
        logger.error("[PaymentRouter] Failed to get payment status", { error });
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to get payment status",
        });
      }
    }),

  /**
   * Annule un Payment Intent
   * Endpoint PROTECTED
   */
  cancelPayment: tenantProcedure
    .input(
      z.object({
        paymentIntentId: z.string(),
        invoiceId: z.number().int().positive(),
        reason: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }: any) => {
      try {
        const status = await InvoiceService.cancelPaymentIntent(
          ctx.tenantId!,
          input.invoiceId,
          input.paymentIntentId,
          input.reason
        );
        return { success: true, status };
      } catch (error: any) {
        logger.error("[PaymentRouter] Failed to cancel payment", { error });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message || "Failed to cancel payment",
        });
      }
    }),
});
