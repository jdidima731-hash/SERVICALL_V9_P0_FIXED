/**
 * callsTwilioRouter — Intégration Twilio V8 complète
 * Branché sur twilioService.ts
 *
 * Paths tRPC : trpc.communication.callsTwilio.*
 *   .ping             — healthcheck
 *   .initiateOutbound — lancer un appel sortant (file + queue)
 *   .end              — raccrocher un appel
 *   .transfer         — transférer vers un agent ou numéro
 *   .getDetails       — détails d'un appel (durée, statut, SID)
 *   .sendSms          — envoyer un SMS
 *   .updateStatus     — callback statut Twilio (usage interne/webhook)
 */
import { router, publicProcedure } from '../_core/trpc';
import { tenantProcedure, managerProcedure } from '../procedures';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { logger } from '../infrastructure/logger';
import { TwilioValidator } from '../services/twilioValidator';
import {
  createOutboundCall,
  endCall,
  transferCall,
  getCallDetails,
  sendSms,
  handleCallStatusUpdate,
} from '../services/twilioService';

export const callsTwilioRouter = router({

  ping: publicProcedure
    .input(z.object({}).optional())
    .query(async () => ({ status: 'ok', message: 'Twilio V8 actif' })),

  /** Initier un appel sortant (mis en queue via BullMQ) */
  initiateOutbound: tenantProcedure
    .input(z.object({
      toNumber: z.string().min(5),
      prospectId: z.number().int().optional(),
      isAI: z.boolean().default(false),
    }))
    .mutation(async ({ input, ctx }) => {
      if (!ctx.tenantId) throw new TRPCError({ code: 'UNAUTHORIZED' });
      try {
        const result = await createOutboundCall(
          input.toNumber,
          ctx.tenantId,
          input.prospectId,
          input.isAI,
        );
        logger.info('[callsTwilioRouter] outbound queued', { tenantId: ctx.tenantId, toNumber: input.toNumber });
        return result;
      } catch (err: any) {
        logger.error('[callsTwilioRouter] initiateOutbound failed', { err });
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: "Erreur lancement appel sortant" });
      }
    }),

  /** Raccrocher un appel en cours */
  end: tenantProcedure
    .input(z.object({ callSid: z.string().min(1) }))
    .mutation(async ({ input, ctx }) => {
      if (!ctx.tenantId) throw new TRPCError({ code: 'UNAUTHORIZED' });
      try {
        await endCall(input.callSid);
        logger.info('[callsTwilioRouter] call ended', { callSid: input.callSid });
        return { success: true };
      } catch (err: any) {
        logger.error('[callsTwilioRouter] end failed', { err });
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: "Erreur fin d'appel" });
      }
    }),

  /** Transférer un appel vers un agent ou numéro externe */
  transfer: tenantProcedure
    .input(z.object({
      callSid: z.string().min(1),
      toNumber: z.string().min(5),
      agentId: z.number().int().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      if (!ctx.tenantId) throw new TRPCError({ code: 'UNAUTHORIZED' });
      try {
        await transferCall(input.callSid, input.toNumber, ctx.tenantId);
        logger.info('[callsTwilioRouter] call transferred', { callSid: input.callSid, to: input.toNumber });
        return { success: true };
      } catch (err: any) {
        logger.error('[callsTwilioRouter] transfer failed', { err });
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: "Erreur transfert d'appel" });
      }
    }),

  /** Récupérer les détails d'un appel */
  getDetails: tenantProcedure
    .input(z.object({ callSid: z.string().min(1) }))
    .query(async ({ input, ctx }) => {
      if (!ctx.tenantId) throw new TRPCError({ code: 'UNAUTHORIZED' });
      try {
        return await getCallDetails(input.callSid);
      } catch (err: any) {
        logger.error('[callsTwilioRouter] getDetails failed', { err });
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: "Erreur récupération détails appel" });
      }
    }),

  /** Envoyer un SMS */
  sendSms: tenantProcedure
    .input(z.object({
      to: z.string().min(5),
      body: z.string().min(1).max(1600),
    }))
    .mutation(async ({ input, ctx }) => {
      if (!ctx.tenantId) throw new TRPCError({ code: 'UNAUTHORIZED' });
      try {
        const sid = await sendSms({ to: input.to, body: input.body, tenantId: ctx.tenantId });
        logger.info('[callsTwilioRouter] SMS sent', { to: input.to, tenantId: ctx.tenantId });
        return { success: true, sid };
      } catch (err: any) {
        logger.error('[callsTwilioRouter] sendSms failed', { err });
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: "Erreur envoi SMS" });
      }
    }),

  /** 
   * Mise à jour statut appel — usage interne (webhook Twilio → server/api/twilio.ts) 
   * ✅ FIX P1.3: Validation de la signature Twilio pour les webhooks entrants
   */
  updateStatus: managerProcedure
    .input(z.object({
      callSid: z.string(),
      status: z.string(),
      from: z.string(),
      to: z.string(),
      duration: z.string().optional(),
      recordingUrl: z.string().optional(),
      recordingSid: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      if (!ctx.tenantId) throw new TRPCError({ code: 'UNAUTHORIZED' });

      // ✅ FIX P1.3: Validation de la signature Twilio
      // Note: ctx.req doit être passé pour accéder aux headers et au body brut
      if (process.env['NODE_ENV'] === 'production' && ctx.req) {
        if (!TwilioValidator.validateSignature(ctx.req)) {
          logger.warn('[callsTwilioRouter] Invalid Twilio signature on updateStatus', { callSid: input.callSid });
          throw new TRPCError({ code: 'FORBIDDEN', message: "Invalid Twilio Signature" });
        }
      }

      try {
        await handleCallStatusUpdate({
          callSid: input.callSid,
          status: input.status,
          from: input.from,
          to: input.to,
          duration: input.duration,
          recordingUrl: input.recordingUrl,
          recordingSid: input.recordingSid,
        });
        return { success: true };
      } catch (err: any) {
        logger.error('[callsTwilioRouter] updateStatus failed', { err });
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: "Erreur mise à jour statut appel" });
      }
    }),
});
