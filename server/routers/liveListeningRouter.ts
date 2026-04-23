/**
 * LIVE LISTENING ROUTER — Endpoints tRPC pour la supervision temps réel
 * ─────────────────────────────────────────────────────────────────────────────
 * Accès réservé aux managers et admins (managerProcedure).
 *
 * Endpoints :
 *  - getActiveCalls       : liste les appels actifs du tenant
 *  - startSupervision     : démarre l'écoute d'un appel
 *  - changeMode           : change le mode (listen/whisper/barge)
 *  - stopSupervision      : arrête la supervision
 *  - getSupervisorToken   : génère un token WebRTC pour le superviseur
 */

import { z } from "zod";
import { router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { managerProcedure, tenantProcedure } from "../procedures";
import { logger } from "../infrastructure/logger";
import {
  getActiveCallsForTenant,
  startSupervision,
  changeSupervisionMode,
  stopSupervision,
  generateSupervisorConferenceTwiML,
  type SupervisionMode,
} from "../services/liveListeningService";
import { generateVoiceAccessToken } from "../services/twilioWebRTCService";

const supervisionModeSchema = z.enum(["listen", "whisper", "barge"]);

export const liveListeningRouter = router({
  /**
   * Retourne la liste des appels agents actifs pour le panneau supervision.
   * Accessible aux managers et admins uniquement.
   */
  getActiveCalls: managerProcedure.query(async ({ ctx }) => {
    try {
      const calls = getActiveCallsForTenant(ctx.tenantId!);
      return { calls };
    } catch (error: any) {
      logger.error("[LiveListening Router] getActiveCalls error", { error });
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Impossible de récupérer les appels actifs",
      });
    }
  }),

  /**
   * Démarre la supervision d'un appel.
   * Crée la Conference Twilio si nécessaire et retourne le token WebRTC superviseur.
   */
  startSupervision: managerProcedure
    .input(
      z.object({
        callSid: z.string().min(1),
        mode: supervisionModeSchema.default("listen"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const result = await startSupervision({
          callSid: input.callSid,
          tenantId: ctx.tenantId!,
          supervisorId: ctx.user!.id,
          supervisorName: ctx.user!.name || ctx.user!.email || `Superviseur #${ctx.user!.id}`,
          mode: input.mode as SupervisionMode,
        });

        logger.info("[LiveListening Router] Supervision démarrée", {
          callSid: input.callSid,
          supervisorId: ctx.user!.id,
          mode: input.mode,
        });

        return {
          success: true,
          conferenceName: result.conferenceName,
          supervisorToken: result.supervisorToken,
          mode: result.mode,
          twiml: generateSupervisorConferenceTwiML(
            result.conferenceName,
            result.mode as SupervisionMode
          ),
        };
      } catch (error: any) {
        logger.error("[LiveListening Router] startSupervision error", {
          error: error.message,
          callSid: input.callSid,
        });
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: error.message || "Impossible de démarrer la supervision",
        });
      }
    }),

  /**
   * Change le mode de supervision en cours.
   */
  changeMode: managerProcedure
    .input(
      z.object({
        callSid: z.string().min(1),
        newMode: supervisionModeSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        await changeSupervisionMode({
          callSid: input.callSid,
          tenantId: ctx.tenantId!,
          supervisorId: ctx.user!.id,
          newMode: input.newMode as SupervisionMode,
        });

        return { success: true, newMode: input.newMode };
      } catch (error: any) {
        logger.error("[LiveListening Router] changeMode error", { error });
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: error.message || "Impossible de changer le mode",
        });
      }
    }),

  /**
   * Arrête la supervision d'un appel.
   */
  stopSupervision: managerProcedure
    .input(z.object({ callSid: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      try {
        await stopSupervision({
          callSid: input.callSid,
          tenantId: ctx.tenantId!,
          supervisorId: ctx.user!.id,
        });

        return { success: true };
      } catch (error: any) {
        logger.error("[LiveListening Router] stopSupervision error", { error });
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: error.message || "Impossible d'arrêter la supervision",
        });
      }
    }),

  /**
   * Génère un token WebRTC pour le navigateur superviseur.
   * Utilisé pour initialiser le Twilio Device côté frontend.
   */
  getSupervisorToken: managerProcedure.query(async ({ ctx }) => {
    try {
      const identity = `supervisor-${ctx.user!.id}`;
      const token = generateVoiceAccessToken(identity, ctx.tenantId!);
      return { token, identity };
    } catch (error: any) {
      logger.error("[LiveListening Router] getSupervisorToken error", { error });
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Impossible de générer le token superviseur",
      });
    }
  }),

  /**
   * Webhook appelé par Twilio lors de la connexion d'un participant à la Conference.
   * Enregistre le SID de la jambe superviseur.
   * Note : endpoint public (Twilio ne peut pas s'authentifier via JWT).
   */
  conferenceParticipantJoin: tenantProcedure
    .input(
      z.object({
        conferenceName: z.string(),
        callSid: z.string(),
        supervisorId: z.number(),
      })
    )
    .mutation(async ({ input }: any) => {
      const { registerSupervisorParticipant } = await import(
        "../services/liveListeningService"
      );
      registerSupervisorParticipant(
        input.conferenceName,
        input.supervisorId,
        input.callSid
      );
      return { success: true };
    }),
});
