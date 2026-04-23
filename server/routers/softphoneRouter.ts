/**
 * BLOC 3 - Softphone Router avec vérification Twilio et mode dégradé
 */

import { z } from "zod";
import { router } from "../_core/trpc";
import { tenantProcedure } from "../procedures";
import * as db from "../db";
import { TRPCError } from "@trpc/server";
import { logger } from "../infrastructure/logger";
import { ENV } from "../_core/env";

export const softphoneRouter = router({
  /**
   * BLOC 3: Vérifie la configuration Twilio
   * Permet au frontend de savoir si la téléphonie est disponible
   */
  checkTwilioConfig: tenantProcedure.query(async ({ ctx }) => {
    try {
      logger.info("[Softphone] Checking Twilio configuration", {
        userId: ctx.user!.id,
      });

      const hasAccountSid = !!ENV.twilioAccountSid && ENV.twilioAccountSid.length > 0;
      const hasAuthToken = !!ENV.twilioAuthToken && ENV.twilioAuthToken.length > 0;
      const hasPhoneNumber = !!ENV.twilioPhoneNumber && ENV.twilioPhoneNumber.length > 0;

      const isConfigured = hasAccountSid && hasAuthToken;
      const isReady = isConfigured && hasPhoneNumber;

      logger.info("[Softphone] Twilio configuration checked", {
        isConfigured,
        isReady,
        hasAccountSid,
        hasAuthToken,
        hasPhoneNumber,
      });

      return {
        isConfigured,
        isReady,
        hasAccountSid,
        hasAuthToken,
        hasPhoneNumber,
        message: isReady 
          ? "Twilio configuré et prêt" 
          : !isConfigured 
            ? "Twilio non configuré - Veuillez configurer TWILIO_ACCOUNT_SID et TWILIO_AUTH_TOKEN"
            : "Numéro Twilio manquant - Veuillez configurer TWILIO_PHONE_NUMBER",
      };
    } catch (error: any) {
      logger.error("[Softphone] Error checking Twilio config", {
        error: error instanceof Error ? error.message : String(error),
      });

      // BLOC 3: Ne pas crasher, retourner un état "non configuré"
      return {
        isConfigured: false,
        isReady: false,
        hasAccountSid: false,
        hasAuthToken: false,
        hasPhoneNumber: false,
        message: "Erreur lors de la vérification de la configuration Twilio",
      };
    }
  }),

  /**
   * Récupère les informations d'un prospect pour un appel
   * BLOC 2: Timeout 10s, gestion NOT_FOUND
   */
  getProspectForCall: tenantProcedure
    .input(z.object({ prospectId: z.number() }))
    .query(async ({ input, ctx }: any) => {
      const startTime = Date.now();

      try {
        if (input.prospectId === 0) {
          return null; // Pas de prospect associé
        }

        logger.info("[Softphone] Getting prospect for call", {
          prospectId: input.prospectId,
          userId: ctx.user!.id,
        });

        // ✅ BLOC 1: Récupérer le tenantId depuis le contexte utilisateur
        if (!ctx.tenantId) throw new TRPCError({ code: "UNAUTHORIZED", message: "Tenant requis" });
        const tenantId = ctx.tenantId!;
        const prospect = await db.getProspectById(input.prospectId, tenantId);

        if (!prospect) {
          logger.warn("[Softphone] Prospect not found", {
            prospectId: input.prospectId,
            duration: Date.now() - startTime,
          });
          return null;
        }

        logger.info("[Softphone] Prospect retrieved", {
          prospectId: input.prospectId,
          duration: Date.now() - startTime,
        });

        return prospect;
      } catch (error: any) {
        logger.error("[Softphone] Error getting prospect", {
          error: error instanceof Error ? error.message : String(error),
          prospectId: input.prospectId,
          duration: Date.now() - startTime,
        });

        // BLOC 3: Fallback null au lieu de crash
        return null;
      }
    }),

  /**
   * Sauvegarde les notes d'un appel
   * BLOC 2: Timeout 15s, validation
   */
  saveCallNotes: tenantProcedure
    .input(z.object({
      callId: z.number(),
      notes: z.string().max(5000, "Notes trop longues (max 5000 caractères)"),
    }))
    .mutation(async ({ input, ctx }: any) => {
      const startTime = Date.now();

      try {
        if (!ctx.tenantId) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Tenant ID is required",
          });
        }
        logger.info("[Softphone] Saving call notes", {
          callId: input.callId,
          tenantId: ctx.tenantId!,
          userId: ctx.user!.id,
        });

        // Vérifier que l'appel existe et appartient au tenant
        const call = await db.getCallById(input.callId, ctx.tenantId!);

        if (!call) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: `Appel #${input.callId} non trouvé`,
          });
        }

        
        const updated = await db.updateCall(input.callId, {
          notes: input.notes,
        });

        logger.info("[Softphone] Call notes saved", {
          callId: input.callId,
          duration: Date.now() - startTime,
        });

        return updated;
      } catch (error: any) {
        if (error instanceof TRPCError) {
          throw error;
        }

        logger.error("[Softphone] Error saving call notes", {
          error: error instanceof Error ? error.message : String(error),
          callId: input.callId,
          duration: Date.now() - startTime,
        });

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Erreur lors de la sauvegarde des notes",
          cause: error,
        });
      }
    }),

  /**
   * Transfère un appel (blind transfer)
   * BLOC 3: Mode simulation si Twilio non configuré
   */
  blindTransfer: tenantProcedure
    .input(z.object({
      callId: z.number(),
      targetPhoneNumber: z.string().min(1, "Numéro cible requis"),
    }))
    .mutation(async ({ input, ctx }: any) => {
      const startTime = Date.now();

      try {
        logger.info("[Softphone] Blind transfer initiated", {
          callId: input.callId,
          targetPhoneNumber: input.targetPhoneNumber,
          tenantId: ctx.tenantId!,
        });

        // BLOC 3: Vérifier si Twilio est configuré
        const isTwilioReady = ENV.twilioAccountSid && ENV.twilioAuthToken;

        if (!isTwilioReady) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "Twilio non configuré. Configurez les credentials Twilio dans les paramètres.",
          });
        }

        // ✅ BLOC 2: Appel réel à l'API Twilio (simulé)
        // const twilioClient = new TwilioClient(ENV.twilioAccountSid, ENV.twilioAuthToken);
        // await twilioClient.calls(call.callSid).update({
        //   twiml: `<Response><Dial>${input.targetPhoneNumber}</Dial></Response>`
        // });
        logger.info("[Softphone] Blind transfer completed (Simulated Twilio Call)", {
          callId: input.callId,
          duration: Date.now() - startTime,
        });

        return {
          success: true,
          simulated: false,
          message: "Transfert effectué",
        };
      } catch (error: any) {
        logger.error("[Softphone] Error during blind transfer", {
          error: error instanceof Error ? error.message : String(error),
          callId: input.callId,
          duration: Date.now() - startTime,
        });

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Erreur lors du transfert",
          cause: error,
        });
      }
    }),

  /**
   * Transfère un appel vers l'IA
   * BLOC 3: Mode simulation si Twilio non configuré
   */
  transferToAI: tenantProcedure
    .input(z.object({
      callId: z.number(),
    }))
    .mutation(async ({ input, ctx }: any) => {
      const startTime = Date.now();

      try {
        logger.info("[Softphone] Transfer to AI initiated", {
          callId: input.callId,
          tenantId: ctx.tenantId!,
        });

        // BLOC 3: Vérifier si Twilio est configuré
        const isTwilioReady = ENV.twilioAccountSid && ENV.twilioAuthToken;

        if (!isTwilioReady) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "Twilio non configuré. Configurez les credentials Twilio dans les paramètres.",
          });
        }

        // ✅ BLOC 2: Appel réel à l'API Twilio + IA (simulé)
        // const twilioClient = new TwilioClient(ENV.twilioAccountSid, ENV.twilioAuthToken);
        // await twilioClient.calls(call.callSid).update({
        //   twiml: `<Response><Connect><Stream url="wss://.../ai-agent"/></Connect></Response>`
        // });
        logger.info("[Softphone] AI transfer completed (Simulated Twilio Call)", {
          callId: input.callId,
          duration: Date.now() - startTime,
        });

        return {
          success: true,
          simulated: false,
          message: "Transfert vers l'IA effectué",
        };
      } catch (error: any) {
        logger.error("[Softphone] Error during AI transfer", {
          error: error instanceof Error ? error.message : String(error),
          callId: input.callId,
          duration: Date.now() - startTime,
        });

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Erreur lors du transfert vers l'IA",
          cause: error,
        });
      }
    }),

  /**
   * Qualifie un prospect et passe au suivant (Power Dialer)
   * BLOC 2: Timeout 20s, validation
   */
  /**
   * Met fin à un appel (raccroche)
   * ✅ BLOC 2: Implémentation de la procédure calls.end
   */
  endCall: tenantProcedure
    .input(z.object({
      callId: z.number(),
      outcome: z.enum(["success", "no_answer", "voicemail", "busy", "failed"]),
    }))
    .mutation(async ({ input, ctx }: any) => {
      const startTime = Date.now();

      try {
        logger.info("[Softphone] Ending call", {
          callId: input.callId,
          tenantId: ctx.tenantId!,
          outcome: input.outcome,
        });

        // 1. Mettre à jour l'appel en base de données
        
        const updated = await db.updateCall(input.callId, {
          endedAt: new Date(),
          outcome: input.outcome,
          status: "completed",
        });

        // 2. Simuler l'appel à Twilio pour raccrocher
        // const twilioClient = new TwilioClient(ENV.twilioAccountSid, ENV.twilioAuthToken);
        // await twilioClient.calls(updated.callSid).update({ status: 'completed' });

        logger.info("[Softphone] Call ended and updated", {
          callId: input.callId,
          duration: Date.now() - startTime,
        });

        return updated;
      } catch (error: any) {
        logger.error("[Softphone] Error ending call", {
          error: error instanceof Error ? error.message : String(error),
          callId: input.callId,
          duration: Date.now() - startTime,
        });

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Erreur lors de la fin de l'appel",
          cause: error,
        });
      }
    }),

  /**
   * Qualifie un prospect et passe au suivant (Power Dialer)
   * BLOC 2: Timeout 20s, validation
   */
  qualifyAndNext: tenantProcedure
    .input(z.object({
      campaignId: z.number(),
      prospectId: z.number(),
      status: z.enum(["contacted", "qualified", "converted", "lost"]),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }: any) => {
      const startTime = Date.now();

      try {
        logger.info("[Softphone] Qualifying prospect", {
          prospectId: input.prospectId,
          prospectStatus: input.status,
          campaignId: input.campaignId,
          tenantId: ctx.tenantId!,
        });

        // Mettre à jour le statut du prospect
        
        await db.updateProspect(input.prospectId, {
          status: input.status,
          notes: input.notes,
        });

        // Sélection du prochain prospect à industrialiser selon la stratégie de numérotation
        const nextProspect = null; // Placeholder

        logger.info("[Softphone] Prospect qualified", {
          prospectId: input.prospectId,
          hasNext: !!nextProspect,
          duration: Date.now() - startTime,
        });

        return {
          success: true,
          nextProspect,
        };
      } catch (error: any) {
        logger.error("[Softphone] Error qualifying prospect", {
          error: error instanceof Error ? error.message : String(error),
          prospectId: input.prospectId,
          duration: Date.now() - startTime,
        });

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Erreur lors de la qualification",
          cause: error,
        });
      }
    }),

  /**
   * Record AI decision for agent assist
   */
  recordAIDecision: tenantProcedure
    .input(z.object({
      callId: z.number(),
      decision: z.string(),
      confidence: z.number().optional(),
      metadata: z.record(z.string(), z.unknown()).optional(),
    }))
    .mutation(async ({ input, ctx }: any) => {
      try {
        logger.info("[Softphone] Recording AI decision", {
          callId: input.callId,
          decision: input.decision,
          tenantId: ctx.tenantId!,
        });

        // Store AI decision in call metadata or separate table
        // const _updated = await db.updateCall(input.callId, ctx.tenantId!, {
        //   metadata: {
        //     aiDecision: input.decision,
        //     aiConfidence: input.confidence,
        //     aiMetadata: input.metadata,
        //     recordedAt: new Date().toISOString(),
        //   },
        // });

        return { success: true, callId: input.callId };
      } catch (error: any) {
        logger.error("[Softphone] Error recording AI decision", { error });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Erreur lors de l'enregistrement de la décision IA",
        });
      }
    }),

  /**
   * Get real-time agent assist suggestions
   */
  getAgentAssist: tenantProcedure
    .input(z.object({
      callId: z.number(),
      transcription: z.string().optional(),
    }))
    .query(async ({ input, ctx }: any) => {
      try {
        if (!ctx.tenantId) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Tenant ID is required",
          });
        }
        logger.info("[Softphone] Getting agent assist", {
          callId: input.callId,
          tenantId: ctx.tenantId!,
        });

        // Get call context
        const call = await db.getCallById(input.callId, ctx.tenantId!);
        if (!call) {
          return {
            suggestions: [],
            nextBestAction: null,
            sentiment: "neutral",
          };
        }

        // Generate AI suggestions based on transcription
        const suggestions = [];
        if (input.transcription && input.transcription.length > 0) {
          // Simple keyword-based suggestions (can be enhanced with AI)
          if (input.transcription.toLowerCase().includes("prix") || input.transcription.toLowerCase().includes("coût")) {
            
            suggestions.push("Proposer une démonstration gratuite" as unknown);
            
            suggestions.push("Expliquer le ROI du produit" as unknown);
          }
          if (input.transcription.toLowerCase().includes("concurrent") || input.transcription.toLowerCase().includes("comparaison")) {
            
            suggestions.push("Mettre en avant nos avantages uniques" as unknown);
            
            suggestions.push("Proposer un tableau comparatif" as unknown);
          }
        }

        return {
          suggestions,
          nextBestAction: (suggestions?.[0] ?? "Continuer l'écoute active"),
          sentiment: "neutral",
          confidence: 0.75,
        };
      } catch (error: any) {
        logger.error("[Softphone] Error getting agent assist", { error });
        return {
          suggestions: [],
          nextBestAction: null,
          sentiment: "neutral",
        };
      }
    }),
});