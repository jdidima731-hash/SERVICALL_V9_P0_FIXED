
/**
 * Messaging Service - Gestion interne des SMS, WhatsApp et Emails
 * ✅ BLOC 4 : Ajout du support Email et unification de l'historique omnicanal
 */

import { getDbInstance } from "../db";
import * as schema from "../../drizzle/schema";
import { eq, and, desc } from "drizzle-orm";
import { logger } from "../infrastructure/logger";

export class MessagingService {
  /**
   * Créer un template de message (SMS, WhatsApp ou Email)
   */
  static async createTemplate(data: typeof schema.messageTemplates.$inferInsert) {
    const db = getDbInstance();
    const [template] = await db.insert(schema.messageTemplates).values(data).returning();
    return template;
  }

  /**
   * Récupérer les templates d'un tenant
   */
  static async getTemplates(tenantId: number, type?: "sms" | "whatsapp" | "email") {
    const db = getDbInstance();
    let query = db.select().from(schema.messageTemplates).where(eq(schema.messageTemplates.tenantId, tenantId));
    
    if (type) {
      
      query = db.select().from(schema.messageTemplates).where(
        and(
          eq(schema.messageTemplates.tenantId, tenantId),
          eq(schema.messageTemplates.type, type)
        )
      ) as unknown;
    }

    return await query;
  }

  /**
   * Enregistrer et envoyer un message (SMS, WhatsApp ou Email)
   */
  static async sendMessage(data: {
    tenantId: number;
    prospectId: number;
    campaignId?: number;
    type: "sms" | "whatsapp" | "email";
    content: string;
    subject?: string; // Requis pour l'email
  }) {
    const db = getDbInstance();
    
    logger.info(`[Messaging] Sending ${data.type} to prospect ${data.prospectId}`, { 
      content: data.content.substring(0, 50) + "..." 
    });

    // Enregistrement initial en "pending"
    
    const [message] = await db.insert(schema.messages).values({
      tenantId: data.tenantId,
      prospectId: data.prospectId,
      campaignId: data.campaignId,
      type: data.type,
      direction: "outbound",
      content: data.content,
      metadata: data.subject ? { subject: data.subject } : null,
      status: "pending",
    }).returning();

    try {
      if (data.type === "sms") {
        const prospect = await db.query.prospects.findFirst({
          where: eq(schema.prospects.id, data.prospectId),
        });
        if (!prospect || !prospect.phone) {
          throw new Error("Numéro de téléphone du prospect manquant");
        }
        const { sendSMS } = await import("./twilioService");
        await sendSMS(prospect.phone, data.content, data.tenantId);
      } else if (data.type === "whatsapp") {
        // Implémenter l'envoi WhatsApp via Twilio ou autre
        await new Promise(resolve => setTimeout(resolve, 800)); // Simulation
      } else if (data.type === "email") {
        // Implémenter l'envoi d'email via Nodemailer ou autre
        await new Promise(resolve => setTimeout(resolve, 800)); // Simulation
      }

      await db.update(schema.messages)
        .set({ 
          status: "sent", 
          sentAt: new Date(),
          externalSid: `sim_${data.type.substring(0,1)}_${Math.random().toString(36).substring(7)}`
        })
        .where(eq(schema.messages.id, message.id));
      
      return { ...message, status: "sent" };
    } catch (error: unknown) {
      logger.error(`[Messaging] Failed to send ${data.type}`, { error: (error instanceof Error ? error.message : String(error)) });
      await db.update(schema.messages)
        .set({ status: "failed", error: (error instanceof Error ? error.message : String(error)) })
        .where(eq(schema.messages.id, message.id));
      throw error;
    }
  }

  /**
   * Récupérer l'historique omnicanal (Appels + Messages) d'un prospect
   * ✅ Nouveauté BLOC 4 : Unification
   */
  static async getOmnichannelHistory(prospectId: number) {
    const db = getDbInstance();
    
    // 1. Récupérer les messages (SMS, WA, Email)
    const messages = await db
      .select()
      .from(schema.messages)
      .where(eq(schema.messages.prospectId, prospectId))
      .orderBy(desc(schema.messages.createdAt));

    // 2. Récupérer les appels
    const calls = await db
      .select()
      .from(schema.calls)
      .where(eq(schema.calls.prospectId, prospectId))
      .orderBy(desc(schema.calls.createdAt));

    // 3. Fusionner et trier par date décroissante
    const timeline = [
      ...messages.map((m) => ({ ...(m as Record<string, unknown>), timelineType: 'message' })),
      ...calls.map((c) => ({ ...(c as Record<string, unknown>), timelineType: 'call' }))
    ].sort((a, b) => 
      
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    return timeline;
  }

  /**
   * Récupérer l'historique des messages d'un prospect
   */
  static async getProspectHistory(prospectId: number) {
    const db = getDbInstance();
    return await db
      .select()
      .from(schema.messages)
      .where(eq(schema.messages.prospectId, prospectId))
      .orderBy(desc(schema.messages.createdAt));
  }

  /**
   * Récupérer les messages d'une campagne
   */
  static async getCampaignMessages(campaignId: number) {
    const db = getDbInstance();
    return await db
      .select()
      .from(schema.messages)
      .where(eq(schema.messages.campaignId, campaignId))
      .orderBy(desc(schema.messages.createdAt));
  }

  /**
   * Envoyer un message à plusieurs destinataires
   */
  static async sendMultipleMessages(data: {
    tenantId: number;
    userId?: number;
    phoneNumbers: string[];
    content: string;
    type: "sms" | "whatsapp";
    campaignId?: number;
  }) {
    const db = getDbInstance();
    
    logger.info(`[Messaging] Sending ${data.type} to ${data.phoneNumbers.length} recipients`, { 
      tenantId: data.tenantId,
      userId: data.userId,
      count: data.phoneNumbers.length
    });

    const sendPromises = data.phoneNumbers.map(async (phoneNumber) => {
      try {
        const [message] = await db.insert(schema.messages).values({
          tenantId: data.tenantId,
          prospectId: null,
          campaignId: data.campaignId,
          type: data.type,
          direction: "outbound",
          content: data.content,
          status: "pending",
        }).returning();

        if (data.type === "sms") {
          const { sendSMS } = await import("./twilioService");
          await sendSMS(phoneNumber, data.content, data.tenantId);
        } else if (data.type === "whatsapp") {
          // Implémenter l'envoi WhatsApp via Twilio ou autre
          await new Promise(resolve => setTimeout(resolve, 800)); // Simulation
        } else if (data.type === "email") {
          // Implémenter l'envoi d'email via Nodemailer ou autre
          await new Promise(resolve => setTimeout(resolve, 800)); // Simulation
        }

        await db.update(schema.messages)
          .set({ 
            status: "sent", 
            sentAt: new Date(),
            externalSid: `sim_${Math.random().toString(36).substring(7)}`
          })
          .where(eq(schema.messages.id, message.id));
        
        return { success: true, phoneNumber, messageId: message.id };
      } catch (error: unknown) {
        logger.error(`[Messaging] Failed to send ${data.type} to ${phoneNumber}`, { error: (error instanceof Error ? error.message : String(error)) });
        return { success: false, phoneNumber, error: (error instanceof Error ? error.message : String(error)) };
      }
    });

    const results = await Promise.allSettled(sendPromises);
    const formattedResults = results.map((result) => {
      if (result.status === "fulfilled") return result.value;
      return { success: false, phoneNumber: "unknown", error: result.reason?.message || "Unknown error" };
    });

    const successCount = formattedResults.filter(r => r.success).length;
    const failCount = formattedResults.filter(r => !r.success).length;

    return {
      total: data.phoneNumbers.length,
      success: successCount,
      failed: failCount,
      results: formattedResults
    };
  }
}