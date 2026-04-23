/**
 * BLOC 4 - Copilot Router
 * Endpoints pour l'assistance en temps réel
 */

import { router } from "../_core/trpc";
import { z } from "zod";
import { AgentCopilotService } from "../services/agentCopilotService";
import { tenantProcedure } from "../procedures";

export const copilotRouter = router({
  /**
   * Analyser une transcription et obtenir des suggestions
   */
  getSuggestions: tenantProcedure
    .input(z.object({
      transcription: z.string(),
      context: z.object({
        prospectName: z.string().optional(),
        industry: z.string().optional(),
        callGoal: z.string().optional(),
      }),
    }))
    .mutation(async ({ input, ctx }) => {
      return await AgentCopilotService.generateLiveSuggestions(
        input.transcription,
        input.context,
        ctx.tenantId
      );
    }),

  /**
   * Extraire les données de l'appel à la fin ou pendant
   */
  extractData: tenantProcedure
    .input(z.object({
      transcription: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      return await AgentCopilotService.extractCallData(input.transcription, ctx.tenantId);
    }),
});
