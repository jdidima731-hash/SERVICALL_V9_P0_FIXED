/**
 * whatsappRouter — Intégration WhatsApp IA
 * ✅ BLOC 1 FIX: Architecture API -> Service -> Domain -> Infra
 * ✅ Logic moved to CommunicationService
 */
import { router, publicProcedure } from '../_core/trpc';
import { tenantProcedure } from '../procedures';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { logger } from '../infrastructure/logger';
import { CommunicationService } from '../services/communicationService';

export const whatsappRouter = router({
  ping: publicProcedure
    .input(z.object({}).optional())
    .query(async () => ({ status: 'ok', message: 'WhatsApp V8 actif' })),

  /** Traiter un message entrant et générer une réponse IA */
  handleIncoming: tenantProcedure
    .input(z.object({
      message: z.object({
        messageId: z.string(),
        from: z.string(),
        to: z.string().optional(),
        body: z.string(),
        timestamp: z.number().optional(),
        type: z.enum(["text", "audio", "image", "document", "location"]).optional(),
        provider: z.enum(['meta', 'twilio']).optional(),
      }),
      tenantName: z.string().optional(),
      wabaPhoneNumberId: z.string().optional(),
      wabaAccessToken: z.string().optional(),
      twilioSid: z.string().optional(),
      twilioToken: z.string().optional(),
      twilioPhone: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      if (!ctx.tenantId) throw new TRPCError({ code: 'UNAUTHORIZED' });
      try {
        const msg = {
          messageId: input.message.messageId,
          from: input.message.from,
          to: input.message.to ?? '',
          body: input.message.body,
          timestamp: input.message.timestamp ?? Date.now(),
          type: input.message.type ?? 'text',
          provider: input.message.provider ?? 'twilio',
        };
        return await CommunicationService.handleIncomingWhatsApp(ctx.tenantId, {
          ...input,
          message: msg
        });
      } catch (err: any) {
        logger.error('[whatsappRouter] handleIncoming failed', { err });
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Erreur traitement message WhatsApp' });
      }
    }),

  /** Envoyer un message WhatsApp sortant */
  send: tenantProcedure
    .input(z.object({
      to: z.string().min(5),
      body: z.string().min(1).max(4096),
    }))
    .mutation(async ({ input, ctx }) => {
      if (!ctx.tenantId) throw new TRPCError({ code: 'UNAUTHORIZED' });
      try {
        return await CommunicationService.sendWhatsApp(input.to, input.body);
      } catch (err: any) {
        logger.error('[whatsappRouter] send failed', { err });
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: "Erreur envoi message WhatsApp" });
      }
    }),

  /** Parser un payload Meta brut pour tests/debug */
  parseMetaWebhook: tenantProcedure
    .input(z.object({ payload: z.unknown() }))
    .mutation(async ({ input }) => {
      const parsed = CommunicationService.parseMetaWebhook(input.payload);
      return { parsed };
    }),
});
