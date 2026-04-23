import { router, publicProcedure, tenantProcedure } from "../procedures";
import { z } from "zod";
import { db, stripeEvents, securityAuditLogs } from "../db";
import { eq, desc, and } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

export const webhookRouter = router({
  /**
   * Liste les webhooks Stripe reçus pour le tenant
   */
  listStripeEvents: tenantProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).default(50),
      offset: z.number().default(0),
    }))
    .query(async ({ ctx, input }) => {
      return await db.select()
        .from(stripeEvents)
        .where(eq(stripeEvents.tenantId, ctx.tenantId!))
        .limit(input.limit)
        .offset(input.offset)
        .orderBy(desc(stripeEvents.createdAt));
    }),

  /**
   * Récupère les logs d'audit liés aux webhooks
   */
  getWebhookAuditLogs: tenantProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).default(50),
    }))
    .query(async ({ ctx, input }) => {
      return await db.select()
        .from(securityAuditLogs)
        .where(and(
          eq(securityAuditLogs.tenantId, ctx.tenantId!),
          eq(securityAuditLogs.action, "webhook_received")
        ))
        .limit(input.limit)
        .orderBy(desc(securityAuditLogs.createdAt));
    }),

  /**
   * Endpoint de test pour simuler la réception d'un webhook (dev uniquement)
   */
  simulateWebhook: tenantProcedure
    .input(z.object({
      type: z.string(),
      payload: z.record(z.unknown()),
    }))
    .mutation(async ({ ctx, input }) => {
      if (process.env.NODE_ENV === "production") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Simulation interdite en production",
        });
      }

      const [event] = await db.insert(stripeEvents).values({
        stripeEventId: `sim_${Date.now()}`,
        type: input.type,
        payload: input.payload,
        tenantId: ctx.tenantId!,
        status: 'pending',
      }).returning();

      return event;
    }),
});
