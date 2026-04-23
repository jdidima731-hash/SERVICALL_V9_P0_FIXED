/**
 * aiMemoryRouter — Mémoire contextuelle IA par contact
 * Branché sur aiMemoryService.ts
 *
 * Paths tRPC : trpc.aiAutomation.aiMemory.*
 *   .ping        — healthcheck
 *   .get         — contexte mémorisé d'un contact
 *   .save        — sauvegarder une interaction
 *   .delete      — suppression RGPD d'un contact
 *   .purge       — purge des mémoires anciennes (admin)
 */
import { router, publicProcedure } from '../_core/trpc';
import { tenantProcedure, adminProcedure } from '../procedures';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { logger } from '../infrastructure/logger';
import {
  getContactMemory,
  saveInteractionMemory,
  deleteContactMemory,
  purgeOldMemories,
} from '../services/aiMemoryService';

export const aiMemoryRouter = router({

  ping: publicProcedure
    .input(z.object({}).optional())
    .query(async () => ({ status: 'ok', message: 'AI Memory V8 actif' })),

  /** Récupérer le contexte mémorisé d'un contact */
  get: tenantProcedure
    .input(z.object({
      contactIdentifier: z.string().min(1),
      limit: z.number().int().min(1).max(20).default(5),
    }))
    .query(async ({ input, ctx }) => {
      if (!ctx.tenantId) throw new TRPCError({ code: 'UNAUTHORIZED' });
      try {
        return await getContactMemory(ctx.tenantId, input.contactIdentifier, input.limit);
      } catch (err: any) {
        logger.error('[aiMemoryRouter] get failed', { err });
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Erreur récupération mémoire' });
      }
    }),

  /** Sauvegarder une interaction */
  save: tenantProcedure
    .input(z.object({
      contactIdentifier: z.string().min(1),
      contactName: z.string().optional(),
      channel: z.enum(['phone', 'whatsapp', 'email', 'chat', 'sms']),
      transcript: z.string().optional(),
      manualSummary: z.string().optional(),
      keyFacts: z.object({
        preferences: z.array(z.string()).optional(),
        issues: z.array(z.string()).optional(),
        promises: z.array(z.string()).optional(),
        sentiment: z.enum(['positive', 'neutral', 'negative']).optional(),
        language: z.string().optional(),
        lastOutcome: z.string().optional(),
      }).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      if (!ctx.tenantId) throw new TRPCError({ code: 'UNAUTHORIZED' });
      try {
        await saveInteractionMemory({
          tenantId: ctx.tenantId,
          contactIdentifier: input.contactIdentifier,
          contactName: input.contactName,
          channel: input.channel,
          transcript: input.transcript,
          manualSummary: input.manualSummary,
          keyFacts: input.keyFacts,
        });
        return { success: true };
      } catch (err: any) {
        logger.error('[aiMemoryRouter] save failed', { err });
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Erreur sauvegarde mémoire' });
      }
    }),

  /** Suppression RGPD — droit à l'oubli */
  delete: tenantProcedure
    .input(z.object({ contactIdentifier: z.string().min(1) }))
    .mutation(async ({ input, ctx }) => {
      if (!ctx.tenantId) throw new TRPCError({ code: 'UNAUTHORIZED' });
      try {
        const deletedCount = await deleteContactMemory(ctx.tenantId, input.contactIdentifier);
        logger.info('[aiMemoryRouter] RGPD delete', { tenantId: ctx.tenantId, deletedCount });
        return { success: true, deletedCount };
      } catch (err: any) {
        logger.error('[aiMemoryRouter] delete failed', { err });
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Erreur suppression RGPD' });
      }
    }),

  /** Purge des mémoires anciennes — admin seulement */
  purge: adminProcedure
    .input(z.object({
      retentionDays: z.number().int().min(30).max(3650).default(365),
    }))
    .mutation(async ({ input, ctx }) => {
      if (!ctx.tenantId) throw new TRPCError({ code: 'UNAUTHORIZED' });
      try {
        const purgedCount = await purgeOldMemories(ctx.tenantId, input.retentionDays);
        logger.info('[aiMemoryRouter] purge', { tenantId: ctx.tenantId, retentionDays: input.retentionDays, purgedCount });
        return { success: true, purgedCount };
      } catch (err: any) {
        logger.error('[aiMemoryRouter] purge failed', { err });
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Erreur purge mémoires' });
      }
    }),
});
