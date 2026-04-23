import { logger } from "../infrastructure/logger";
import { sendAppointmentEmail } from "./notificationService";

export type AlertSeverity = "low" | "medium" | "high" | "critical";

export interface Alert {
  id: string;
  source: string;
  message: string;
  severity: AlertSeverity;
  timestamp: Date;
  metadata?: any;
}

export class AlertingService {
  // ✅ BLOC 1: Fallback codé en dur supprimé — ADMIN_ALERT_EMAIL requis
  private static adminEmail = process.env['ADMIN_ALERT_EMAIL'] ?? null;

  /**
   * Envoie une alerte proactive
   */
  static async sendAlert(alert: Omit<Alert, "id" | "timestamp">) {
    const fullAlert: Alert = {
      ...alert,
      id: crypto.randomUUID(),
      timestamp: new Date(),
    };

    // Log l'alerte
    const logMethod = fullAlert.severity === "critical" ? "error" : "warn";
    logger[logMethod](`[ALERT][${fullAlert.severity.toUpperCase()}] ${fullAlert.source}: ${fullAlert.message}`, fullAlert.metadata);

    // Si l'alerte est critique ou haute, envoyer un email
    if (fullAlert.severity === "critical" || fullAlert.severity === "high") {
      await this.notifyAdmin(fullAlert);
    }

    return fullAlert;
  }

  /**
   * Notifie l'administrateur par email
   */
  private static async notifyAdmin(alert: Alert) {
    try {
      
      await sendAppointmentEmail(this.adminEmail, {
        title: `ALERTE CRITIQUE : ${alert.source}`,
        startTime: alert.timestamp,
        endTime: alert.timestamp,
        description: `
          <h3>Détails de l'alerte</h3>
          <p><strong>Sévérité :</strong> ${alert.severity.toUpperCase()}</p>
          <p><strong>Source :</strong> ${alert.source}</p>
          <p><strong>Message :</strong> ${alert.message}</p>
          <pre>${JSON.stringify(alert.metadata, null, 2)}</pre>
        `,
      });
      logger.info(`[ALERT] Admin notified for ${alert.id}`);
    } catch (error: any) {
      logger.error("[ALERT] Failed to notify admin", { error, alertId: alert.id });
    }
  }

  /**
   * Vérifie la santé des services externes
   */
  static async checkExternalServices() {
    // Exemple de vérification Twilio
    if (!process.env['TWILIO_ACCOUNT_SID']) {
      await this.sendAlert({
        source: "Twilio",
        message: "Configuration Twilio manquante",
        severity: "critical",
      });
    }

    // Exemple de vérification OpenAI
    if (!process.env['OPENAI_API_KEY']) {
      await this.sendAlert({
        source: "OpenAI",
        message: "Clé API OpenAI manquante",
        severity: "critical",
      });
    }
  }
}