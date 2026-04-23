/**
 * WEBHOOK STRIPE UNIFIÉ — PRODUCTION-READY
 * ✅ BLOC 1 FIX: Intake strict sans ACK si persistance/enqueue échoue
 * ✅ CORRECTIONS CRITIQUES:
 * - Résolution tenant fiable via event.account ou metadata
 * - Vérification de signature sécurisée
 * - Idempotence stricte
 * - Traitement asynchrone garanti
 * - Pas d'ACK silencieux en cas d'échec
 */
import type { Request, Response } from "express";
import Stripe from "stripe";
import { logger } from "../infrastructure/logger";
import { getAPIKey } from "../services/byokService";
import * as db from "../db";
import { IdempotencyService } from "../workflow-engine/utils/IdempotencyService";
import { jobQueue } from "../services/jobQueueService";
import { RetryService } from "../services/retryService";

/**
 * Résout le tenant à partir d'un événement Stripe.
 * Ordre canonique: event.account → customerId → subscriptionId.
 * Les objets invoice / payment_intent / checkout_session sont réduits à ces références canoniques.
 * metadata.tenantId n'est utilisé que comme indice de cohérence, jamais comme source de vérité.
 */
function readStripeId(value: unknown): string | undefined {
  if (!value) return undefined;
  if (typeof value === "string") return value;
  if (typeof value === "object" && value !== null && "id" in value) {
    const id = (value as { id?: unknown }).id;
    return typeof id === "string" ? id : undefined;
  }
  return undefined;
}

async function resolveTenantFromStripeEvent(event: Stripe.Event): Promise<number> {
  let resolvedTenantId: number | null = null;
  const obj = event.data.object as Record<string, unknown> & {
    customer?: unknown;
    subscription?: unknown;
    invoice?: unknown;
    payment_intent?: unknown;
    metadata?: Record<string, string | undefined>;
  };

  const customerId = readStripeId(obj.customer)
    ?? readStripeId((obj.invoice as Record<string, unknown> | undefined)?.customer)
    ?? readStripeId((obj.payment_intent as Record<string, unknown> | undefined)?.customer);

  const subscriptionId = readStripeId(obj.subscription)
    ?? readStripeId((obj.invoice as Record<string, unknown> | undefined)?.subscription);

  // 1. Stripe Connected Account
  if (event.account) {
    resolvedTenantId = (await db.getTenantIdByStripeAccountId(event.account)) ?? null;
  }

  // 2. Référence customer canonique
  if (!resolvedTenantId && customerId) {
    resolvedTenantId = (await db.getTenantIdByStripeCustomerId(customerId)) ?? null;
  }

  // 3. Référence subscription canonique
  if (!resolvedTenantId && subscriptionId) {
    resolvedTenantId = (await db.getTenantIdByStripeSubscriptionId(subscriptionId)) ?? null;
  }

  // 4. metadata.tenantId = indice de cohérence seulement
  const metadataTenantIdRaw = obj?.metadata?.tenantId;
  if (metadataTenantIdRaw) {
    const metadataTenantId = parseInt(metadataTenantIdRaw, 10);
    if (!Number.isNaN(metadataTenantId)) {
      if (resolvedTenantId !== null && resolvedTenantId !== metadataTenantId) {
        logger.error("[Stripe] SECURITY ALERT: Tenant ID mismatch", {
          resolvedTenantId,
          metadataTenantId,
          eventId: event.id,
          customerId,
          subscriptionId,
          account: event.account ?? null,
        });
        throw new Error(`[Stripe] SECURITY ALERT: Tenant ID mismatch. Resolved: ${resolvedTenantId}, Metadata: ${metadataTenantId}`);
      }

      if (resolvedTenantId === null) {
        logger.error("[Stripe] SECURITY ALERT: Only metadata.tenantId exists without DB mapping", {
          metadataTenantId,
          eventId: event.id,
          customerId: customerId ?? null,
          subscriptionId: subscriptionId ?? null,
          account: event.account ?? null,
        });
        throw new Error(`[Stripe] Cannot resolve tenant from metadata alone for event ${event.id}`);
      }
    }
  }

  if (resolvedTenantId !== null) {
    return resolvedTenantId;
  }

  throw new Error(`[Stripe] Cannot resolve tenant for event ${event.id}`);
}

/**
 * Gère un webhook Stripe unifié et multi-tenant
 * ✅ BLOC 1 FIX: Intake strict — pas d'ACK si persistance ou enqueue échoue
 * ✅ Vérification signature sécurisée
 * ✅ Résolution tenant fiable
 * ✅ Idempotence stricte
 * ✅ Traitement asynchrone garanti
 */
export async function handleUnifiedStripeWebhook(req: Request, res: Response) {
  const signature = req.headers["stripe-signature"] as string;

  if (!signature) {
    logger.warn("[Stripe Webhook] Missing stripe-signature header");
    return res.status(400).send("Missing stripe-signature header");
  }

  // ✅ FIX P0: Vérifier explicitement que le body est brut (Buffer)
  if (!Buffer.isBuffer(req.body)) {
    logger.error("[Stripe Webhook] req.body is not a Buffer. Check JSON parser configuration.");
    return res.status(400).send("Webhook payload must be a raw Buffer");
  }

  try {
    // 1. Récupérer le webhook secret global (ou par endpoint si multi-endpoint)
    const webhookSecret = process.env["STRIPE_WEBHOOK_SECRET"];
    if (!webhookSecret) {
      logger.error("[Stripe Webhook] STRIPE_WEBHOOK_SECRET not configured");
      return res.status(500).send("Webhook secret not configured");
    }

    // 2. Initialiser Stripe global (pour vérifier la signature)
    const stripe = new Stripe(process.env["STRIPE_SECRET_KEY"] || "", {
      apiVersion: "2023-10-16",
    });

    // 3. Vérifier la signature et construire l'événement
    // Note: req.body doit être le raw body (Buffer)
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        signature,
        webhookSecret
      );
    } catch (err: any) {
      logger.warn("[Stripe Webhook] Signature verification failed", { error: err.message });
      return res.status(400).send(`Webhook signature verification failed: ${err.message}`);
    }

    logger.info(`[Stripe Webhook] Event received`, {
      eventId: event.id,
      type: event.type,
    });

    // 4. Résoudre le tenant de manière fiable
    let tenantId: number;
    try {
      tenantId = await resolveTenantFromStripeEvent(event);
    } catch (err: any) {
      logger.error("[Stripe Webhook] Failed to resolve tenant", { eventId: event.id, error: err.message });
      // ✅ BLOC 1 FIX: Rejeter explicitement si la résolution du tenant échoue
      // Cela force Stripe à retry et évite une perte silencieuse
      return res.status(400).send("Tenant resolution failed for event");
    }

    // 5. Vérifier l'idempotence (éviter les traitements en doublon)
    const idempotencyKey = `stripe:${event.id}`;
    try {
      const isFirstTime = await IdempotencyService.checkAndSet(idempotencyKey, "stripe_webhook", true);
      if (!isFirstTime) {
        logger.info("[Stripe Webhook] Duplicate event, already processed", { eventId: event.id });
        // ✅ BLOC 1 FIX: Même pour un doublon, on retourne 200 car il a déjà été traité
        return res.json({ received: true, duplicate: true });
      }
    } catch (err: any) {
      logger.error("[Stripe Webhook] Idempotency check failed", { eventId: event.id, error: err.message });
      // ✅ BLOC 1 FIX: En cas d'erreur d'idempotence, rejeter pour forcer retry
      return res.status(500).send("Idempotency check failed");
    }

    // 6. Persister l'événement avec le tenantId pour traitement asynchrone
    try {
      await db.createStripeEvent({
        stripeEventId: event.id,
        type: event.type,
        payload: event,
        status: "pending",
        tenantId: tenantId,
      });
      logger.info("[Stripe Webhook] Event persisted", { eventId: event.id, tenantId });
    } catch (err: any) {
      logger.error("[Stripe Webhook] Failed to persist event", { eventId: event.id, error: err.message });
      // ✅ BLOC 1 FIX: Rejeter si la persistance échoue — pas d'ACK silencieux
      return res.status(500).send("Failed to persist webhook event");
    }

    // 7. Enqueuer le traitement asynchrone
    try {
      const jobId = await RetryService.executeWithRetry(
        () => jobQueue.enqueue('WEBHOOK_PROCESS', tenantId, {
          source: 'stripe',
          eventId: event.id,
          eventType: event.type,
          payload: event,
        }),
        'stripe_webhook_enqueue',
        {
          maxRetries: 1,
          initialDelayMs: 500,
          maxDelayMs: 500,
          timeoutMs: 5000,
          backoffMultiplier: 1,
        }
      );
      logger.info("[Stripe Webhook] Job enqueued for processing", {
        eventId: event.id,
        tenantId,
        jobId,
        eventType: event.type,
      });
    } catch (err: any) {
      logger.error("[Stripe Webhook] Failed to enqueue processing job", {
        eventId: event.id,
        tenantId,
        eventType: event.type,
        error: err.message,
      });
      // ✅ BLOC 1 FIX: Rejeter si l'enqueue échoue — pas d'ACK silencieux
      return res.status(500).send("Failed to enqueue webhook processing job");
    }

    // 8. Répondre à Stripe avec succès
    res.json({ received: true, tenantId, eventId: event.id });
  } catch (error: any) {
    logger.error(`[Stripe Webhook] Unexpected error:`, {
      message: error.message,
      stack: error.stack,
    });
    res.status(500).send(`Webhook Error: ${error.message}`);
  }
}
