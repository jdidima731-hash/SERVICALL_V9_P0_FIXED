/**
 * BillingRepository — Opérations de facturation sécurisées et transactionnelles
 * ✅ FIX P2.2: Toutes les opérations de facturation sont atomiques
 */

import { BaseRepository } from "./BaseRepository";
import { subscriptions, invoices } from "../../drizzle/schema";
import {}
from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
type Database = PostgresJsDatabase<any>;
import { eq, and } from "drizzle-orm";
import { logger } from "../infrastructure/logger";

export class BillingRepository extends BaseRepository<typeof subscriptions.$inferSelect> {
  constructor(db: Database) {
    super(db, subscriptions, subscriptions.tenantId);
  }

  /**
   * ✅ FIX P2.2: Créer un abonnement avec facture — Opération atomique
   */
  async createSubscriptionWithInvoice(
    tenantId: number,
    subscriptionData: {
      planId: string;
      customerId: string;
      status: string;
    },
    invoiceData: {
      amount: number;
      status: string;
    }
  ) {
    return await this.transaction(async (tx) => {
      try {
        // Étape 1 : Créer l'abonnement
        const subscriptionResult = await tx
          .insert(subscriptions)
          .values({ ...subscriptionData, tenantId })
          .returning();

        if (!subscriptionResult[0]) {
          throw new Error("Failed to create subscription");
        }

        const subscription = subscriptionResult[0];

        // Étape 2 : Créer la facture
        const invoiceResult = await tx
          .insert(invoices)
          .values({
            ...invoiceData,
            tenantId,
            subscriptionId: subscription.id,
          })
          .returning();

        if (!invoiceResult[0]) {
          throw new Error("Failed to create invoice");
        }

        logger.info("[BillingRepository] Subscription with invoice created", {
          subscriptionId: subscription.id,
          invoiceId: invoiceResult[0].id,
          tenantId,
        });

        // ✅ Si on arrive ici, les deux opérations ont réussi
        return {
          subscription,
          invoice: invoiceResult[0],
        };
      } catch (error: any) {
        logger.error("[BillingRepository] Transaction failed", { tenantId, error: error.message });
        throw error;
      }
    });
  }

  /**
   * ✅ FIX P2.2: Mettre à jour le plan d'abonnement — Opération atomique
   */
  async updateSubscriptionPlan(
    subscriptionId: number,
    tenantId: number,
    newPlanId: string,
    newPrice: number
  ) {
    return await this.transaction(async (tx) => {
      try {
        // Étape 1 : Mettre à jour l'abonnement
        const updated = await tx
          .update(subscriptions)
          .set({ planId: newPlanId, price: newPrice })
          .where(
            and(
              eq(subscriptions.id, subscriptionId),
              eq(subscriptions.tenantId, tenantId)
            )
          )
          .returning();

        if (!updated[0]) {
          throw new Error("Subscription not found");
        }

        logger.info("[BillingRepository] Subscription plan updated", {
          subscriptionId,
          newPlanId,
          tenantId,
        });

        return updated[0];
      } catch (error: any) {
        logger.error("[BillingRepository] Update plan failed", { subscriptionId, tenantId, error: error.message });
        throw error;
      }
    });
  }

  /**
   * ✅ FIX P2.2: Annuler un abonnement — Opération atomique
   */
  async cancelSubscription(subscriptionId: number, tenantId: number) {
    return await this.transaction(async (tx) => {
      try {
        const updated = await tx
          .update(subscriptions)
          .set({ status: "cancelled" })
          .where(
            and(
              eq(subscriptions.id, subscriptionId),
              eq(subscriptions.tenantId, tenantId)
            )
          )
          .returning();

        if (!updated[0]) {
          throw new Error("Subscription not found");
        }

        logger.info("[BillingRepository] Subscription cancelled", {
          subscriptionId,
          tenantId,
        });

        return updated[0];
      } catch (error: any) {
        logger.error("[BillingRepository] Cancel subscription failed", { subscriptionId, tenantId, error: error.message });
        throw error;
      }
    });
  }
}
