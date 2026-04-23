import { eq, and, lte } from "drizzle-orm";
import { getDbInstance } from "../db";
import { appointmentReminders, InsertAppointmentReminder, appointments } from "../../drizzle/schema";
import { logger } from "../infrastructure/logger";

/**
 * Service de rappels de rendez-vous intelligents
 * J-1, H-2, etc. par SMS/Email/WhatsApp
 */

export class AppointmentReminderService {
  /**
   * Crée les rappels automatiques pour un rendez-vous
   * J-1 à 18h00 + H-2
   */
  static async createRemindersForAppointment(appointmentId: number): Promise<boolean> {
    try {
      const db = getDbInstance();
      if (!db) {
        logger.error("[AppointmentReminderService] Database not available");
        return false;
      }

      // Récupérer le rendez-vous
      const appointmentResults = await db
        .select()
        .from(appointments)
        .where(eq(appointments.id, appointmentId))
        .limit(1);

      if (appointmentResults.length === 0) {
        logger.error("[AppointmentReminderService] Appointment not found", { appointmentId });
        return false;
      }

      const appointment = appointmentResults[0];
      const startTime = new Date(appointment.startTime);

      // Rappel J-1 à 18h00
      const dayBeforeReminder = new Date(startTime);
      dayBeforeReminder.setDate(dayBeforeReminder.getDate() - 1);
      dayBeforeReminder.setHours(18, 0, 0, 0);

      // Rappel H-2
      const twoHoursBeforeReminder = new Date(startTime);
      twoHoursBeforeReminder.setHours(twoHoursBeforeReminder.getHours() - 2);

      // Créer les rappels
      const reminders: InsertAppointmentReminder[] = [
        {
          tenantId: appointment.tenantId,
          appointmentId,
          reminderType: "email",
          scheduledAt: dayBeforeReminder,
          status: "pending",
        },
        {
          tenantId: appointment.tenantId,
          appointmentId,
          reminderType: "sms",
          scheduledAt: twoHoursBeforeReminder,
          status: "pending",
        },
      ];

      for (const reminder of reminders) {
        await db.insert(appointmentReminders).values(reminder);
      }

      logger.info("[AppointmentReminderService] Reminders created", { 
        appointmentId, 
        count: reminders.length 
      });

      return true;
    } catch (error: any) {
      logger.error("[AppointmentReminderService] Failed to create reminders", { error, appointmentId });
      return false;
    }
  }

  /**
   * Récupère les rappels à envoyer maintenant
   */
  static async getPendingReminders(): Promise<any[]> {
    try {
      const db = getDbInstance();
      if (!db) return [];

      const now = new Date();

      const results = await db
        .select()
        .from(appointmentReminders)
        .where(and(
          eq(appointmentReminders.status, "pending"),
          lte(appointmentReminders.scheduledAt, now)
        ));

      return results;
    } catch (error: any) {
      logger.error("[AppointmentReminderService] Failed to get pending reminders", { error });
      return [];
    }
  }

  /**
   * Envoie un rappel
   */
  static async sendReminder(reminderId: number): Promise<boolean> {
    try {
      const db = getDbInstance();
      if (!db) return false;

      // Récupérer le rappel
      const reminderResults = await db
        .select()
        .from(appointmentReminders)
        .where(eq(appointmentReminders.id, reminderId))
        .limit(1);

      if (reminderResults.length === 0) return false;

      const reminder = reminderResults[0];

      // Récupérer le rendez-vous
      const appointmentResults = await db
        .select()
        .from(appointments)
        .where(eq(appointments.id, reminder.appointmentId))
        .limit(1);

      if (appointmentResults.length === 0) return false;

      const appointment = appointmentResults[0];

      // Intégration avec les services d'envoi
      const { sendEmail } = await import("./notificationService");
      const { sendSMS, sendWhatsAppMessage } = await import("./twilioService");
      
      const message = `Rappel: Rendez-vous le ${new Date(appointment.startTime).toLocaleString('fr-FR')}`;
      
      if (reminder.reminderType === "email" && (appointment as Record<string, unknown>)['email'] as string | undefined) {
        await sendEmail({
          
          to: (appointment as Record<string, unknown>)['email'] as string | undefined,
          subject: "Rappel de rendez-vous",
          text: message,
        });
      } else if (reminder.reminderType === "sms" && (appointment as Record<string, unknown>)['phone'] as string | undefined) {
        const phone = (appointment as Record<string, unknown>)['phone'] as string | undefined;
        if (phone) await sendSMS(phone, message, (appointment as Record<string, unknown>)['tenantId'] as number);
      } else if (reminder.reminderType === "whatsapp" && (appointment as Record<string, unknown>)['phone'] as string | undefined) {
        
        await sendWhatsAppMessage({ to: (appointment as Record<string, unknown>)['phone'] as string | undefined, body: message });
      }
      
      logger.info("[AppointmentReminderService] Reminder sent", {
        reminderId,
        appointmentId: appointment.id,
        type: reminder.reminderType,
      });

      // Marquer comme envoyé
      await db
        .update(appointmentReminders)
        .set({
          status: "sent",
          sentAt: new Date(),
          // updatedAt not in schema
        })
        .where(eq(appointmentReminders.id, reminderId));

      return true;
    } catch (error: any) {
      logger.error("[AppointmentReminderService] Failed to send reminder", { error, reminderId });

      // Incrémenter le compteur de retry
      const db = getDbInstance();
      if (db) {
        await db
          .update(appointmentReminders)
          .set({
            status: "failed",
            
            retryCount: (db as unknown).raw("retryCount + 1"),
            // updatedAt not in schema
          })
          .where(eq(appointmentReminders.id, reminderId));
      }

      return false;
    }
  }

  /**
   * Traite tous les rappels en attente
   */
  static async processPendingReminders(): Promise<{ sent: number; failed: number }> {
    const pendingReminders = await this.getPendingReminders();
    let sent = 0;
    let failed = 0;

    for (const reminder of pendingReminders) {
      const success = await this.sendReminder(reminder.id);
      if (success) sent++;
      else failed++;
    }

    logger.info("[AppointmentReminderService] Processed pending reminders", { sent, failed });

    return { sent, failed };
  }

  /**
   * Récupère les rappels d'un rendez-vous
   */
  static async getRemindersForAppointment(appointmentId: number) {
    try {
      const db = getDbInstance();
      if (!db) return [];

      const results = await db
        .select()
        .from(appointmentReminders)
        .where(eq(appointmentReminders.appointmentId, appointmentId));

      return results;
    } catch (error: any) {
      logger.error("[AppointmentReminderService] Failed to get reminders", { error, appointmentId });
      return [];
    }
  }

  /**
   * Récupère les statistiques des rappels
   */
  static async getStatistics(tenantId: number) {
    try {
      const db = getDbInstance();
      if (!db) return null;

      const reminders = await db
        .select()
        .from(appointmentReminders)
        .where(eq(appointmentReminders.tenantId, tenantId));

      const total = reminders.length;
      const sent = reminders.filter((r: any) => r.status === "sent").length;
      const pending = reminders.filter((r: any) => r.status === "pending").length;
      const failed = reminders.filter((r: any) => r.status === "failed").length;

      const byType: Record<string, number> = {};
      reminders.forEach((r: any) => {
        byType[r.reminderType] = (byType[r.reminderType] || 0) + 1;
      });

      return {
        total,
        sent,
        pending,
        failed,
        byType,
        successRate: total > 0 ? (sent / total) * 100 : 0,
      };
    } catch (error: any) {
      logger.error("[AppointmentReminderService] Failed to get statistics", { error, tenantId });
      return null;
    }
  }
}