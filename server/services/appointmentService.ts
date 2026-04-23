import { count, eq, desc, and, sql } from "drizzle-orm";
import * as db from "../db";
import { logger } from "../infrastructure/logger";
import { normalizeDbRecords } from "../_core/responseNormalizer";
import * as googleCalendarService from "./googleCalendarService";
import * as notificationService from "./notificationService";

/**
 * Service de gestion des rendez-vous
 * ✅ FIX P1: Centralisation de la logique métier (Google Calendar, Notifications, DB)
 */
export class AppointmentService {
  /**
   * Liste les rendez-vous avec pagination
   */
  static async listAppointments(tenantId: number, page: number, limit: number) {
    const offset = (page - 1) * limit;

    const [appointments, totalResult] = await Promise.all([
      db.db.select().from(db.appointments)
        .where(eq(db.appointments.tenantId, tenantId))
        .limit(limit)
        .offset(offset)
        .orderBy(desc(db.appointments.startTime)),
      db.db.select({ value: count() })
        .from(db.appointments)
        .where(eq(db.appointments.tenantId, tenantId))
    ]);
    
    const normalizedData = normalizeDbRecords(appointments);
    return {
      data: normalizedData,
      total: totalResult[0]?.value ?? 0
    };
  }

  /**
   * Crée un rendez-vous et déclenche les effets de bord (Sync, Notify)
   */
  static async createAppointment(params: {
    tenantId: number;
    userId: number;
    title: string;
    description?: string;
    startTime: Date;
    endTime: Date;
    prospectId?: number;
    location?: string;
    googleAccessToken?: string;
  }) {
    const { tenantId, userId, title, description, startTime, endTime, prospectId, location, googleAccessToken } = params;

    // 1. Création DB
    const appointmentResult = await db.createAppointment({
      tenantId,
      prospectId,
      userId,
      title,
      description,
      startTime,
      endTime,
      location,
    });

    const appointmentId = appointmentResult.id;

    // 2. Récupération prospect pour notifications
    const prospect = prospectId ? await db.getProspectById(prospectId, tenantId) : null;
    
    // 3. Sync Google Calendar (Background)
    if (googleAccessToken && appointmentId) {
      this.syncToGoogleCalendar(googleAccessToken, appointmentId, tenantId, {
        title, description, startTime, endTime, location,
        prospectEmail: prospect?.email || undefined
      }).catch(err => logger.error("[AppointmentService] Google Sync failed", err));
    }

    // 4. Notifications (Background)
    if (prospect) {
      this.sendNotifications(prospect, { title, startTime, endTime, description, location })
        .catch(err => logger.error("[AppointmentService] Notifications failed", err));
    }

    return appointmentId;
  }

  /**
   * Helper interne pour la synchro Google
   */
  private static async syncToGoogleCalendar(token: string, appointmentId: number, tenantId: number, eventData: any) {
    const googleEventId = await googleCalendarService.createGoogleEvent(token, eventData);
    if (googleEventId) {
      await db.updateAppointment(appointmentId, tenantId, { metadata: { googleEventId } });
    }
  }

  /**
   * Helper interne pour les notifications
   */
  private static async sendNotifications(prospect: any, data: any) {
    if (prospect.phone) {
      await notificationService.sendAppointmentSMS(prospect.phone, {
        title: data.title,
        startTime: data.startTime,
        location: data.location,
      });
    }
    if (prospect.email) {
      await notificationService.sendAppointmentEmail(prospect.email, {
        title: data.title,
        startTime: data.startTime,
        endTime: data.endTime,
        description: data.description,
        location: data.location,
      });
    }
  }

  /**
   * Récupère le compte des rendez-vous du jour
   */
  static async getTodayCount(tenantId: number, agentId?: number) {
    // Note: countTodayAppointments dans db.ts semble utiliser la table 'calls' au lieu de 'appointments'
    // On va corriger cela ici ou s'assurer de la cohérence
    const database = db.getDbInstance();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const condition = agentId 
      ? and(eq(db.appointments.tenantId, tenantId), eq(db.appointments.userId, agentId), sql`${db.appointments.startTime} >= ${today}`)
      : and(eq(db.appointments.tenantId, tenantId), sql`${db.appointments.startTime} >= ${today}`);

    const [result] = await database
      .select({ count: count() })
      .from(db.appointments)
      .where(condition);
      
    return result?.count ?? 0;
  }
}
