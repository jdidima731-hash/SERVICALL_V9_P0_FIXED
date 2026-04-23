import { z } from "zod";
import { router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { tenantProcedure } from "../procedures";
import { logger } from "../infrastructure/logger";
import DialogueEngineService from "../services/DialogueEngineService";
import { DialogueScenario } from "../../shared/types/dialogue";

// Instance globale du moteur de dialogue
let dialogueEngine: DialogueEngineService;

// Initialiser le moteur
try {
  dialogueEngine = new DialogueEngineService();
} catch (error: any) {
  logger.error("Failed to initialize DialogueEngineService:", error);
}

/**
 * Router pour la gestion du dialogue conversationnel IA
 */
export const dialogueRouter = router({
  /**
   * Initialise une nouvelle conversation
   */
  initializeConversation: tenantProcedure
    .input(
      z.object({
        callId: z.string(),
        scenario: z.object({
          id: z.string(),
          name: z.string(),
          industry: z.string(),
          initialState: z.string(),
          states: z.array(z.unknown()),
          context: z.record(z.string(), z.unknown()).optional(),
        }),
        prospectId: z.number(),
      })
    )
    .mutation(async ({ input, ctx }: any) => {
      try {
        logger.info("[Dialogue Router] Initializing conversation", {
          tenantId: ctx.tenantId!,
          callId: input.callId,
          industry: input.scenario.industry,
        });

        const result = await dialogueEngine.initializeConversation(
          input.callId,
          input.scenario as DialogueScenario,
          ctx.tenantId!,
          input.prospectId
        );

        logger.info("[Dialogue Router] Conversation initialized", {
          callId: input.callId,
          nextState: result.nextState,
        });

        return {
          success: true,
          data: result,
        };
      } catch (error: any) {
        logger.error("[Dialogue Router] Error initializing conversation:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : "Failed to initialize conversation",
        });
      }
    }),

  /**
   * Traite l'entrée utilisateur
   */
  processInput: tenantProcedure
    .input(
      z.object({
        callId: z.string(),
        text: z.string(),
        scenario: z.object({
          id: z.string(),
          name: z.string(),
          industry: z.string(),
          initialState: z.string(),
          states: z.array(z.unknown()),
          context: z.record(z.string(), z.unknown()).optional(),
        }),
        prospectId: z.number(),
      })
    )
    .mutation(async ({ input, ctx }: any) => {
      try {
        logger.info("[Dialogue Router] Processing user input", {
          tenantId: ctx.tenantId!,
          callId: input.callId,
          textLength: input.text.length,
        });

        const result = await dialogueEngine.processInput(
          input.callId,
          {
            text: input.text,
            callId: input.callId,
            prospectId: input.prospectId,
            tenantId: ctx.tenantId!,
          },
          input.scenario as DialogueScenario
        );

        logger.info("[Dialogue Router] Input processed", {
          callId: input.callId,
          nextState: result.nextState,
        });

        return {
          success: true,
          data: result,
        };
      } catch (error: any) {
        logger.error("[Dialogue Router] Error processing input:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : "Failed to process input",
        });
      }
    }),

  /**
   * Récupère le contexte actuel d'une conversation
   */
  getContext: tenantProcedure
    .input(z.object({ callId: z.string() }))
    .query(async ({ input }: any) => {
      try {
        const context = dialogueEngine.getConversationContext(input.callId);

        if (!context) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: `Conversation ${input.callId} not found`,
          });
        }

        return {
          success: true,
          data: context,
        };
      } catch (error: any) {
        logger.error("[Dialogue Router] Error getting context:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : "Failed to get context",
        });
      }
    }),

  /**
   * Récupère l'état actuel d'une conversation
   */
  getCurrentState: tenantProcedure
    .input(z.object({ callId: z.string() }))
    .query(async ({ input }: any) => {
      try {
        const state = dialogueEngine.getCurrentState(input.callId);

        if (!state) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: `Conversation ${input.callId} not found`,
          });
        }

        return {
          success: true,
          data: { state },
        };
      } catch (error: any) {
        logger.error("[Dialogue Router] Error getting state:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : "Failed to get state",
        });
      }
    }),

  /**
   * Termine une conversation
   */
  endConversation: tenantProcedure
    .input(z.object({ callId: z.string() }))
    .mutation(async ({ input, ctx }: any) => {
      try {
        logger.info("[Dialogue Router] Ending conversation", {
          tenantId: ctx.tenantId!,
          callId: input.callId,
        });

        dialogueEngine.endConversation(input.callId);

        return {
          success: true,
          message: "Conversation ended",
        };
      } catch (error: any) {
        logger.error("[Dialogue Router] Error ending conversation:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : "Failed to end conversation",
        });
      }
    }),
});

export default dialogueRouter;
