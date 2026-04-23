/**
 * Billing Service - PRODUCTION-READY
 * ✅ BLOC 2 FIX: Orchestration Stripe canonique, mapping de plans et idempotence métier
 * ✅ CORRECTION CRITIQUE:
 * - Toute logique Stripe sortante est centralisée ici
 * - Le mapping Plan Interne <-> Stripe Price ID est explicite
 * - Pas de logique Stripe dans le routeur
 */
import { getDbInstance } from "../db";
import { usageMetrics, tenants, subscriptions, invoices, type InsertUsageMetric, type Tenant } from "../../drizzle/schema";
import { logger } from "../infrastructure/logger";
import { eq, sql, and, gte, desc } from "drizzle-orm";
import * as stripeService from "./stripeService";
import { TRPCError } from "@trpc/server";

// ✅ BLOC 2 FIX: Mapping canonique des plans
export const PLAN_MAPPING: Record<string, { stripePriceId: string; name: string; price: number }> = {
  'starter': { stripePriceId: process.env.STRIPE_PRICE_STARTER || 'price_starter_v8', name: 'Starter', price: 179 },
  'pro': { stripePriceId: process.env.STRIPE_PRICE_PRO || 'price_pro_v8', name: 'Pro', price: 399 },
  'enterprise': { stripePriceId: process.env.STRIPE_PRICE_ENTERPRISE || 'price_enterprise_v8', name: 'Enterprise', price: 999 },
};

export class BillingService {
  /**
   * Récupère les informations de facturation d'un tenant (DB locale)
   */
  static async getTenantSubscription(tenantId: number) {
    const db = getDbInstance();
    const [sub] = await db.select().from(subscriptions).where(eq(subscriptions.tenantId, tenantId)).limit(1);
    return sub ?? null;
  }

  static async getTenantInvoices(tenantId: number) {
    const db = getDbInstance();
    return await db.select().from(invoices)
      .where(eq(invoices.tenantId, tenantId))
      .orderBy(desc(invoices.createdAt));
  }

  /**
   * Crée une session de paiement Stripe pour un plan spécifique
   * ✅ BLOC 2 FIX: Orchestration centralisée, mapping canonique
   */
  static async createSubscriptionSession(tenantId: number, planId: string, returnUrl: string) {
    const plan = PLAN_MAPPING[planId];
    if (!plan) throw new TRPCError({ code: 'BAD_REQUEST', message: `Plan invalide: ${planId}` });

    const db = getDbInstance();
    const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1);
    
    // Récupérer ou créer le client Stripe
    const settings = (tenant?.settings as Record<string, any>) || {};
    let stripeCustomerId = settings.stripeCustomerId;
    
    if (!stripeCustomerId) {
      stripeCustomerId = await stripeService.createStripeCustomer(
        settings.email || `tenant_${tenantId}@servicall.ai`,
        tenant?.name || `Tenant ${tenantId}`,
        tenantId
      );
      
      // Persister l'ID client immédiatement
      await db.update(tenants)
        .set({ 
          settings: { ...settings, stripeCustomerId } 
        } as Partial<Tenant>)
        .where(eq(tenants.id, tenantId));
    }

    const sessionUrl = await stripeService.createCheckoutSession({
      tenantId,
      stripeCustomerId,
      stripePriceId: plan.stripePriceId,
      successUrl: `${returnUrl}?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${returnUrl}?canceled=true`,
      metadata: { planId }
    });

    return sessionUrl;
  }

  /**
   * Met à jour un abonnement existant vers un nouveau plan
   */
  static async upgradeSubscription(tenantId: number, newPlanId: string) {
    const plan = PLAN_MAPPING[newPlanId];
    if (!plan) throw new TRPCError({ code: 'BAD_REQUEST', message: `Plan invalide: ${newPlanId}` });

    const sub = await this.getTenantSubscription(tenantId);
    if (!sub || !sub.stripeSubscriptionId) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: "Aucun abonnement Stripe actif à mettre à jour" });
    }

    const updated = await stripeService.updateStripeSubscription(
      tenantId,
      sub.stripeSubscriptionId,
      plan.stripePriceId,
      { planId: newPlanId }
    );

    return { status: updated.status, subscriptionId: updated.id };
  }

  /**
   * Annule un abonnement
   */
  static async cancelSubscription(tenantId: number) {
    const sub = await this.getTenantSubscription(tenantId);
    if (!sub || !sub.stripeSubscriptionId) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: "Aucun abonnement Stripe actif à annuler" });
    }

    await stripeService.cancelStripeSubscription(tenantId, sub.stripeSubscriptionId);
    return { success: true };
  }

  /**
   * Crée une session de portail client Stripe
   */
  static async createPortalSession(tenantId: number, returnUrl: string) {
    const db = getDbInstance();
    const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1);
    const settings = (tenant?.settings as Record<string, any>) || {};
    const stripeCustomerId = settings.stripeCustomerId;

    if (!stripeCustomerId) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: "Ce tenant n'a pas de compte client Stripe configuré" });
    }

    return await stripeService.createPortalSession(tenantId, stripeCustomerId, returnUrl);
  }

  /**
   * Enregistrer l'utilisation d'une ressource
   */
  static async recordUsage(data: {
    tenantId: number;
    resourceType: "twilio_voice" | "twilio_sms" | "openai_token";
    externalId?: string;
    quantity: number;
    cost?: number;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    try {
      const db = getDbInstance();
      const period = data.externalId ?? new Date().toISOString().slice(0, 7);

      await db.insert(usageMetrics).values({
        tenantId: data.tenantId,
        metricType: data.resourceType,
        value: data.quantity,
        period,
      } as InsertUsageMetric);

      logger.debug(`[Billing] Recorded ${data.resourceType} usage for tenant ${data.tenantId}`, {
        quantity: data.quantity,
        cost: data.cost,
        period,
      });
    } catch (error: unknown) {
      logger.error("[Billing] Failed to record usage", { 
        error: error instanceof Error ? error.message : String(error), 
        data 
      });
    }
  }

  /**
   * Récupérer les statistiques de consommation
   */
  static async getUsageStats(
    tenantId: number,
    days = 30
  ) {
    try {
      const db = getDbInstance();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const stats = await db
        .select({
          resourceType: usageMetrics.metricType,
          totalQuantity: sql<number>`sum(${usageMetrics.value})`,
        })
        .from(usageMetrics)
        .where(
          and(
            eq(usageMetrics.tenantId, tenantId),
            gte(usageMetrics.recordedAt, startDate)
          )
        )
        .groupBy(usageMetrics.metricType);

      return stats;
    } catch (error: unknown) {
      logger.error("[Billing] Failed to get usage stats", { 
        error: error instanceof Error ? error.message : String(error), 
        tenantId 
      });
      return null;
    }
  }
}
