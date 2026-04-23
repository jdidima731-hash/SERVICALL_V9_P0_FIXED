import { router } from "../_core/trpc";
import { tenantProcedure, agentProcedure } from "../procedures";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import * as twilioService from "../services/twilioService";
import * as twilioWebRTCService from "../services/twilioWebRTCService";
import * as aiService from "../services/aiService";
import * as db from "../db";
import * as callWorkflowService from "../services/callWorkflowService";
import { logger } from "../infrastructure/logger";
import { registerActiveCall, unregisterActiveCall } from "../services/liveListeningService";

/**
 * PHONE ROUTER
 */

export const phoneRouter = router({
  getAccessToken: tenantProcedure
    .query(async ({ ctx }) => {
      if (!ctx.tenantId) throw new TRPCError({ code: 'UNAUTHORIZED' });
      try {
        const token = twilioWebRTCService.generateVoiceAccessToken(
          `agent-${ctx.user!.id}`,
          ctx.tenantId!
        );
        return { token };
      } catch (error: unknown) {
        if (error instanceof TRPCError) throw error;
        logger.error("[Phone Router] Error generating token:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Erreur lors de la génération du token",
        });
      }
    }),

  validatePhoneNumber: tenantProcedure
    .input(z.object({
      phoneNumber: z.string(),
    }))
    .query(async ({ input }) => {
      const isValid = twilioWebRTCService.validatePhoneNumber(input.phoneNumber);
      return { isValid };
    }),

  formatPhoneNumber: tenantProcedure
    .input(z.object({
      phoneNumber: z.string(),
      countryCode: z.string().optional(),
    }))
    .query(async ({ input }) => {
      const formatted = twilioWebRTCService.formatPhoneNumber(
        input.phoneNumber,
        input.countryCode
      );
      return { formatted };
    }),

  initiateCall: agentProcedure
    .input(z.object({
      toNumber: z.string(),
      prospectId: z.number().optional(),
      isAI: z.boolean().default(false),
    }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenantId) throw new TRPCError({ code: 'UNAUTHORIZED' });
      try {
        if (input.prospectId) {
          const prospect = await db.getProspectById(input.prospectId, ctx.tenantId!);
          if (!prospect) throw new TRPCError({ code: "NOT_FOUND" });
        }

        const call = await twilioService.createOutboundCall(
          input.toNumber,
          ctx.tenantId!,
          input.prospectId,
          input.isAI
        );

        await db.createCall({
          tenantId: ctx.tenantId!,
          prospectId: input.prospectId,
          agentId: ctx.user!.id,
          callType: "outbound",
          fromNumber: process.env['TWILIO_PHONE_NUMBER'] || "",
          toNumber: input.toNumber,
        });

        let prospectName = "Prospect";
        if (input.prospectId) {
          try {
            const prospect = await db.getProspectById(input.prospectId, ctx.tenantId!);
            if (prospect) prospectName = prospect.firstName + " " + (prospect.lastName || "");
          } catch { /* non bloquant */ }
        }

        registerActiveCall({
          callSid: (call as any)?.sid || String(call),
          tenantId: ctx.tenantId!,
          agentId: ctx.user!.id,
          agentName: ctx.user!.name || ctx.user!.email || `Agent #${ctx.user!.id}`,
          prospectPhone: input.toNumber,
          prospectName: prospectName.trim(),
        });

        return {
          success: true,
          callSid: (call as any)?.sid || String(call),
          message: "Appel initié avec succès",
        };
      } catch (error: unknown) {
        if (error instanceof TRPCError) throw error;
        logger.error("[Phone Router] Error initiating call:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Erreur lors de l'initiation de l'appel",
        });
      }
    }),

  endCall: tenantProcedure
    .input(z.object({
      callSid: z.string(),
      callId: z.number().optional(),
      recordingUrl: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenantId) throw new TRPCError({ code: 'UNAUTHORIZED' });
      try {
        if (input.callId) {
          const call = await db.getCallById(input.callId, ctx.tenantId!);
          if (!call) throw new TRPCError({ code: "NOT_FOUND" });
        }

        await twilioService.endCall(input.callSid);
        unregisterActiveCall(input.callSid);

        if (input.callId && input.recordingUrl) {
          callWorkflowService.processCompletedCall(input.callId, input.recordingUrl)
            .catch(err => logger.error("[Phone Router] Background processing error:", err));
        }
        
        return { success: true, processingStarted: !!(input.callId && input.recordingUrl) };
      } catch (error: unknown) {
        if (error instanceof TRPCError) throw error;
        logger.error("[Phone Router] Error ending call:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Erreur lors de la fin de l'appel",
        });
      }
    }),

  transferCall: tenantProcedure
    .input(z.object({
      callSid: z.string(),
      agentPhoneNumber: z.string(),
    }))
    .mutation(async ({ input }) => {
      try {
        await twilioService.transferCall(input.callSid, input.agentPhoneNumber);
        return { success: true };
      } catch (error: unknown) {
        if (error instanceof TRPCError) throw error;
        logger.error("[Phone Router] Error transferring call:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Erreur lors du transfert d'appel",
        });
      }
    }),

  sendSMS: tenantProcedure
    .input(z.object({
      toNumber: z.string(),
      message: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      if (!ctx.tenantId) throw new TRPCError({ code: 'UNAUTHORIZED' });
      try {
        const messageSid = await twilioService.sendSms({ to: input.toNumber, body: input.message, tenantId: ctx.tenantId! });
        return { success: true, messageSid };
      } catch (error: unknown) {
        if (error instanceof TRPCError) throw error;
        logger.error("[Phone Router] Error sending SMS:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Erreur lors de l'envoi du SMS",
        });
      }
    }),

  qualifyCaller: tenantProcedure
    .input(z.object({
      transcription: z.string(),
      callerPhone: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenantId) throw new TRPCError({ code: 'UNAUTHORIZED' });
      try {
        const tenant = await db.getTenantById(ctx.tenantId!);
        
        const qualification = await aiService.qualifyCallerFromTranscription(
          input.transcription,
          input.callerPhone,
          tenant ? {
            tenantId: ctx.tenantId!,
            tenantName: tenant.name,
            businessType: "Service Client",
            departments: ["Support", "Ventes", "Facturation"],
          } : undefined
        );

        if (qualification.prospectName && qualification.prospectName !== "Prospect inconnu") {
          await db.createProspect({
            firstName: qualification.prospectName.split(" ")?.[0] ?? "",
            lastName: qualification.prospectName.split(" ").slice(1).join(" "),
            email: qualification.prospectEmail,
            phone: qualification.prospectPhone,
            company: qualification.prospectCompany,
            source: "call",
            notes: qualification.notes,
          }, ctx.tenantId!);
        }

        return qualification;
      } catch (error: unknown) {
        if (error instanceof TRPCError) throw error;
        logger.error("[Phone Router] Error qualifying caller:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Erreur lors de la qualification du prospect",
        });
      }
    }),

  generateAIResponse: tenantProcedure
    .input(z.object({
      callerMessage: z.string(),
      prospectName: z.string(),
      callReason: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenantId) throw new TRPCError({ code: 'UNAUTHORIZED' });
      try {
        const tenant = await db.getTenantById(ctx.tenantId!);

        const response = await aiService.generateAIResponse(
          input.callerMessage,
          {
            tenantId: ctx.tenantId!,
            prospectName: input.prospectName,
            callReason: input.callReason,
            tenantName: tenant?.name ?? "Servicall",
          }
        );

        return { response };
      } catch (error: unknown) {
        if (error instanceof TRPCError) throw error;
        logger.error("[Phone Router] Error generating AI response:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Erreur lors de la génération de la réponse IA",
        });
      }
    }),
});
