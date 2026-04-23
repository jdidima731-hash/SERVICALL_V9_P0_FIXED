import { z } from "zod";
import { router } from "../_core/trpc";
import { tenantProcedure, managerProcedure, adminProcedure } from "../procedures";
import { TRPCError } from "@trpc/server";
import { eq, and } from "drizzle-orm";
import { getDbInstance } from "../db";
import { rgpdConsents, prospects } from "../../drizzle/schema";
import { RightToBeForgottenService } from "../services/RightToBeForgottenService";
import { logger } from "../infrastructure/logger";
import { AuditService } from "../services/auditService";

/**
 * RGPD Router - Gestion de la conformité, des consentements et des droits des personnes
 * ✅ AXE 4: Anonymisation RGPD explicite et Audit Log renforcé
 * ✅ BLOC 10: Export et Suppression complète
 */

export const rgpdRouter = router({
  /**
   * Enregistrer un consentement (Opt-in)
   */
  grantConsent: tenantProcedure
    .input(z.object({
      prospectId: z.number(),
      purpose: z.enum(["recording", "ai", "marketing", "analytics", "telephony"]),
      channel: z.enum(["voice", "email", "sms", "web"]),
    }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenantId) throw new TRPCError({ code: 'UNAUTHORIZED' });
      const db = getDbInstance();
      
      const [prospect] = await db.select().from(prospects)
        .where(and(eq(prospects.id, input.prospectId), eq(prospects.tenantId, ctx.tenantId!)))
        .limit(1);
      
      if (!prospect) throw new TRPCError({ code: "NOT_FOUND", message: "Prospect non trouvé" });

      
      const [result] = await db.insert(rgpdConsents).values({
        prospectId: input.prospectId,
        consentPurpose: input.purpose,
        consentGiven: true,
        grantedAt: new Date(),
        policyVersion: "2.0",
      });

      await AuditService.log({
        tenantId: ctx.tenantId!,
        userId: ctx.user!.id,
        action: "CONSENT_GRANTED",
        resource: "prospect",
        resourceId: input.prospectId,
        actorType: "human",
        source: "API",
        impactRGPD: true,
        metadata: { purpose: input.purpose, channel: input.channel }
      });

      
      return { success: true, consentId: result.id };
    }),

  /**
   * Export des données personnelles (Art. 20 RGPD)
   * ✅ BLOC 10
   */
  exportPersonalData: adminProcedure
    .input(z.object({ prospectId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenantId) throw new TRPCError({ code: 'UNAUTHORIZED' });
      try {
        const data = await RightToBeForgottenService.exportUserData(input.prospectId, ctx.tenantId!);
        
        await AuditService.log({
          tenantId: ctx.tenantId!,
          userId: ctx.user!.id,
          action: "DATA_EXPORT",
          resource: "prospect",
          resourceId: input.prospectId,
          actorType: "human",
          source: "SYSTEM",
          impactRGPD: true,
          metadata: { baseLegale: "Art. 20 RGPD - Portabilité" }
        });

        return data;
      } catch (error: any) {
        logger.error("[RGPD Router] Error in exportPersonalData", { error, prospectId: input.prospectId });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Erreur lors de l'export des données",
        });
      }
    }),

  /**
   * Droit à l'effacement / Anonymisation (Art. 17 RGPD)
   * ✅ AXE 4: Utilisation du RightToBeForgottenService pour une anonymisation complète
   * ✅ BLOC 10: Suppression complète et logs anonymisés
   */
  anonymizeProspect: adminProcedure
    .input(z.object({ prospectId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenantId) throw new TRPCError({ code: 'UNAUTHORIZED' });
      try {
        // Utilisation du service dédié pour une anonymisation profonde (PII, Appels, IA, Tiers)
        const result = await RightToBeForgottenService.forgetProspect(input.prospectId, ctx.tenantId!);
        
        if (!result.success) {
          throw new Error("Échec de l'anonymisation");
        }

        return { 
          success: true, 
          message: "Prospect anonymisé avec succès (PII, Appels et Insights IA purgés)",
          details: result.details
        };
      } catch (error: any) {
        logger.error("[RGPD Router] Error in anonymizeProspect", { error, prospectId: input.prospectId });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Erreur lors de l'exécution du droit à l'oubli",
        });
      }
    }),

  /**
   * Journal RGPD : Consulter les logs d'audit (Transparence)
   */
  getAuditLogs: managerProcedure
    .input(z.object({ 
      limit: z.number().min(1).max(100).default(50),
      offset: z.number().default(0)
    }))
    .query(async ({ ctx, input }) => {
      if (!ctx.tenantId) throw new TRPCError({ code: 'UNAUTHORIZED' });
      return await AuditService.getTenantLogs(ctx.tenantId!, input.limit, input.offset);
    }),
});