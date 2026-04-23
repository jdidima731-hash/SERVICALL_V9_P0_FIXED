/**
 * BYOK Router - Bring Your Own Key
 * Endpoints tRPC pour gérer les clés API centralisées
 */

import { router, tenantProcedure } from "../procedures";
import { z } from "zod";
import {
  saveAPIKey,
  getAPIKey,
  listAPIKeys,
  deleteAPIKey,
  testAPIKey,
  getAuditLogs,
} from "../services/byokService";
import { getStripeForTenant } from "../services/stripeService";

export const byokRouter = router({
  /**
   * Sauvegarder ou mettre à jour une clé API
   */
  saveKey: tenantProcedure
    .input(
      z.object({
        provider: z.string().min(1),
        key: z.string().min(1),
      })
    )
    .mutation(async ({ input, ctx }: any) => {
      const tenantId = ctx.tenantId!;
      return await saveAPIKey(tenantId, input.provider, input.key);
    }),

  /**
   * Récupérer une clé API (SÉCURISÉ : ne renvoie pas de secret sensible au frontend)
   */
  getKey: tenantProcedure
    .input(z.object({ provider: z.string().min(1) }))
    .query(async ({ input, ctx }: any) => {
      const tenantId = ctx.tenantId!;
      
      // SÉCURITÉ : Ne jamais renvoyer de secrets au frontend
      const sensitiveProviders = ["stripe_secret", "stripe_webhook_secret", "openai_key", "sendgrid_key"];
      if (sensitiveProviders.includes(input.provider)) {
        const key = await getAPIKey(tenantId, input.provider);
        return { key: key ? "********" : null }; // Masquer le secret
      }

      const key = await getAPIKey(tenantId, input.provider);
      return { key: key || null };
    }),

  /**
   * Récupère la clé publique Stripe du tenant (SÉCURISÉ)
   */
  getStripePublicKey: tenantProcedure.query(async ({ ctx }) => {
    const tenantId = ctx.tenantId!;
    const publicKey = await getStripeForTenant(tenantId);
    return { publicKey };
  }),

  /**
   * Lister toutes les clés API (sans les valeurs)
   */
  listKeys: tenantProcedure.query(async ({ ctx }) => {
    const tenantId = ctx.tenantId!;
    return await listAPIKeys(tenantId);
  }),

  /**
   * Supprimer une clé API
   */
  deleteKey: tenantProcedure
    .input(z.object({ provider: z.string().min(1) }))
    .mutation(async ({ input, ctx }: any) => {
      const tenantId = ctx.tenantId!;
      const success = await deleteAPIKey(tenantId, input.provider);
      return { success, message: success ? "Key deleted" : "Failed to delete key" };
    }),

  /**
   * Tester une clé API
   */
  testKey: tenantProcedure
    .input(
      z.object({
        provider: z.string().min(1),
        key: z.string().min(1),
      })
    )
    .mutation(async ({ input }: any) => {
      return await testAPIKey(input.provider, input.key);
    }),

  /**
   * Récupérer les logs d'audit
   */
  getAuditLogs: tenantProcedure.query(async ({ ctx }) => {
    const tenantId = ctx.tenantId!;
    return await getAuditLogs(tenantId, 100);
  }),
});
