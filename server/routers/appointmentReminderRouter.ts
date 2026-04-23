import { z } from "zod";
import { router, tenantProcedure } from "../procedures";
import { AppointmentReminderService } from "../services/appointmentReminderService";
import { TRPCError } from "@trpc/server";
import { logger } from "../infrastructure/logger";

/**
 * Router pour les rappels de rendez-vous
 * ✅ BLOC 1: Toutes les procédures utilisent tenantProcedure — ctx.tenantId! garanti non-null
 */

export const appointmentReminderRouter = router({
  /**
   * Crée les rappels pour un rendez-vous
   */
  createForAppointment: tenantProcedure
    .input(
      z.object({
        appointmentId: z.number().int().positive(),
      })
    )
    .mutation(async ({ input, ctx }: any) => {
      const { appointmentId } = input;

      const db = import("../db").then(m => m.getDbInstance());
      if (!db) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Database not available",
        });
      }

      
      const appointment = await db.getAppointmentById(appointmentId, ctx.tenantId!);

      if (!appointment) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Appointment not found or you don't have access to it",
        });
      }

      const success = await AppointmentReminderService.createRemindersForAppointment(appointmentId);

      if (!success) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create reminders",
        });
      }

      return {
        success: true,
        message: "Reminders created successfully",
      };
    }),

  /**
   * Récupère les rappels d'un rendez-vous
   */
  getForAppointment: tenantProcedure
    .input(
      z.object({
        appointmentId: z.number().int().positive(),
      })
    )
    .query(async ({ input, ctx }: any) => {
      const { appointmentId } = input;

      try {
        const db = import("../db").then(m => m.getDbInstance());
        if (!db) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Base de données non disponible",
          });
        }

        
        const appointment = await db.getAppointmentById(appointmentId, ctx.tenantId!);

        if (!appointment) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Rendez-vous non trouvé ou vous n'avez pas accès à celui-ci",
          });
        }

        const reminders = await AppointmentReminderService.getRemindersForAppointment(appointmentId);

        return {
          reminders: reminders || [],
          total: reminders?.length ?? 0,
        };
      } catch (error: any) {
        if (error instanceof TRPCError) {
          throw error;
        }
        logger.error("[AppointmentReminder] Error getting reminders", { error, appointmentId });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Erreur lors de la récupération des rappels",
        });
      }
    }),

  /**
   * Récupère les statistiques des rappels
   * ✅ BLOC 1: tenantProcedure garantit ctx.tenantId! non-null — vérification manuelle supprimée
   */
  getStatistics: tenantProcedure.query(async ({ ctx }) => {
    const stats = await AppointmentReminderService.getStatistics(ctx.tenantId!);

    if (!stats) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to get statistics",
      });
    }

    return stats;
  }),
});