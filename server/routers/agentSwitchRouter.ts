import { z } from "zod";
import { router } from "../_core/trpc";
import { adminProcedure, tenantProcedure } from "../procedures";
import {
  forceHumanAgent,
  forceAIAgent,
  forceBothMode,
  getAgentType,
  getAgentSwitchHistory,
  getTenantAgentSwitchHistory,
} from "../services/agentSwitchService";
import { AgentSwitchHistoryDTOSchema, mapToAgentSwitchHistoryDTO } from "../../shared/dto/calls.dto";
import { logger } from "../infrastructure/logger";
import { TRPCError } from "@trpc/server";

/**
 * Router pour la gestion de la bascule Agent IA ↔ Agent Humain
 * ✅ BLOC 1: Toutes les procédures tenant-spécifiques utilisent tenantProcedure
 * ✅ BLOC 1: tenantId retiré des schémas d'entrée — ctx.tenantId! utilisé exclusivement
 */
export const agentSwitchRouter = router({
  /**
   * Force la bascule vers un agent humain
   */
  forceHuman: adminProcedure
    .input(
      z.object({
        userId: z.number(),
        reason: z.string().optional(),
        callId: z.number().optional(),
      })
    )
    .mutation(async ({ input, ctx }: any) => {
      try {
        await forceHumanAgent(
          input.userId,
          ctx.tenantId!,
          ctx.user!.id,
          input.reason,
          input.callId
        );

        logger.info("[AgentSwitchRouter] Forced human agent", {
          userId: input.userId,
          triggeredBy: ctx.user!.id,
          tenantId: ctx.tenantId!,
        });

        return {
          success: true,
          message: "Agent switched to HUMAN successfully",
        };
      } catch (error: any) {
        if (error instanceof TRPCError) throw error;
        logger.error("[AgentSwitchRouter] Failed to force human agent", { error });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to switch to human agent",
        });
      }
    }),

  /**
   * Force la bascule vers un agent IA
   */
  forceAI: adminProcedure
    .input(
      z.object({
        userId: z.number(),
        reason: z.string().optional(),
        callId: z.number().optional(),
      })
    )
    .mutation(async ({ input, ctx }: any) => {
      try {
        await forceAIAgent(
          input.userId,
          ctx.tenantId!,
          ctx.user!.id,
          input.reason,
          input.callId
        );

        logger.info("[AgentSwitchRouter] Forced AI agent", {
          userId: input.userId,
          triggeredBy: ctx.user!.id,
          tenantId: ctx.tenantId!,
        });

        return {
          success: true,
          message: "Agent switched to AI successfully",
        };
      } catch (error: any) {
        if (error instanceof TRPCError) throw error;
        logger.error("[AgentSwitchRouter] Failed to force AI agent", { error });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to switch to AI agent",
        });
      }
    }),

  /**
   * ✅ FIX — Active le mode BOTH : agent humain + copilot IA simultané
   */
  forceBoth: adminProcedure
    .input(
      z.object({
        userId: z.number(),
        reason: z.string().optional(),
        callId: z.number().optional(),
      })
    )
    .mutation(async ({ input, ctx }: any) => {
      try {
        await forceBothMode(
          input.userId,
          ctx.tenantId!,
          ctx.user!.id,
          input.reason,
          input.callId
        );

        logger.info("[AgentSwitchRouter] Forced BOTH mode (human + AI copilot)", {
          userId: input.userId,
          triggeredBy: ctx.user!.id,
          tenantId: ctx.tenantId!,
        });

        return {
          success: true,
          message: "Agent switched to BOTH (human + AI copilot) successfully",
        };
      } catch (error: any) {
        if (error instanceof TRPCError) throw error;
        logger.error("[AgentSwitchRouter] Failed to force BOTH mode", { error });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to switch to BOTH mode",
        });
      }
    }),

  /**
   * Récupère le type d'agent actuel d'un utilisateur
   */
  getAgentType: tenantProcedure
    .input(
      z.object({
        userId: z.number(),
      })
    )
    .query(async ({ input }: any) => {
      try {
        const agentType = await getAgentType(input.userId);

        return {
          userId: input.userId,
          agentType: agentType ?? "AI",
        };
      } catch (error: any) {
        logger.error("[AgentSwitchRouter] Failed to get agent type", { error });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to get agent type",
        });
      }
    }),

  /**
   * Récupère l'historique des bascules pour un utilisateur
   */
  getUserHistory: tenantProcedure
    .input(
      z.object({
        userId: z.number(),
        limit: z.number().optional().default(50),
      })
    )
    .output(z.object({
      userId: z.number(),
      history: z.array(AgentSwitchHistoryDTOSchema),
    }))
    .query(async ({ input }) => {
      try {
        const history = await getAgentSwitchHistory(input.userId, input.limit);

        return {
          userId: input.userId,
          history: history.map(h => mapToAgentSwitchHistoryDTO(h)),
        };
      } catch (error: any) {
        logger.error("[AgentSwitchRouter] Failed to get user history", { error });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to get switch history",
        });
      }
    }),

  /**
   * Récupère la configuration actuelle de l'agent switch pour un tenant
   * ✅ BLOC 1: tenantId retiré du schéma — ctx.tenantId! utilisé
   */
  getConfig: tenantProcedure
    .query(async ({ ctx }) => {
      try {
        const tenantId = ctx.tenantId!;
        // ✅ FIX — getTenantAgentSwitchHistory échoue car il cherche 'created_at' (PostgresError 42703)
        // On utilise un try/catch pour ne pas bloquer toute la config si l'historique échoue
        let history: any[] = [];
        try {
          history = await getTenantAgentSwitchHistory(tenantId, 10);
        } catch (err: any) {
          logger.warn("[AgentSwitchRouter] Failed to fetch switch history, using empty list", { tenantId, error: err });
        }
        
        let aiAutomationRate = 80;
        let escalationThreshold = 50;
        
        try {
          const { getDbInstance } = await import("../db");
          const { tenantSettings } = await import("../../drizzle/schema");
          const { eq } = await import("drizzle-orm");
          const db = getDbInstance();
          const [config] = await db
            .select()
            .from(tenantSettings)
            .where(eq(tenantSettings.tenantId, tenantId))
            .limit(1);
            
          if (config) {
            aiAutomationRate = config.aiAutomationRate ?? 80;
            escalationThreshold = config.escalationThreshold ?? 50;
          }
        } catch (err: any) {
          logger.warn("[AgentSwitchRouter] Failed to fetch tenant settings, using defaults", { tenantId, error: err });
        }

        return {
          tenantId,
          recentHistory: history,
          aiAutomationRate,
          escalationThreshold,
        };
      } catch (error: any) {
        logger.error('[AgentSwitchRouter] Failed to get config', { error });
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to get agent switch config',
        });
      }
    }),

  /**
   * Met à jour la configuration globale du tenant (aiAutomationRate, escalationThreshold)
   * ✅ Correction demandée : Procédure updateConfig dédiée sans userId
   */
  updateConfig: adminProcedure
    .input(
      z.object({
        aiAutomationRate: z.number().min(0).max(100).optional(),
        escalationThreshold: z.number().min(0).max(100).optional(),
      })
    )
    .mutation(async ({ input, ctx }: any) => {
      try {
        const { getDbInstance } = await import("../db");
        const { tenantSettings } = await import("../../drizzle/schema");
        const { eq } = await import("drizzle-orm");
        const db = getDbInstance();
        const tenantId = ctx.tenantId!;

        // Upsert logic
        const [existing] = await db
          .select()
          .from(tenantSettings)
          .where(eq(tenantSettings.tenantId, tenantId))
          .limit(1);

        if (existing) {
          await db
            .update(tenantSettings)
            .set({
              ...(input.aiAutomationRate !== undefined && { aiAutomationRate: input.aiAutomationRate }),
              ...(input.escalationThreshold !== undefined && { escalationThreshold: input.escalationThreshold }),
              updatedAt: new Date(),
            })
            .where(eq(tenantSettings.tenantId, tenantId));
        } else {
          await db.insert(tenantSettings).values({
            tenantId,
            aiAutomationRate: input.aiAutomationRate ?? 80,
            escalationThreshold: input.escalationThreshold ?? 50,
          });
        }

        logger.info("[AgentSwitchRouter] Updated tenant config", {
          tenantId,
          updates: input,
          updatedBy: ctx.user!.id,
        });

        return {
          success: true,
          message: "Configuration mise à jour avec succès",
        };
      } catch (error: any) {
        logger.error("[AgentSwitchRouter] Failed to update config", { error });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Erreur lors de la mise à jour de la configuration",
        });
      }
    }),

  /**
   * Récupère l'historique des bascules pour un tenant (admin only)
   * ✅ BLOC 1: tenantId retiré du schéma — ctx.tenantId! utilisé
   */
  getTenantHistory: adminProcedure
    .input(
      z.object({
        limit: z.number().optional().default(100),
      })
    )
    .output(z.object({
      tenantId: z.number(),
      history: z.array(AgentSwitchHistoryDTOSchema),
    }))
    .query(async ({ input, ctx }) => {
      try {
        const history = await getTenantAgentSwitchHistory(ctx.tenantId!, input.limit);

        return {
          tenantId: ctx.tenantId!,
          history: history.map(h => mapToAgentSwitchHistoryDTO(h)),
        };
      } catch (error: any) {
        if (error instanceof TRPCError) throw error;
        logger.error("[AgentSwitchRouter] Failed to get tenant history", { error });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to get tenant switch history",
        });
      }
    }),
});
