import { router } from "../_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { getDbInstance } from "../db";
import { tenantProcedure, managerProcedure, agentProcedure } from "../procedures";
import { eq, and } from "drizzle-orm";
import { deals } from "../../drizzle/schema";

/**
 * Real Estate Router - Gestion des Biens, Visites et Deals
 */
export const realEstateRouter = router({
  // ============================================
  // PROPERTIES
  // ============================================
  
  listProperties: tenantProcedure
    .input(z.object({
      limit: z.number().default(50),
      offset: z.number().default(0),
      status: z.string().optional(),
      type: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const dbInstance = getDbInstance();
      if (!dbInstance) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      
      // Note: properties table not yet in schema - return empty array until migration
      void ctx; void input;
      return [];
    }),

  createProperty: managerProcedure
    .input(z.object({
      title: z.string().min(1),
      description: z.string().optional(),
      address: z.string().min(1),
      city: z.string().min(1),
      zipCode: z.string().optional(),
      price: z.number().positive(),
      type: z.enum(["apartment", "house", "land", "commercial", "other"]),
      surface: z.number().optional(),
      rooms: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      void ctx; void input;
      throw new TRPCError({ code: "NOT_IMPLEMENTED", message: "Properties table not yet migrated" });
    }),

  // ============================================
  // VISITS
  // ============================================

  listVisits: tenantProcedure
    .input(z.object({
      propertyId: z.number().optional(),
      prospectId: z.number().optional(),
    }))
    .query(async ({ ctx, input }) => {
      void ctx; void input;
      return [];
    }),

  scheduleVisit: agentProcedure
    .input(z.object({
      propertyId: z.number(),
      prospectId: z.number(),
      scheduledAt: z.date(),
    }))
    .mutation(async ({ ctx, input }) => {
      void ctx; void input;
      throw new TRPCError({ code: "NOT_IMPLEMENTED", message: "Visits table not yet migrated" });
    }),

  updateVisitFeedback: agentProcedure
    .input(z.object({
      visitId: z.number(),
      feedback: z.string(),
      rating: z.number().min(1).max(5),
      status: z.enum(["completed", "cancelled", "no_show"]),
    }))
    .mutation(async ({ ctx, input }) => {
      void ctx; void input;
      throw new TRPCError({ code: "NOT_IMPLEMENTED", message: "Visits table not yet migrated" });
    }),

  // ============================================
  // DEALS (Pipeline de vente)
  // ============================================

  listDeals: managerProcedure
    .input(z.object({
      status: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const dbInstance = getDbInstance();
      if (!dbInstance) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      
      let query = dbInstance.select().from(deals).where(eq(deals.tenantId, ctx.tenantId!));
      if (input.status) {
        query = dbInstance.select().from(deals).where(
          and(eq(deals.tenantId, ctx.tenantId!), eq(deals.status, input.status))
        );
      }
      return await query;
    }),

  createDeal: agentProcedure
    .input(z.object({
      title: z.string().min(1),
      prospectId: z.number().optional(),
      amount: z.number().positive(),
    }))
    .mutation(async ({ ctx, input }) => {
      const dbInstance = getDbInstance();
      if (!dbInstance) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      
      const [newDeal] = await dbInstance.insert(deals).values({
        tenantId: ctx.tenantId!,
        prospectId: input.prospectId,
        title: input.title,
        value: input.amount.toString(),
        status: "open",
      }).returning();
      
      return newDeal;
    }),

  updateDealStatus: managerProcedure
    .input(z.object({
      dealId: z.number(),
      status: z.string(),
      closingDate: z.date().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const dbInstance = getDbInstance();
      if (!dbInstance) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      
      const [updated] = await dbInstance.update(deals)
        .set({ 
          status: input.status, 
          expectedCloseDate: input.closingDate,
          updatedAt: new Date() 
        })
        .where(and(eq(deals.id, input.dealId), eq(deals.tenantId, ctx.tenantId!)))
        .returning();
        
      if (!updated) throw new TRPCError({ code: "NOT_FOUND", message: "Deal not found" });
      return updated;
    }),
});

// Suppress unused import warnings
void eq; void and;
