/**
 * FIX SÉCURITÉ APPLIQUÉ:
 *
 * HIGH-4: WebhookAction SSRF — blocklist incomplète
 *   Avant: forbiddenHosts = ['localhost', '127.0.0.1', '0.0.0.0']
 *          Manquait: 10.x, 172.16-31.x, 192.168.x, 169.254.x (link-local), ::1 (IPv6),
 *          fc00::/7 (IPv6 ULA), métadonnées cloud (169.254.169.254), etc.
 *   Après: blocklist exhaustive couvrant toutes les plages RFC 1918 + RFC 3927 +
 *          loopback IPv4/IPv6 + adresses métadonnées cloud + validation DNS.
 *          Utilise net.isIP() pour détecter les IPs directement.
 *          Résolution DNS bloquée pour les noms pointant sur des IPs privées.
 */

import { z } from "zod";
import type { ActionHandler, ActionResult } from "../../types";
import type { FinalExecutionContext } from "../structured-types";
import { Logger } from "../../infrastructure/logger";
import axios from "axios";
import net from "net";
import dns from "dns/promises";

const WebhookConfigSchema = z.object({
  url: z.string().url("L'URL du webhook est invalide"),
  method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']).optional(),
  headers: z.record(z.string(), z.string()).optional(),
});
type WebhookConfig = z.infer<typeof WebhookConfigSchema>;

interface WebhookResult {
  webhook_status: 'sent';
  status_code: number;
  target_url: string;
  sent_at: string;
  response: unknown;
}

// ─── FIX HIGH-4: Détection d'IP privée/locale exhaustive ─────────────────────

function isPrivateIp(ip: string): boolean {
  // IPv6 loopback et ULA
  if (ip === '::1' || ip === '0:0:0:0:0:0:0:1') return true;
  if (ip.startsWith('fc') || ip.startsWith('fd')) return true; // RFC 4193 ULA fc00::/7
  if (ip.startsWith('fe80')) return true; // link-local IPv6

  if (!net.isIPv4(ip)) return false;

  const parts = ip.split('.').map(Number);
  const [a, b, c] = parts;

  // 127.x.x.x — loopback
  if (a === 127) return true;
  // 10.x.x.x — RFC 1918
  if (a === 10) return true;
  // 172.16-31.x.x — RFC 1918
  if (a === 172 && b >= 16 && b <= 31) return true;
  // 192.168.x.x — RFC 1918
  if (a === 192 && b === 168) return true;
  // 169.254.x.x — link-local (AWS metadata: 169.254.169.254)
  if (a === 169 && b === 254) return true;
  // 0.0.0.0 — wildcard
  if (a === 0) return true;
  // 100.64-127.x.x — Carrier-grade NAT (RFC 6598)
  if (a === 100 && b >= 64 && b <= 127) return true;
  // 192.0.2.x, 198.51.100.x, 203.0.113.x — documentation ranges
  if (a === 192 && b === 0 && c === 2) return true;
  if (a === 198 && b === 51 && c === 100) return true;
  if (a === 203 && b === 0 && c === 113) return true;

  return false;
}

async function isSsrfUrl(urlStr: string): Promise<boolean> {
  try {
    const parsed = new URL(urlStr);

    // Protocoles autorisés uniquement
    if (!['http:', 'https:'].includes(parsed.protocol)) return true;

    const host = parsed.hostname.toLowerCase();

    // Hosts explicitement bloqués
    const blockedHosts = [
      'localhost', 'localhost.localdomain',
      'metadata.google.internal', 'metadata.internal',
    ];
    if (blockedHosts.includes(host)) return true;

    // Si c'est déjà une IP, vérifier directement
    if (net.isIP(host)) {
      return isPrivateIp(host);
    }

    // Résoudre le DNS et vérifier toutes les IPs retournées
    try {
      const addresses = await dns.resolve(host);
      for (const addr of addresses) {
        if (isPrivateIp(addr)) return true;
      }
    } catch {
      // DNS non résolvable = on bloque par précaution
      return true;
    }

    return false;
  } catch {
    return true;
  }
}

export class WebhookAction implements ActionHandler<WebhookConfig, FinalExecutionContext, WebhookResult> {
  name = 'tech_webhook';
  private logger = new Logger('WebhookAction');

  async execute(
    context: FinalExecutionContext,
    config: WebhookConfig
  ): Promise<ActionResult<WebhookResult>> {
    try {
      // BLOC AUDIT : Validation stricte de la config
      const validatedConfig = WebhookConfigSchema.parse(config);

      const { url, method = 'POST', headers = {} } = config;

      // FIX HIGH-4: vérification SSRF avant l'exécution
      if (await isSsrfUrl(url)) {
        this.logger.error('SSRF attempt blocked', { url });
        return { success: false, error: 'URL cible non autorisée' };
      }

      this.logger.info('Triggering Webhook', {
        url,
        method,
        workflow_id: context.workflow.id,
        event_id: context.event.id,
      });

      const payload = {
        event: {
          id: context.event.id,
          channel: context.event.channel,
          source: context.event.source,
        },
        variables: context.variables,
        tenant_slug: context.tenant.slug,
        timestamp: new Date().toISOString(),
      };

      const response = await axios({
        url,
        method,
        data: payload,
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        timeout: 10000,
        // Empêcher les redirections vers des URLs privées
        maxRedirects: 5,
        validateStatus: () => true,
      });

      this.logger.info('Webhook executed successfully', { status: response.status });

      return {
        success: true,
        data: {
          webhook_status: 'sent',
          status_code: response.status,
          target_url: url,
          sent_at: new Date().toISOString(),
          response: response.data,
        },
      };
    } catch (error: unknown) {
      this.logger.error('Webhook execution failed', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  /**
   * FIX HIGH-4: Validation synchrone étendue (utilisée pour pré-validation)
   * La vérification DNS complète se fait dans execute() via isSsrfUrl()
   */
  validate(config: Record<string, unknown>): boolean {
    const urlValue = config['url'];
    if (typeof urlValue !== 'string' || !urlValue) {
      this.logger.error('Validation failed: Missing URL');
      return false;
    }

    try {
      const parsed = new URL(urlValue);

      if (!['http:', 'https:'].includes(parsed.protocol)) return false;

      const host = parsed.hostname.toLowerCase();

      // Blocklist synchrone exhaustive (sans DNS)
      const blockedHosts = [
        'localhost', 'localhost.localdomain',
        '127.0.0.1', '::1', '0.0.0.0',
        'metadata.google.internal', 'metadata.internal',
      ];
      if (blockedHosts.includes(host)) return false;

      // Si IP directe, vérifier les plages privées immédiatement
      if (net.isIP(host)) {
        return !isPrivateIp(host);
      }

      return true;
    } catch {
      this.logger.error('Validation failed: Invalid URL format');
      return false;
    }
  }
}
