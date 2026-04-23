import { eq, and, inArray, lt } from "drizzle-orm";
import { getDbInstance } from "../db";
import { customerInvoices, type CustomerInvoice, type InsertCustomerInvoice } from "../../drizzle/schema";
import { logger } from "../infrastructure/logger";
import { AuditService } from "./auditService";
import crypto from "crypto";

/**
 * Service de gestion des factures clients
 * Création, envoi, acceptation, suivi des paiements
 */

export class InvoiceService {
  /**
   * Génère un numéro de facture unique
   */
  private static generateInvoiceNumber(tenantId: number): string {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const random = (parseInt(crypto.randomUUID().replace(/-/g,"").slice(0,4),16) % 10000).toString().padStart(4,"0");
    return `INV-${tenantId}-${year}${month}-${random}`;
  }

  /**
   * Génère un token sécurisé unique
   */
  private static generateSecureToken(): string {
    return crypto.randomBytes(32).toString("hex");
  }

  /**
   * Génère un lien sécurisé pour l'acceptation de facture
   */
  private static generateSecureLink(invoiceId: number, token: string, baseUrl?: string): string {
    const base = baseUrl || "https://app.servicall.com";
    return `${base}/invoice/accept/${invoiceId}/${token}`;
  }

  /**
   * Crée une nouvelle facture
   */
  static async createInvoice(data: {
    tenantId: number;
    prospectId?: number;
    callId?: number;
    amount: number;
    tax?: number;
    description?: string;
    template?: string;
    prospectName?: string;
    prospectEmail?: string;
  }): Promise<number | null> {
    try {
      const invoiceNumber = this.generateInvoiceNumber(data.tenantId);
      const tax = data.tax ?? 0;
      const totalAmount = data.amount + tax;

      const db = getDbInstance();
      if (!db) {
        logger.error("[InvoiceService] Database not available");
        return null;
      }

      const invoiceData: InsertCustomerInvoice = {
        tenantId: data.tenantId,
        prospectId: data.prospectId,
        callId: data.callId,
        invoiceNumber,
        amount: data.amount.toString(),
        tax: tax.toString(),
        totalAmount: totalAmount.toString(),
        description: data.description,
        template: data.template ?? "default",
        status: "draft",
        paymentStatus: "pending",
      };

      // ✅ ATOMICITÉ : transaction pour insertion + log d'audit
      const invoiceId = await db.transaction(async (tx) => {
        const result = await tx.insert(customerInvoices).values(invoiceData).returning();
        const id = result[0]?.id ?? null;

        if (id) {
          await AuditService.log({
            tenantId: data.tenantId,
            userId: 1,
            action: "INVOICE_CREATE",
            resource: "invoice",
            resourceId: id,
            actorType: "system",
            source: "SYSTEM",
            metadata: { invoiceNumber, amount: data.amount, callId: data.callId },
          });
        }
        return id;
      });

      logger.info("[InvoiceService] Invoice created", { invoiceNumber, tenantId: data.tenantId });
      return invoiceId;
    } catch (error: unknown) {
      logger.error("[InvoiceService] Failed to create invoice", { error });
      throw error;
    }
  }

  /**
   * Récupère une facture par son ID
   */
  static async getInvoiceById(invoiceId: number): Promise<CustomerInvoice | null> {
    try {
      const db = getDbInstance();
      if (!db) return null;

      const result = await db
        .select()
        .from(customerInvoices)
        .where(eq(customerInvoices.id, invoiceId))
        .limit(1);

      return result[0] ?? null;
    } catch (error: unknown) {
      logger.error("[InvoiceService] Failed to get invoice by ID", { error, invoiceId });
      return null;
    }
  }

  /**
   * Applique un template à une facture
   */
  static async applyTemplate(invoiceId: number, templateName: string): Promise<boolean> {
    try {
      const db = getDbInstance();
      if (!db) return false;

      await db
        .update(customerInvoices)
        .set({ template: templateName, updatedAt: new Date() })
        .where(eq(customerInvoices.id, invoiceId));

      logger.info("[InvoiceService] Template applied", { invoiceId, templateName });
      return true;
    } catch (error: unknown) {
      logger.error("[InvoiceService] Failed to apply template", { error, invoiceId });
      return false;
    }
  }

  /**
   * Génère un lien sécurisé pour une facture
   */
  static async generateSecureLinkForInvoice(invoiceId: number, expirationDays = 30): Promise<string | null> {
    try {
      const db = getDbInstance();
      if (!db) return null;

      const token = this.generateSecureToken();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + expirationDays);

      const secureLink = this.generateSecureLink(invoiceId, token);

      await db
        .update(customerInvoices)
        .set({ secureToken: token, secureLink, linkExpiresAt: expiresAt, updatedAt: new Date() })
        .where(eq(customerInvoices.id, invoiceId));

      logger.info("[InvoiceService] Secure link generated", { invoiceId, expiresAt });
      return secureLink;
    } catch (error: unknown) {
      logger.error("[InvoiceService] Failed to generate secure link", { error, invoiceId });
      throw error;
    }
  }

  /**
   * Envoie une facture par email
   */
  static async sendInvoiceByEmail(invoiceId: number, email: string): Promise<boolean> {
    try {
      const db = getDbInstance();
      if (!db) return false;

      const invoice = await this.getInvoiceById(invoiceId);
      if (!invoice) {
        logger.error("[InvoiceService] Invoice not found", { invoiceId });
        return false;
      }

      let secureLink = invoice.secureLink;
      if (!secureLink) {
        secureLink = await this.generateSecureLinkForInvoice(invoiceId);
      }

      const { sendEmail } = await import("./notificationService");
      await sendEmail({
        to: email,
        subject: `Facture #${invoice.invoiceNumber}`,
        text: `Bonjour,\n\nVotre facture est disponible via ce lien sécurisé: ${secureLink}\n\nMontant: ${invoice.totalAmount}€\nDate d'échéance: ${invoice.dueDate}\n\nCordialement`,
      });
      logger.info("[InvoiceService] Invoice email sent", { invoiceId, email, secureLink });

      await db
        .update(customerInvoices)
        .set({ status: "sent", sentAt: new Date(), updatedAt: new Date() })
        .where(eq(customerInvoices.id, invoiceId));

      await AuditService.log({
        tenantId: invoice.tenantId,
        userId: 1,
        action: "INVOICE_SEND",
        resource: "invoice",
        resourceId: invoiceId,
        actorType: "system",
        source: "SYSTEM",
        metadata: { method: "notification" },
      });

      return true;
    } catch (error: unknown) {
      logger.error("[InvoiceService] Failed to send invoice by email", { error, invoiceId });
      return false;
    }
  }

  /**
   * Envoie une facture par WhatsApp
   */
  static async sendInvoiceByWhatsApp(invoiceId: number, phone: string): Promise<boolean> {
    try {
      const db = getDbInstance();
      if (!db) return false;

      const invoice = await this.getInvoiceById(invoiceId);
      if (!invoice) return false;

      let secureLink = invoice.secureLink;
      if (!secureLink) {
        secureLink = await this.generateSecureLinkForInvoice(invoiceId);
      }

      const { sendWhatsAppMessage } = await import("./twilioService");
      const message = `Facture #${invoice.invoiceNumber}\nMontant: ${invoice.totalAmount}€\nLien: ${secureLink}`;
      await sendWhatsAppMessage({ to: phone, body: message });
      logger.info("[InvoiceService] Invoice WhatsApp sent", { invoiceId, phone, secureLink });

      await db
        .update(customerInvoices)
        .set({ status: "sent", sentAt: new Date(), updatedAt: new Date() })
        .where(eq(customerInvoices.id, invoiceId));

      await AuditService.log({
        tenantId: invoice.tenantId,
        userId: 1,
        action: "INVOICE_SEND",
        resource: "invoice",
        resourceId: invoiceId,
        actorType: "system",
        source: "SYSTEM",
        metadata: { method: "notification" },
      });

      return true;
    } catch (error: unknown) {
      logger.error("[InvoiceService] Failed to send invoice by WhatsApp", { error, invoiceId });
      return false;
    }
  }

  /**
   * Valide un lien sécurisé
   */
  static async validateSecureLink(token: string): Promise<{ valid: boolean; invoiceId?: number; invoice?: CustomerInvoice }> {
    try {
      const db = getDbInstance();
      if (!db) return { valid: false };

      const results = await db
        .select()
        .from(customerInvoices)
        .where(eq(customerInvoices.secureToken, token))
        .limit(1);

      if (results.length === 0) return { valid: false };

      const invoice = results[0];

      if (invoice.linkExpiresAt && new Date(invoice.linkExpiresAt) < new Date()) {
        logger.warn("[InvoiceService] Secure link expired", { invoiceId: invoice.id });
        return { valid: false, invoiceId: invoice.id };
      }

      return { valid: true, invoiceId: invoice.id, invoice };
    } catch (error: unknown) {
      logger.error("[InvoiceService] Failed to validate secure link", { error });
      return { valid: false };
    }
  }

  /**
   * Accepte une facture
   */
  static async acceptInvoice(
    token: string,
    acceptedBy: string,
    acceptedIP: string,
    signatureData?: Record<string, unknown>
  ): Promise<boolean> {
    try {
      const db = getDbInstance();
      if (!db) return false;

      const validation = await this.validateSecureLink(token);
      if (!validation.valid || !validation.invoiceId || !validation.invoice) {
        logger.error("[InvoiceService] Invalid token for acceptance");
        return false;
      }

      await db
        .update(customerInvoices)
        .set({
          status: "accepted",
          acceptedAt: new Date(),
          acceptedBy,
          acceptedIP,
          signatureData: signatureData ? JSON.stringify(signatureData) : null,
          updatedAt: new Date(),
        })
        .where(eq(customerInvoices.id, validation.invoiceId));

      await AuditService.log({
        tenantId: validation.invoice.tenantId,
        userId: 0,
        action: "INVOICE_ACCEPT",
        resource: "invoice",
        resourceId: validation.invoiceId,
        actorType: "human",
        source: "SYSTEM",
        ipAddress: acceptedIP,
        metadata: { acceptedBy, signatureData },
      });

      logger.info("[InvoiceService] Invoice accepted", {
        invoiceId: validation.invoiceId,
        acceptedBy,
        acceptedIP,
      });

      return true;
    } catch (error: unknown) {
      logger.error("[InvoiceService] Failed to accept invoice", { error });
      return false;
    }
  }

  /**
   * Récupère une facture par son token sécurisé et marque comme "opened"
   */
  static async getInvoiceByToken(token: string): Promise<CustomerInvoice | null> {
    try {
      const db = getDbInstance();
      if (!db) return null;

      const results = await db
        .select()
        .from(customerInvoices)
        .where(eq(customerInvoices.secureToken, token))
        .limit(1);

      if (results.length === 0) return null;
      const invoice = results[0];

      if (invoice.status === "sent") {
        await db
          .update(customerInvoices)
          .set({ status: "opened", updatedAt: new Date() })
          .where(eq(customerInvoices.id, invoice.id));

        await AuditService.log({
          tenantId: invoice.tenantId,
          userId: 0,
          
          action: "INVOICE_OPEN",
          resource: "invoice",
          resourceId: invoice.id,
          actorType: "human",
          source: "SYSTEM",
          metadata: { status: "opened" },
        });
      }

      return invoice;
    } catch (error: unknown) {
      logger.error("[InvoiceService] Failed to get invoice by token", { error });
      return null;
    }
  }

  /**
   * Vérifie et met à jour les factures expirées
   */
  static async checkExpiredInvoices(): Promise<number> {
    try {
      const db = getDbInstance();
      if (!db) return 0;

      const now = new Date();

      const expiredInvoices = await db
        .select()
        .from(customerInvoices)
        .where(
          and(
            inArray(customerInvoices.status, ["sent", "opened", "reminded"]),
            lt(customerInvoices.linkExpiresAt, now)
          )
        );

      for (const invoice of expiredInvoices) {
        await db
          .update(customerInvoices)
          .set({ status: "expired", updatedAt: now })
          .where(eq(customerInvoices.id, invoice.id));

        await AuditService.log({
          tenantId: invoice.tenantId,
          userId: 0,
          
          action: "INVOICE_EXPIRE",
          resource: "invoice",
          resourceId: invoice.id,
          actorType: "system",
          source: "SYSTEM",
          metadata: { previousStatus: invoice.status },
        });
      }

      return expiredInvoices.length;
    } catch (error: unknown) {
      logger.error("[InvoiceService] Failed to check expired invoices", { error });
      return 0;
    }
  }

  /**
   * Récupère le statut d'une facture
   */
  static async getInvoiceStatus(invoiceId: number): Promise<{
    id: number;
    invoiceNumber: string;
    status: string | null;
    paymentStatus: string | null;
    sentAt: Date | null;
    acceptedAt: Date | null;
    paidAt: Date | null;
  } | null> {
    const invoice = await this.getInvoiceById(invoiceId);
    if (!invoice) return null;

    return {
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      status: invoice.status,
      paymentStatus: invoice.paymentStatus,
      sentAt: invoice.sentAt,
      acceptedAt: invoice.acceptedAt,
      paidAt: invoice.paidAt,
    };
  }

  /**
   * Suit le statut de paiement
   */
  static async trackPaymentStatus(invoiceId: number, status: "pending" | "paid" | "failed"): Promise<boolean> {
    try {
      const db = getDbInstance();
      if (!db) return false;

      const updateData: {
        paymentStatus: string;
        updatedAt: Date;
        paidAt?: Date;
        status?: string;
      } = {
        paymentStatus: status,
        updatedAt: new Date(),
      };

      if (status === "paid") {
        updateData.paidAt = new Date();
        updateData.status = "paid";
      }

      const invoice = await this.getInvoiceById(invoiceId);

      await db
        .update(customerInvoices)
        .set(updateData)
        .where(eq(customerInvoices.id, invoiceId));

      if (invoice) {
        await AuditService.log({
          tenantId: invoice.tenantId,
          userId: 1,
          action: "INVOICE_PAYMENT",
          resource: "invoice",
          resourceId: invoiceId,
          actorType: "system",
          source: "SYSTEM",
          metadata: { status, previousStatus: invoice.paymentStatus },
        });
      }

      logger.info("[InvoiceService] Payment status tracked", { invoiceId, paymentStatus: status });
      return true;
    } catch (error: unknown) {
      logger.error("[InvoiceService] Failed to track payment status", { error, invoiceId });
      return false;
    }
  }

  /**
   * Liste les factures d'un tenant
   */
  static async listInvoices(tenantId: number, limit = 50, offset = 0): Promise<CustomerInvoice[]> {
    try {
      const db = getDbInstance();
      if (!db) return [];

      const results = await db
        .select()
        .from(customerInvoices)
        .where(eq(customerInvoices.tenantId, tenantId))
        .limit(limit)
        .offset(offset);

      return results;
    } catch (error: unknown) {
      logger.error("[InvoiceService] Failed to list invoices", { error, tenantId });
      return [];
    }
  }

  /**
   * Crée une Payment Intent Stripe pour une facture (BYOK)
   * ✅ FIX P1: Déplacement de la logique métier hors du routeur
   */
  static async createPaymentIntent(invoiceId: number, token: string): Promise<{ clientSecret: string; paymentIntentId: string; amount: number }> {
    const validation = await this.validateSecureLink(token);
    if (!validation.valid || !validation.invoiceId || validation.invoiceId !== invoiceId) {
      throw new Error("Invalid or expired token");
    }

    const invoice = validation.invoice || await this.getInvoiceById(invoiceId);
    if (!invoice) throw new Error("Invoice not found");
    if (invoice.paymentStatus === "paid") throw new Error("Invoice already paid");

    const { getStripeForTenant } = await import("./stripeService");
    const stripe = await getStripeForTenant(invoice.tenantId);

    const amount = Math.round(parseFloat(invoice.totalAmount) * 100);
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: "eur",
      description: `Invoice ${invoice.invoiceNumber}`,
      metadata: {
        invoiceId: invoiceId.toString(),
        tenantId: invoice.tenantId.toString(),
      },
    });

    logger.info("[InvoiceService] Payment Intent created", { invoiceId, paymentIntentId: paymentIntent.id });
    return {
      clientSecret: paymentIntent.client_secret!,
      paymentIntentId: paymentIntent.id,
      amount,
    };
  }

  /**
   * Annule un Payment Intent Stripe (BYOK)
   * ✅ FIX P1: Déplacement de la logique métier hors du routeur
   */
  static async cancelPaymentIntent(tenantId: number, invoiceId: number, paymentIntentId: string, reason?: string): Promise<string> {
    const invoice = await this.getInvoiceById(invoiceId);
    if (!invoice || invoice.tenantId !== tenantId) {
      throw new Error("Invoice not found or access denied");
    }

    const { getStripeForTenant } = await import("./stripeService");
    const stripe = await getStripeForTenant(tenantId);
    const canceledIntent = await stripe.paymentIntents.cancel(paymentIntentId);

    await AuditService.log({
      tenantId,
      userId: 0, // System/User ID à passer si disponible
      action: "INVOICE_PAYMENT_CANCEL",
      resource: "invoice",
      resourceId: invoiceId,
      actorType: "user",
      source: "WEB",
      metadata: { paymentIntentId, reason, status: canceledIntent.status },
    });

    return canceledIntent.status;
  }
}