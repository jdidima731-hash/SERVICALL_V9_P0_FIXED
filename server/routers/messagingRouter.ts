/**
 * Messaging Router - tRPC
 * ✅ BLOC 4 : Ajout du support Email et historique omnicanal
 */

import { router } from "../_core/trpc";
import { z } from "zod";
import { MessagingService } from "../services/messagingService";
import { tenantProcedure } from "../procedures";
import { TRPCError } from "@trpc/server";
import { paginationInput, paginate } from "../_core/pagination";
import { count, eq, and, desc } from "drizzle-orm";
import * as schema from "../../drizzle/schema";

export const messagingRouter = router({
  /**
   * Envoyer plusieurs messages (SMS, WhatsApp, Email)
   */
  sendMultiple: tenantProcedure
    .input(z.object({
      prospectIds: z.array(z.number()).min(1),
      campaignId: z.number().optional(),
      type: z.enum(["sms", "whatsapp", "email"]),
      content: z.string().min(1),
      subject: z.string().optional(), // Utilisé pour l'email
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        if (!ctx.tenantId) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Tenant ID is required",
          });
        }
        // Pour chaque prospect, envoyer un message
        const results = await Promise.all(input.prospectIds.map(prospectId =>
          MessagingService.sendMessage({
            tenantId: ctx.tenantId!,
            prospectId,
            campaignId: input.campaignId,
            type: input.type,
            content: input.content,
            subject: input.subject,
          })
        ));
        return { success: true, results };
      } catch (error: any) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : "Erreur lors de l'envoi de messages multiples",
        });
      }
    }),
  /**
   * Lister les messages avec filtres
   */
  list: tenantProcedure
    .input(paginationInput.extend({
      prospectId: z.number().optional(),
      campaignId: z.number().optional(),
      type: z.enum(["sms", "whatsapp", "email"]).optional(),
      status: z.enum(["pending", "sent", "delivered", "failed"]).optional(),
    }))
    .query(async ({ input, ctx }: any) => {
      const { page, limit, prospectId, campaignId, type, status } = input;
      const offset = (page - 1) * limit;

      if (!ctx.tenantId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Tenant ID is required",
        });
      }

      const conditions = [eq(schema.messages.tenantId, ctx.tenantId!)];
      if (prospectId) conditions.push(eq(schema.messages.prospectId, prospectId));
      if (campaignId) conditions.push(eq(schema.messages.campaignId, campaignId));
      if (type) conditions.push(eq(schema.messages.type, type));
      if (status) conditions.push(eq(schema.messages.status, status));

      const [data, totalResult] = await Promise.all([
        db.select().from(schema.messages)
          .where(and(...conditions))
          .limit(limit)
          .offset(offset)
          .orderBy(desc(schema.messages.createdAt)),
        db.select({ value: count() })
          .from(schema.messages)
          .where(and(...conditions))
      ]);

      return paginate(data, totalResult[0]?.value ?? 0, input);
    }),

  /**
   * Récupérer l'historique omnicanal (Appels + Messages)
   * ✅ Nouveauté BLOC 4
   */
  getOmnichannelHistory: tenantProcedure
    .input(z.object({
      prospectId: z.number(),
    }))
    .query(async ({ input }: any) => {
      return await MessagingService.getOmnichannelHistory(input.prospectId);
    }),

  /**
   * Envoyer un message (SMS, WhatsApp, Email)
   */
  send: tenantProcedure
    .input(z.object({
      prospectId: z.number(),
      campaignId: z.number().optional(),
      type: z.enum(["sms", "whatsapp", "email"]),
      content: z.string().min(1),
      subject: z.string().optional(), // Utilisé pour l'email
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        if (!ctx.tenantId) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Tenant ID is required",
          });
        }
        return await MessagingService.sendMessage({
          tenantId: ctx.tenantId!,
          ...input
        });
      } catch (error: any) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : "Erreur lors de l'envoi du message",
        });
      }
    }),

  /**
   * Lister les templates
   */
  getTemplates: tenantProcedure
    .input(z.object({
      type: z.enum(["sms", "whatsapp", "email"]).optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      if (!ctx.tenantId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Tenant ID is required",
        });
      }
      return await MessagingService.getTemplates(ctx.tenantId!, input?.type);
    }),
});
