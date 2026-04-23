/**
 * WHATSAPP OWNER CRON SERVICE
 * ─────────────────────────────────────────────────────────────
 * Envoi proactif du briefing matinal à l'owner de chaque tenant.
 * Lancé par le worker BullMQ (ownerBriefingQueue) ou directement par cron.
 *
 * SCHEDULE : Tous les jours à 8h00 (configurable par tenant)
 * CONDITION : Seulement si ownerWhatsappPhone est configuré dans tenant.settings
 *
 * CONTENU DU BRIEFING :
 *  - RDV du jour
 *  - Leads non relancés
 *  - Appels en attente
 *  - Alerte si RDV dans 1h
 */

import { logger } from "../infrastructure/logger";

// TS2305 FIX — helper functions (remplacent les imports manquants de db.ts)
import { getDbInstance } from "../db";
import { prospects, appointments, calls } from "../../drizzle/schema";
import { eq, and, gte, lte, count } from "drizzle-orm";

async function getProspectsByTenant(tenantId: number, limit = 100) {
  const db = getDbInstance();
  return db.select().from(prospects).where(eq(prospects.tenantId, tenantId)).limit(limit);
}

async function getAppointmentsByTenant(tenantId: number, limit = 100) {
  const db = getDbInstance();
  return db.select().from(appointments).where(eq(appointments.tenantId, tenantId)).limit(limit);
}

async function countTodayAppointments(tenantId: number): Promise<number> {
  const db = getDbInstance();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const result = await db.select({ value: count() }).from(appointments)
    .where(and(eq(appointments.tenantId, tenantId), gte(appointments.startTime, today), lte(appointments.startTime, tomorrow)));
  return result[0]?.value ?? 0;
}

async function countPendingCalls(tenantId: number): Promise<number> {
  const db = getDbInstance();
  const result = await db.select({ value: count() }).from(calls)
    .where(and(eq(calls.tenantId, tenantId), eq(calls.status as unknown, "pending")));
  return result[0]?.value ?? 0;
}
;
import { sendWhatsAppUnified } from "./whatsappCommonService";

export interface TenantOwnerConfig {
  tenantId: number;
  tenantName: string;
  ownerWhatsappPhone: string;
  twilioSid?: string;
  twilioToken?: string;
  twilioPhone?: string;
  wabaPhoneNumberId?: string;
  wabaAccessToken?: string;
  briefingHour?: number; // heure locale (défaut: 8)
}

// ─────────────────────────────────────────────
// Génère et envoie le briefing matinal
// ─────────────────────────────────────────────

export async function sendOwnerMorningBriefing(config: TenantOwnerConfig): Promise<void> {
  const {
    tenantId,
    tenantName,
    ownerWhatsappPhone,
    twilioSid,
    twilioToken,
    twilioPhone,
  } = config;

  try {
    const [todayCount, pendingCalls, prospects] = await Promise.all([
      countTodayAppointments(tenantId),
      countPendingCalls(tenantId),
      getProspectsByTenant(tenantId, 200),
    ]);

    const cutoff = Date.now() - 48 * 60 * 60 * 1000;
    const staleLeads = prospects.filter(p =>
      p.status === "new" &&
      p.updatedAt &&
      new Date(p.updatedAt).getTime() < cutoff
    ).length;

    const newLeads = prospects.filter(p => p.status === "new").length;

    // Construction du message
    const now = new Date();
    const dateStr = now.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });

    let msg = `🌅 *Bonjour ${tenantName} !*\n`;
    msg += `📆 ${dateStr}\n\n`;

    // Indicateurs
    msg += `📅 RDV aujourd'hui : *${todayCount}*\n`;
    msg += `👥 Nouveaux leads : *${newLeads}*\n`;

    if (staleLeads > 0) {
      msg += `⚠️ Leads non relancés (+48h) : *${staleLeads}*\n`;
    }

    if (pendingCalls > 0) {
      msg += `📞 Appels en attente : *${pendingCalls}*\n`;
    }

    msg += `\n`;

    // Suggestions d'action
    const actions: string[] = [];
    if (staleLeads > 0) actions.push(`"relance les leads"`);
    if (todayCount > 0) actions.push(`"mes RDV du jour"`);
    if (pendingCalls > 0) actions.push(`"appels en attente"`);

    if (actions.length > 0) {
      msg += `💡 Tu peux me demander :\n`;
      msg += actions.map(a => `• ${a}`).join("\n");
    } else {
      msg += `✅ Tout est en ordre. Bonne journée !`;
    }

    // Envoyer via WhatsApp Unifié (Meta > Twilio)
    await sendWhatsAppUnified(
      ownerWhatsappPhone,
      msg,
      { 
        twilioSid, 
        twilioToken, 
        twilioPhone,
        wabaPhoneNumberId: config.wabaPhoneNumberId,
        wabaAccessToken: config.wabaAccessToken
      }
    );

    logger.info("[OwnerCron] Morning briefing sent", { tenantId, to: ownerWhatsappPhone });

  } catch (err: any) {
    logger.error("[OwnerCron] Failed to send briefing", {
      tenantId,
      err: err instanceof Error ? err.message : String(err),
    });
  }
}

// ─────────────────────────────────────────────
// Alerte RDV imminent (à appeler depuis un cron toutes les 30min)
// ─────────────────────────────────────────────

export async function sendAppointmentReminders(config: TenantOwnerConfig): Promise<void> {
  const { tenantId, ownerWhatsappPhone, twilioSid, twilioToken, twilioPhone } = config;

  if (!twilioSid || !twilioToken || !twilioPhone) return;

  try {
    const appointments = await getAppointmentsByTenant(tenantId, 50);
    const now = Date.now();
    const oneHour = 60 * 60 * 1000;

    const upcoming = appointments.filter(a => {
      if (!a.startTime) return false;
      const t = new Date(a.startTime).getTime();
      return t > now && t <= now + oneHour;
    });

    for (const appt of upcoming) {
      const t = new Date(appt.startTime!);
      const timeStr = t.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
      const msg = `⏰ RDV dans moins d'1h !\n• ${timeStr} — ${appt.title || "RDV"} ${(appt as unknown).contactName ? `avec ${(appt as unknown).contactName}` : ""}`;

      await sendWhatsAppUnified(ownerWhatsappPhone, msg, { 
        twilioSid, 
        twilioToken, 
        twilioPhone,
        wabaPhoneNumberId: config.wabaPhoneNumberId,
        wabaAccessToken: config.wabaAccessToken
      });
    }

  } catch (err: any) {
    logger.error("[OwnerCron] Reminder failed", { tenantId, err: err.message });
  }
}

// ─────────────────────────────────────────────
// Extraction de la config owner depuis tenant.settings
// ─────────────────────────────────────────────

export function extractOwnerConfig(
  tenantId: number,
  tenantName: string,
  settings: Record<string, unknown> | null
): TenantOwnerConfig | null {
  if (!settings) return null;
  // ✅ FIX: cherche ownerWhatsappPhone à la racine ET dans whatsappAgent (imbriqué)
  const ownerPhoneRoot = (settings as unknown).ownerWhatsappPhone as string | undefined;
  const ownerPhoneNested = ((settings as unknown).whatsappAgent as Record<string, unknown> | undefined)
    ?.ownerWhatsappPhone as string | undefined;
  const ownerPhone = ownerPhoneNested ?? ownerPhoneRoot;
  if (!ownerPhone) return null;

  return {
    tenantId,
    tenantName,
    ownerWhatsappPhone: ownerPhone,
    twilioSid: (settings as unknown).twilioSid,
    twilioToken: (settings as unknown).twilioToken,
    twilioPhone: (settings as unknown).twilioPhone,
    wabaPhoneNumberId: (settings as unknown).wabaPhoneNumberId,
    wabaAccessToken: (settings as unknown).wabaAccessToken,
    briefingHour: (settings as unknown).briefingHour ?? 8,
  };
}
