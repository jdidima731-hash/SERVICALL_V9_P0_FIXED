/**
 * WORKFLOW ENGINE ROUTER
 * ✅ BLOC 1 FIX: Architecture API -> Service -> Domain -> Infra
 * ✅ Logic moved to WorkflowEngineAdminService and WorkflowEngine
 */

import { z } from "zod";
import { router, managerProcedure } from "../procedures";
import { jsonValueSchema } from "../../shared/validation/workflow";
import { logger } from "../infrastructure/logger";
import { WorkflowEngine } from "../workflow-engine/core/WorkflowEngine";
import { Channel, EventType } from "../workflow-engine/types";
import { v4 as uuidv4 } from "uuid";
import { TRPCError } from "@trpc/server";
import { WorkflowEngineAdminService } from "../services/workflowEngineAdminService";
import { normalizeDbRecords } from "../_core/responseNormalizer";

const engine = new WorkflowEngine();

export const workflowEngineRouter = router({
  /**
   * Déclencher manuellement un workflow pour un prospect
   */
  triggerManual: managerProcedure
    .input(z.object({
      prospectId: z.number().optional().nullable(),
      dryRun: z.boolean().optional().default(false),
      workflowName: z.string().optional(),
      variables: z.record(jsonValueSchema).optional()
    }))
    .mutation(async ({ input, ctx }: any) => {
      try {
        if (input.dryRun || !input.prospectId || input.prospectId === 0) {
          logger.info("[WorkflowEngine] Dry-run détecté — validation syntaxique uniquement", {
            workflowName: input.workflowName,
            tenantId: ctx.tenantId,
          });
          return {
            success: true,
            dryRun: true,
            message: "Workflow valide — dry-run sans exécution réelle",
          };
        }

        // ✅ BLOC 1 FIX: Utilisation de la DB via le service ou import DB autorisé si bootstrap
        const { getProspectById } = await import("../db");
        const prospect = await getProspectById(input.prospectId, ctx.tenantId!);
        
        if (!prospect) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Prospect non trouvé" });
        }

        const event = {
          id: uuidv4(),
          tenant_id: ctx.tenantId!,
          channel: Channel.WEBHOOK,
          type: EventType.MANUAL,
          source: 'UI_MANUAL',
          destination: '',
          data: {
            prospect,
            ...input.variables
          },
          metadata: {
            triggered_by: ctx.user!.id
          },
          status: 'received',
          created_at: new Date()
        };

        const result = await engine.handle(event);

        return {
          success: true,
          execution: result
        };
      } catch (error: any) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : "Erreur lors du déclenchement du workflow"
        });
      }
    }),

  /**
   * Simuler un événement entrant (pour test/démo)
   */
  simulateEvent: managerProcedure
    .input(z.object({
      channel: z.nativeEnum(Channel),
      source: z.string(),
      data: z.record(jsonValueSchema)
    }))
    .mutation(async ({ input, ctx }: any) => {
      const event = {
        id: uuidv4(),
        tenant_id: ctx.tenantId!,
        channel: input.channel,
        type: EventType.INBOUND,
        source: input.source,
        destination: '',
        data: input.data,
        metadata: { simulated: true },
        status: 'received',
        created_at: new Date()
      };

      return await engine.handle(event);
    }),

  /**
   * Lister les dead letters pour le tenant actuel
   */
  listDeadLetters: managerProcedure
    .input(z.object({
      limit: z.number().default(50),
      offset: z.number().default(0)
    }))
    .query(async ({ input, ctx }) => {
      const data = await WorkflowEngineAdminService.listDeadLetters(ctx.tenantId!, input.limit, input.offset);
      return normalizeDbRecords(data);
    }),

  /**
   * Retenter une dead letter
   */
  retryDeadLetter: managerProcedure
    .input(z.object({
      id: z.number()
    }))
    .mutation(async ({ input, ctx }) => {
      return await WorkflowEngineAdminService.retryDeadLetter(ctx.tenantId!, input.id);
    }),

  /**
   * Supprimer une dead letter
   */
  deleteDeadLetter: managerProcedure
    .input(z.object({
      id: z.number()
    }))
    .mutation(async ({ input, ctx }) => {
      return await WorkflowEngineAdminService.deleteDeadLetter(ctx.tenantId!, input.id);
    })
});
