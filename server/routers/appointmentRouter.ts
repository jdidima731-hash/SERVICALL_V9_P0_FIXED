import { router } from "../_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import * as db from "../db";
import { tenantProcedure, managerProcedure } from "../procedures";
import { normalizeResponse } from "../_core/responseNormalizer";
import { paginationInput, paginate } from "../_core/pagination";
import { logger } from "../infrastructure/logger";
import { AppointmentService } from "../services/appointmentService";


export const appointmentRouter = router({
  /**
   * List appointments
   */
  list: tenantProcedure
    .input(paginationInput.extend({
      month: z.number().optional(),
      year: z.number().optional(),
    }))
    .query(async ({ ctx, input }) => {
      if (!ctx.tenantId) throw new TRPCError({ code: "BAD_REQUEST" });
      try {
        const { data, total } = await AppointmentService.listAppointments(ctx.tenantId, input.page, input.limit);
        return paginate(data, total, input);
      } catch (error: any) {
        logger.error("[Appointment Router] Error listing appointments:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Erreur lors de la récupération des rendez-vous",
        });
      }
    }),

  /**
   * Create appointment
   */
  create: tenantProcedure // Agents can create appointments
    .input(
      z.object({
        title: z.string(),
        description: z.string().optional(),
        startTime: z.date(),
        endTime: z.date(),
        prospectId: z.number().optional(),
        location: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });
      if (!ctx.tenantId) throw new TRPCError({ code: "BAD_REQUEST" });

      try {
        const appointmentId = await AppointmentService.createAppointment({
          ...input,
          tenantId: ctx.tenantId,
          userId: ctx.user!.id,
          googleAccessToken: ctx.req?.googleAccessToken,
        });

        return normalizeResponse({ success: true, appointmentId }, 'appointment.create');
      } catch (error: any) {
        logger.error("[Appointment Router] Error creating appointment:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Erreur lors de la création du rendez-vous",
        });
      }
    }),

  /**
   * Update appointment
   */
  update: managerProcedure // Restricted to manager
    .input(
      z.object({
        id: z.number(),
        title: z.string().optional(),
        description: z.string().optional(),
        startTime: z.date().optional(),
        endTime: z.date().optional(),
        status: z.enum(["scheduled", "confirmed", "completed", "cancelled"]).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenantId) throw new TRPCError({ code: "BAD_REQUEST" });
      try {
        // Verify ownership
        const appointment = await db.getAppointmentById(input.id, ctx.tenantId!);
        if (!appointment) throw new TRPCError({ code: "NOT_FOUND" });

        const updated = await db.updateAppointment(input.id, {
          title: input.title,
          description: input.description,
          startTime: input.startTime,
          status: input.status,
        }, ctx.tenantId!);

        return normalizeResponse(updated, 'appointment.update');
      } catch (error: any) {
        if (error instanceof TRPCError) throw error;
        logger.error("[Appointment Router] Error updating appointment:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Erreur lors de la mise à jour du rendez-vous",
        });
      }
    }),

  /**
   * Delete appointment
   */
  delete: managerProcedure // Restricted to manager
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenantId) throw new TRPCError({ code: "BAD_REQUEST" });
      try {
        // Verify ownership
        const appointment = await db.getAppointmentById(input.id, ctx.tenantId!);
        if (!appointment) throw new TRPCError({ code: "NOT_FOUND" });

        await db.deleteAppointment(input.id, ctx.tenantId!);
        return normalizeResponse({ success: true }, 'appointment.delete');
      } catch (error: any) {
        if (error instanceof TRPCError) throw error;
        logger.error("[Appointment Router] Error deleting appointment:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Erreur lors de la suppression du rendez-vous",
        });
      }
    }),

  /**
   * Get badge count for sidebar (today's appointments count)
   */
  getBadgeCount: tenantProcedure.query(async ({ ctx }) => {
    if (!ctx.tenantId) throw new TRPCError({ code: "BAD_REQUEST" });
    try {
      const agentId = ctx.user!.role === "agent" ? ctx.user!.id : undefined;
      return await AppointmentService.getTodayCount(ctx.tenantId, agentId);
    } catch (error: any) {
      logger.error("[Appointment Router] Error getting badge count", { error, tenantId: ctx.tenantId });
      return 0;
    }
  }),
});