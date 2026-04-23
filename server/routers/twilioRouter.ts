import { z } from "zod";
import { router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { tenantProcedure, managerProcedure } from "../procedures";
import * as twilioService from "../services/twilioService";
import { generateVoiceStreamToken } from "../services/twilioWebRTCService";
import { AuditService } from "../services/auditService";
import { logger } from "../infrastructure/logger";

/**
 * Twilio Router - Centralisation de la téléphonie cloud, SMS et WhatsApp
 * Intégré avec l'Audit, le Scoring IA et le RGPD.
 */
export const twilioRouter = router({
  /**
   * Lancer un appel sortant (Humain ou IA)
   */
  initiateCall: tenantProcedure
    .input(z.object({
      toNumber: z.string(),
      prospectId: z.number().optional(),
      isAI: z.boolean().default(false),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        if (!ctx.tenantId) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Tenant ID is required",
          });
        }
        const call = await twilioService.createOutboundCallInternal(
          input.toNumber,
          ctx.tenantId!,
          input.prospectId,
          input.isAI
        );

        // Journalisation d'audit
        await AuditService.log({
          tenantId: ctx.tenantId!,
          userId: ctx.user!.id,
          action: "PII_ACCESS", // Accès au numéro de téléphone
          resource: "call",
          resourceId: 0, // Sera mis à jour avec le SID
          actorType: input.isAI ? "ai" : "human",
          source: "TWILIO" as const,
          impactRGPD: true,
          metadata: { 
            callSid: call.sid, 
            direction: "outbound", 
            isAI: input.isAI,
            toNumber: input.toNumber 
          }
        });

        return { success: true, callSid: call.sid };
      } catch (error: any) {
        logger.error("[TwilioRouter] Failed to initiate call", { error, input });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Impossible de lancer l'appel Twilio",
        });
      }
    }),

  /**
   * Envoyer un SMS
   */
  sendSMS: tenantProcedure
    .input(z.object({
      toNumber: z.string(),
      message: z.string().min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenantId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Tenant ID is required",
        });
      }
      
      // ✅ FIX P1: Passer le tenantId pour le BYOK
      const messageSid = await twilioService.sendSMS(input.toNumber, input.message, ctx.tenantId);
      
      await AuditService.log({
        tenantId: ctx.tenantId!,
        userId: ctx.user!.id,
        action: "PII_ACCESS",
        resource: "sms",
        actorType: "human",
        source: "TWILIO",
        impactRGPD: false,
        metadata: { messageSid, toNumber: input.toNumber }
      });

      return { success: true, messageSid };
    }),

  /**
   * Envoyer un message WhatsApp
   */
  sendWhatsApp: tenantProcedure
    .input(z.object({
      toNumber: z.string(),
      message: z.string().min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenantId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Tenant ID is required",
        });
      }
      // ✅ FIX P1: Passer le tenantId pour le BYOK
      const result = await twilioService.sendWhatsApp(input.toNumber, input.message, ctx.tenantId);
      
      if (!result.success) {
        throw new TRPCError({ code: "BAD_REQUEST", message: result.error });
      }

      await AuditService.log({
        tenantId: ctx.tenantId!,
        userId: ctx.user!.id,
        action: "PII_ACCESS",
        resource: "whatsapp",
        actorType: "human",
        source: "TWILIO" as const,
        impactRGPD: false,
        metadata: { messageSid: result.messageSid, toNumber: input.toNumber }
      });

      return { success: true, messageSid: result.messageSid };
    }),

  /**
   * Récupérer les détails d'un appel (Audit & Debug)
   */
  getCallDetails: managerProcedure
    .input(z.object({ callSid: z.string() }))
    .query(async ({ input }: any) => {
      return await twilioService.getCallDetails(input.callSid);
    }),

  /**
   * Terminer un appel en cours
   */
  terminateCall: tenantProcedure
    .input(z.object({ callSid: z.string() }))
    .mutation(async ({ input }: any) => {
      await twilioService.endCall(input.callSid);
      return { success: true };
    }),

  /**
   * BLOC 6 — VOICE STREAM TOKEN
   * Génère un token sécurisé pour la transcription temps réel d'un appel spécifique.
   */
  getVoiceStreamToken: tenantProcedure
    .input(z.object({ callSid: z.string() }))
    .query(async ({ ctx, input }) => {
      if (!ctx.tenantId) throw new TRPCError({ code: "UNAUTHORIZED" });
      
      try {
        const token = generateVoiceStreamToken(input.callSid, ctx.tenantId);
        return { token };
      } catch (error: any) {
        logger.error("[TwilioRouter] Failed to generate voice stream token", { error, callSid: input.callSid });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Erreur lors de la génération du token de streaming vocal",
        });
      }
    }),
});