import { logger } from "../infrastructure/logger";
import { metrics } from "./metricsService";

export interface AlertConfig {
  name: string;
  threshold: number;
  windowMs: number;
  severity: "low" | "medium" | "high" | "critical";
  module: string;
}

/**
 * Alert Service - Détection proactive et notification d'anomalies
 */
class AlertService {
  private activeAlerts = new Map<string, number>();

  /**
   * Vérifier les seuils et déclencher des alertes
   */
  async checkAlerts() {
    const stats = metrics.getStats();
    
    // 1. Alerte sur taux d'erreur élevé (> 5%)
    if (stats.http_metrics.error_rate > 5) {
      this.triggerAlert({
        name: "High Error Rate",
        value: stats.http_metrics.error_rate,
        threshold: 5,
        severity: "high",
        module: "api"
      });
    }

    // 2. Alerte sur latence excessive (> 2s en p95)
    if (stats.http_metrics.latency_p95_ms > 2000) {
      this.triggerAlert({
        name: "High Latency P95",
        value: stats.http_metrics.latency_p95_ms,
        threshold: 2000,
        severity: "medium",
        module: "api"
      });
    }

    // 3. Alerte sur sentiment négatif massif
    const negativeSentiment = stats.business_metrics["call_sentiment_negative"]?.count ?? 0;
    if (negativeSentiment > 10) {
      this.triggerAlert({
        name: "Massive Negative Sentiment",
        value: negativeSentiment,
        threshold: 10,
        severity: "critical",
        module: "voice-ai"
      });
    }
  }

  /**
   * Déclencher une alerte
   */
  private triggerAlert(alert: {
    name: string;
    value: number;
    threshold: number;
    severity: string;
    module: string;
  }) {
    const alertKey = `${alert.module}:${alert.name}`;
    const now = Date.now();
    const lastTriggered = this.activeAlerts.get(alertKey) || 0;

    // Anti-spam: 5 minutes entre chaque alerte identique
    if (now - lastTriggered < 5 * 60 * 1000) return;

    this.activeAlerts.set(alertKey, now);

    logger.error(`[ALERT] ${alert.severity.toUpperCase()}: ${alert.name}`, {
      module: alert.module,
      value: alert.value,
      threshold: alert.threshold,
      severity: alert.severity
    });

    // Simulation d'envoi Slack/Email
    logger.info(`>>> SENDING NOTIFICATION: [${alert.severity}] ${alert.name} - Value: ${alert.value}`);
  }

  /**
   * Obtenir l'historique des alertes (simulé)
   */
  getAlertHistory() {
    return Array.from(this.activeAlerts.entries()).map(([key, timestamp]) => ({
      alert: key,
      lastTriggered: new Date(timestamp).toISOString()
    }));
  }

  /**
   * Envoie une alerte manuellement depuis un autre service
   */
  sendAlert(
    name: string,
    severity: "low" | "medium" | "high" | "critical",
    payload: Record<string, any>
  ) {
    const alert = {
      name,
      value: payload['value'] || 0,
      threshold: payload['threshold'] || 0,
      severity,
      module: payload['module'] || 'custom',
      ...payload
    };
    this.triggerAlert(alert);
  }
}

export const alertService = new AlertService();
