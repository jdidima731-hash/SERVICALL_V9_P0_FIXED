/**
 * EMAIL CONFIG SERVICE
 * Gère les configurations email pour chaque tenant
 * Supporte : Resend, SMTP, SendGrid, Mailgun
 */

import { getDbInstance } from "../db";
import {emailConfigurations, emailLogs, type EmailConfiguration, type EmailCredentials} from "../../drizzle/schema-email-config";
import { eq, and } from "drizzle-orm";
import { logger } from "../core/logger";
import crypto from "crypto";

// ✅ BLOC 1: Fallback de clé de chiffrement supprimé — EMAIL_ENCRYPTION_KEY requis
const _emailEncKey = process.env['EMAIL_ENCRYPTION_KEY'];
if (!_emailEncKey) {
  throw new Error('[EmailConfigService] EMAIL_ENCRYPTION_KEY est requis dans les variables d\'environnement. Ne jamais utiliser une clé par défaut.');
}
const ENCRYPTION_KEY = _emailEncKey;
const ENCRYPTION_IV_LENGTH = 16;

export class EmailConfigService {
  /**
   * Chiffre les credentials sensibles
   */
  private encryptCredentials(credentials: EmailCredentials): string {
    const iv = crypto.randomBytes(ENCRYPTION_IV_LENGTH);
    const cipher = crypto.createCipheriv(
      "aes-256-cbc",
      Buffer.from(ENCRYPTION_KEY.padEnd(32, "0").slice(0, 32)),
      iv
    );

    let encrypted = cipher.update(JSON.stringify(credentials), "utf8", "hex");
    encrypted += cipher.final("hex");

    // Retourner IV + encrypted
    return `${iv.toString("hex")}:${encrypted}`;
  }

  /**
   * Déchiffre les credentials
   */
  private decryptCredentials(encrypted: string): EmailCredentials {
    try {
      const [ivHex, encryptedData] = encrypted.split(":");
      const iv = Buffer.from(ivHex, "hex");
      const decipher = crypto.createDecipheriv(
        "aes-256-cbc",
        Buffer.from(ENCRYPTION_KEY.padEnd(32, "0").slice(0, 32)),
        iv
      );

      let decrypted = decipher.update(encryptedData, "hex", "utf8");
      decrypted += decipher.final("utf8");

      return JSON.parse(decrypted);
    } catch (error: any) {
      logger.error("Failed to decrypt credentials", { error });
      throw new Error("Failed to decrypt email credentials");
    }
  }

  /**
   * Crée une nouvelle configuration email
   */
  async createConfiguration(
    tenantId: number,
    provider: string,
    name: string,
    fromEmail: string,
    credentials: EmailCredentials,
    config?: Record<string, unknown>,
    fromName?: string
  ): Promise<EmailConfiguration> {
    const db = await getDbInstance();
    if (!db) throw new Error("Database not available");

    const encryptedCredentials = this.encryptCredentials(credentials);

    const result = await db
      .insert(emailConfigurations)
      .values({
        tenantId,
        provider,
        name,
        fromEmail,
        fromName,
        encryptedCredentials,
        config,
        isActive: true,
      })
      .returning();

    logger.info("Email configuration created", {
      tenantId,
      provider,
      configId: result[0]?.id,
    });

    return result[0]!;
  }

  /**
   * Récupère une configuration par ID
   */
  async getConfiguration(configId: number, tenantId: number): Promise<EmailConfiguration | null> {
    const db = await getDbInstance();
    if (!db) return null;

    const result = await db
      .select()
      .from(emailConfigurations)
      .where(and(eq(emailConfigurations.id, configId), eq(emailConfigurations.tenantId, tenantId)))
      .limit(1);

    return result[0] || null;
  }

  /**
   * Récupère les credentials déchiffrés
   */
  async getDecryptedCredentials(configId: number, tenantId: number): Promise<EmailCredentials | null> {
    const config = await this.getConfiguration(configId, tenantId);
    if (!config) return null;

    return this.decryptCredentials(config.encryptedCredentials);
  }

  /**
   * Récupère toutes les configurations d'un tenant
   */
  async getTenantConfigurations(tenantId: number): Promise<EmailConfiguration[]> {
    const db = await getDbInstance();
    if (!db) return [];

    return db
      .select()
      .from(emailConfigurations)
      .where(eq(emailConfigurations.tenantId, tenantId))
      .orderBy(emailConfigurations.isDefault, emailConfigurations.createdAt);
  }

  /**
   * Récupère la configuration par défaut d'un tenant
   */
  async getDefaultConfiguration(tenantId: number): Promise<EmailConfiguration | null> {
    const db = await getDbInstance();
    if (!db) return null;

    const result = await db
      .select()
      .from(emailConfigurations)
      .where(and(eq(emailConfigurations.tenantId, tenantId), eq(emailConfigurations.isDefault, true)))
      .limit(1);

    return result[0] || null;
  }

  /**
   * Définit une configuration comme par défaut
   */
  async setAsDefault(configId: number, tenantId: number): Promise<void> {
    const db = await getDbInstance();
    if (!db) return;

    // Retirer le flag par défaut de toutes les autres configs
    await db
      .update(emailConfigurations)
      .set({ isDefault: false })
      .where(eq(emailConfigurations.tenantId, tenantId));

    // Définir celle-ci comme par défaut
    await db
      .update(emailConfigurations)
      .set({ isDefault: true })
      .where(and(eq(emailConfigurations.id, configId), eq(emailConfigurations.tenantId, tenantId)));

    logger.info("Email configuration set as default", { configId, tenantId });
  }

  /**
   * Teste la connexion à un provider
   */
  async testConnection(configId: number, tenantId: number): Promise<boolean> {
    try {
      const config = await this.getConfiguration(configId, tenantId);
      if (!config) return false;

      const credentials = await this.getDecryptedCredentials(configId, tenantId);
      if (!credentials) return false;

      let isValid = false;

      switch (config.provider) {
        case "resend":
          isValid = await this.testResendConnection(credentials as import("../../drizzle/schema-email-config").ResendCredentials);
          break;
        case "smtp":
          isValid = await this.testSMTPConnection(credentials as import("../../drizzle/schema-email-config").SMTPCredentials);
          break;
        case "sendgrid":
          isValid = await this.testSendGridConnection(credentials as import("../../drizzle/schema-email-config").SendGridCredentials);
          break;
        case "mailgun":
          isValid = await this.testMailgunConnection(credentials as import("../../drizzle/schema-email-config").MailgunCredentials);
          break;
      }

      // Mettre à jour le statut du test
      const db = await getDbInstance();
      if (db) {
        await db
          .update(emailConfigurations)
          .set({
            lastTestedAt: new Date(),
            lastTestStatus: isValid ? "success" : "failed",
            lastTestError: isValid ? null : "Connection test failed",
          })
          .where(eq(emailConfigurations.id, configId));
      }

      return isValid;
    } catch (error: any) {
      logger.error("Email connection test failed", { configId, error });
      return false;
    }
  }

  /**
   * Teste la connexion Resend
   */
  private async testResendConnection(credentials: import("../../drizzle/schema-email-config").ResendCredentials): Promise<boolean> {
    try {
      const { Resend } = await import("resend");
      const resend = new Resend(credentials.apiKey);

      // Faire un appel simple pour vérifier la clé API
      const response = await resend.emails.send({
        from: "test@example.com",
        to: "test@example.com",
        subject: "Test",
        html: "Test",
      });

      // Si on reçoit une erreur d'authentification, la clé est invalide
      return !response.error;
    } catch {
      return false;
    }
  }

  /**
   * Teste la connexion SMTP
   */
  private async testSMTPConnection(credentials: import("../../drizzle/schema-email-config").SMTPCredentials): Promise<boolean> {
    try {
      const nodemailer = await import("nodemailer");
      const transporter = nodemailer.default.createTransport({
        host: credentials.host,
        port: credentials.port,
        secure: credentials.secure,
        auth: {
          user: credentials.username,
          pass: credentials.password,
        },
      });

      const result = await transporter.verify();
      return result;
    } catch {
      return false;
    }
  }

  /**
   * Teste la connexion SendGrid
   */
  private async testSendGridConnection(credentials: import("../../drizzle/schema-email-config").SendGridCredentials): Promise<boolean> {
    try {
      const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${credentials.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: "test@example.com" }] }],
          from: { email: "test@example.com" },
          subject: "Test",
          content: [{ type: "text/plain", value: "Test" }],
        }),
      });

      return response.status === 202;
    } catch {
      return false;
    }
  }

  /**
   * Teste la connexion Mailgun
   */
  private async testMailgunConnection(credentials: import("../../drizzle/schema-email-config").MailgunCredentials): Promise<boolean> {
    try {
      const region = credentials.region || "us";
      const baseUrl = region === "eu" ? "https://api.eu.mailgun.net" : "https://api.mailgun.net";

      const response = await fetch(`${baseUrl}/v3/domains`, {
        method: "GET",
        headers: {
          Authorization: `Basic ${Buffer.from(`api:${credentials.apiKey}`).toString("base64")}`,
        },
      });

      return response.status === 200;
    } catch {
      return false;
    }
  }

  /**
   * Supprime une configuration
   */
  async deleteConfiguration(configId: number, tenantId: number): Promise<void> {
    const db = await getDbInstance();
    if (!db) return;

    await db
      .delete(emailConfigurations)
      .where(and(eq(emailConfigurations.id, configId), eq(emailConfigurations.tenantId, tenantId)));

    logger.info("Email configuration deleted", { configId, tenantId });
  }

  /**
   * Enregistre un log d'envoi d'email
   */
  async logEmailSent(
    tenantId: number,
    configurationId: number,
    toEmail: string,
    subject: string,
    provider: string,
    status: "sent" | "failed" | "bounced",
    providerMessageId?: string,
    error?: string,
    providerResponse?: Record<string, unknown>
  ): Promise<void> {
    const db = await getDbInstance();
    if (!db) return;

    await db.insert(emailLogs).values({
      tenantId,
      configurationId,
      toEmail,
      subject,
      provider,
      status,
      providerMessageId,
      error,
      providerResponse,
    });
  }
}

export default new EmailConfigService();
