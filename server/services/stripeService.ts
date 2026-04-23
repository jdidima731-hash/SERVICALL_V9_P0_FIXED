/**
 * Stripe Service - BYOK (Bring Your Own Key) Multi-tenant
 * ✅ BLOC 2 FIX: Idempotence explicite et sémantique canonique
 * ✅ CORRECTION CRITIQUE:
 * - Toute mutation (create/update) DOIT porter une idempotency_key
 * - Les identifiants sont strictement nommés (stripeCustomerId, stripeSubscriptionId, etc.)
 */

import Stripe from "stripe";
import { logger } from "../infrastructure/logger";
import { getAPIKey } from "./byokService";
import * as crypto from "crypto";

// Cache pour les instances Stripe par tenantId
const _stripeInstances: Map<number, Stripe> = new Map();

/**
 * Récupère une instance Stripe pour un tenant spécifique
 */
export async function getStripeForTenant(tenantId: number): Promise<Stripe> {
  if (_stripeInstances.has(tenantId)) {
    return _stripeInstances.get(tenantId)!;
  }

  const apiKey = await getAPIKey(tenantId, "stripe_secret");
  
  if (!apiKey) {
    logger.error(`[Stripe] No stripe_secret found for tenant ${tenantId}`);
    throw new Error(`Stripe configuration missing for tenant ${tenantId}`);
  }

  const stripe = new Stripe(apiKey, {
    apiVersion: "2023-10-16",
  });

  _stripeInstances.set(tenantId, stripe);
  logger.info(`[Stripe] Client initialized for tenant ${tenantId}`);
  
  return stripe;
}

/**
 * Génère une clé d'idempotence déterministe pour une opération
 */
function generateIdempotencyKey(tenantId: number, operation: string, payload: any): string {
  const hash = crypto.createHash('sha256')
    .update(JSON.stringify(payload))
    .digest('hex')
    .substring(0, 16);
  return `sk_v8_${tenantId}_${operation}_${hash}`;
}

// ============================================
// CUSTOMER MANAGEMENT
// ============================================

export async function createStripeCustomer(
  email: string,
  name: string,
  tenantId: number,
  metadata?: Record<string, string>
): Promise<string> {
  try {
    const stripe = await getStripeForTenant(tenantId);
    const payload = {
      email,
      name,
      metadata: {
        tenantId: tenantId.toString(),
        ...metadata,
      },
    };

    // ✅ BLOC 2 FIX: Idempotence explicite
    const customer = await stripe.customers.create(payload, {
      idempotencyKey: generateIdempotencyKey(tenantId, 'cust_create', payload)
    });

    return customer.id;
  } catch (error: any) {
    logger.error(`[Stripe Service] Error creating customer for tenant ${tenantId}:`, error);
    throw new Error("Failed to create Stripe customer");
  }
}

export async function updateStripeCustomer(
  tenantId: number,
  stripeCustomerId: string,
  data: {
    email?: string;
    name?: string;
    metadata?: Record<string, string>;
  }
): Promise<void> {
  try {
    const stripe = await getStripeForTenant(tenantId);
    // ✅ BLOC 2 FIX: Idempotence explicite
    await stripe.customers.update(stripeCustomerId, data, {
      idempotencyKey: generateIdempotencyKey(tenantId, `cust_upd_${stripeCustomerId}`, data)
    });
  } catch (error: any) {
    logger.error(`[Stripe Service] Error updating customer ${stripeCustomerId} for tenant ${tenantId}:`, error);
    throw new Error("Failed to update Stripe customer");
  }
}

// ============================================
// SUBSCRIPTION MANAGEMENT
// ============================================

export async function createStripeSubscription(
  tenantId: number,
  stripeCustomerId: string,
  stripePriceId: string,
  metadata?: Record<string, string>
): Promise<Stripe.Subscription> {
  try {
    const stripe = await getStripeForTenant(tenantId);
    const payload = {
      customer: stripeCustomerId,
      items: [{ price: stripePriceId }],
      payment_behavior: "default_incomplete" as const,
      payment_settings: { save_default_payment_method: "on_subscription" as const },
      expand: ["latest_invoice.payment_intent"],
      metadata: {
        tenantId: tenantId.toString(),
        ...metadata,
      },
    };

    // ✅ BLOC 2 FIX: Idempotence explicite sur la création d'abonnement
    const subscription = await stripe.subscriptions.create(payload, {
      idempotencyKey: generateIdempotencyKey(tenantId, 'sub_create', payload)
    });

    return subscription;
  } catch (error: any) {
    logger.error(`[Stripe Service] Error creating subscription for tenant ${tenantId}:`, error);
    throw new Error("Failed to create Stripe subscription");
  }
}

export async function updateStripeSubscription(
  tenantId: number,
  stripeSubscriptionId: string,
  stripePriceId: string,
  metadata?: Record<string, string>
): Promise<Stripe.Subscription> {
  try {
    const stripe = await getStripeForTenant(tenantId);
    
    // Récupérer l'abonnement pour avoir l'ID de l'item actuel
    const subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);
    const itemId = subscription.items.data[0].id;

    const payload = {
      items: [{
        id: itemId,
        price: stripePriceId,
      }],
      proration_behavior: 'create_prorations' as const,
      metadata: {
        ...metadata,
      },
    };

    // ✅ BLOC 2 FIX: Idempotence explicite sur la mise à jour
    return await stripe.subscriptions.update(stripeSubscriptionId, payload, {
      idempotencyKey: generateIdempotencyKey(tenantId, `sub_upd_${stripeSubscriptionId}`, payload)
    });
  } catch (error: any) {
    logger.error(`[Stripe Service] Error updating subscription ${stripeSubscriptionId} for tenant ${tenantId}:`, error);
    throw new Error("Failed to update Stripe subscription");
  }
}

export async function cancelStripeSubscription(
  tenantId: number,
  stripeSubscriptionId: string
): Promise<void> {
  try {
    const stripe = await getStripeForTenant(tenantId);
    // ✅ BLOC 2 FIX: Idempotence explicite sur l'annulation
    await stripe.subscriptions.cancel(stripeSubscriptionId, {}, {
      idempotencyKey: generateIdempotencyKey(tenantId, `sub_can_${stripeSubscriptionId}`, { canceled: true })
    });
  } catch (error: any) {
    logger.error(`[Stripe Service] Error canceling subscription ${stripeSubscriptionId} for tenant ${tenantId}:`, error);
    throw new Error("Failed to cancel Stripe subscription");
  }
}

// ============================================
// INVOICE MANAGEMENT
// ============================================

export async function createStripeInvoice(
  tenantId: number,
  stripeCustomerId: string,
  amount: number,
  description: string,
  metadata?: Record<string, string>
): Promise<Stripe.Invoice> {
  try {
    const stripe = await getStripeForTenant(tenantId);
    
    const itemPayload = {
      customer: stripeCustomerId,
      amount: Math.round(amount * 100),
      currency: "eur",
      description,
      metadata: {
        tenantId: tenantId.toString(),
        ...metadata,
      },
    };

    // 1. Create an invoice item with idempotence
    await stripe.invoiceItems.create(itemPayload, {
      idempotencyKey: generateIdempotencyKey(tenantId, 'inv_item_create', itemPayload)
    });

    const invoicePayload = {
      customer: stripeCustomerId,
      auto_advance: true,
      metadata: {
        tenantId: tenantId.toString(),
        ...metadata,
      },
    };

    // 2. Create the invoice with idempotence
    const invoice = await stripe.invoices.create(invoicePayload, {
      idempotencyKey: generateIdempotencyKey(tenantId, 'inv_create', invoicePayload)
    });

    // 3. Finalize
    return await stripe.invoices.finalizeInvoice(invoice.id);
  } catch (error: any) {
    logger.error(`[Stripe Service] Error creating invoice for tenant ${tenantId}:`, error);
    throw new Error("Failed to create Stripe invoice");
  }
}

// ============================================
// PORTAL & SESSIONS
// ============================================

export async function createPortalSession(tenantId: number, stripeCustomerId: string, returnUrl: string): Promise<string> {
  try {
    const stripe = await getStripeForTenant(tenantId);
    const session = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: returnUrl,
    });
    return session.url;
  } catch (error: any) {
    logger.error(`[Stripe Service] Error creating portal session for tenant ${tenantId}:`, error);
    throw new Error("Failed to create Stripe portal session");
  }
}

export async function createCheckoutSession(params: {
  tenantId: number,
  stripeCustomerId: string,
  stripePriceId: string,
  successUrl: string,
  cancelUrl: string,
  metadata?: Record<string, string>
}): Promise<string> {
  try {
    const stripe = await getStripeForTenant(params.tenantId);
    const session = await stripe.checkout.sessions.create({
      customer: params.stripeCustomerId,
      payment_method_types: ['card'],
      line_items: [{ price: params.stripePriceId, quantity: 1 }],
      mode: 'subscription',
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
      metadata: {
        tenantId: params.tenantId.toString(),
        ...params.metadata
      }
    });
    return session.url!;
  } catch (error: any) {
    logger.error(`[Stripe Service] Error creating checkout session for tenant ${params.tenantId}:`, error);
    throw new Error("Failed to create Stripe checkout session");
  }
}

/**
 * Récupère l'URL du PDF d'une facture Stripe
 */
export async function getStripeInvoicePdf(tenantId: number, stripeInvoiceId: string): Promise<string | null> {
  try {
    const stripe = await getStripeForTenant(tenantId);
    const invoice = await stripe.invoices.retrieve(stripeInvoiceId);
    return invoice.invoice_pdf;
  } catch (error: any) {
    logger.error(`[Stripe Service] Error retrieving invoice PDF for tenant ${tenantId}:`, error);
    return null;
  }
}

/**
 * Récupère la clé publique Stripe pour un tenant
 * (Utilisé par le frontend pour initialiser Elements)
 */
export async function getStripePublicKeyForTenant(tenantId: number): Promise<string> {
  const publicKey = await getAPIKey(tenantId, "stripe_public");

  if (!publicKey) {
    logger.error(`[Stripe] No stripe_public found for tenant ${tenantId}`);
    throw new Error(`Stripe public configuration missing for tenant ${tenantId}`);
  }

  return publicKey;
}
