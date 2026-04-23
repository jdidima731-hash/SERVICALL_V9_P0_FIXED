import { z } from "zod";
import { router } from "../_core/trpc";
import { adminProcedure, managerProcedure, tenantProcedure } from "../procedures";
import { WorkflowService, getTenantWorkflowExecutionHistory } from "../services/workflowService";
import { logger } from "../infrastructure/logger";
import { TRPCError } from "@trpc/server";
import { normalizeResponse, normalizeDbRecords, normalizeDbRecord } from "../_core/responseNormalizer";
import { paginationInput, paginate } from "../_core/pagination";
import { 
  workflowSchema, paginatedWorkflowSchema,
  WorkflowCreateSchema,
  WorkflowUpdateSchema,
  jsonValueSchema
} from "../../shared/validation/workflow";
import { 
  WorkflowDTOSchema, 
  WorkflowExecutionDTOSchema,
  mapToWorkflowDTO,
  mapToWorkflowExecutionDTO
} from "../../shared/dto/workflow.dto";
import { BlueprintCatalogService } from "../services/blueprintCatalogService";

/**
 * Router pour la gestion et consultation des workflows IA
 * ✅ BLOC 1 FIX: Thin router — logique métier centralisée dans WorkflowService
 */
export const workflowRouter = router({
  /**
   * Liste tous les workflows d'un tenant
   */
  list: tenantProcedure
    .input(paginationInput)
    .output(z.object({
      items: z.array(WorkflowDTOSchema),
      total: z.number(),
      page: z.number(),
      limit: z.number(),
      totalPages: z.number(),
    }))
    .query(async ({ ctx, input }) => {
      if (!ctx.tenantId) throw new TRPCError({ code: 'UNAUTHORIZED' });
      const { data, total } = await WorkflowService.list(ctx.tenantId, input.limit, (input.page - 1) * input.limit);
      const items = data.map(w => mapToWorkflowDTO(w));
      return paginate(items, total, input);
    }),

  /**
   * Récupère un workflow par son ID
   */
  getById: tenantProcedure
    .input(z.object({ workflowId: z.number() }))
    .output(WorkflowDTOSchema)
    .query(async ({ input, ctx }) => {
      if (!ctx.tenantId) throw new TRPCError({ code: 'UNAUTHORIZED' });
      const workflow = await WorkflowService.getById(input.workflowId, ctx.tenantId);
      if (!workflow) throw new TRPCError({ code: "NOT_FOUND", message: "Workflow not found" });
      return mapToWorkflowDTO(workflow);
    }),

  /**
   * Crée un nouveau workflow
   */
  create: managerProcedure
    .input(WorkflowCreateSchema)
    .output(workflowSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const workflow = await WorkflowService.create({
          tenantId: ctx.tenantId!,
          name: input.name,
          description: input.description,
          triggerType: input.triggerType || 'manual',
          triggerConfig: input.triggerConfig,
          actions: input.actions || [],
          isActive: true,
        });
        return normalizeDbRecord(workflow) as unknown;
      } catch (error: any) {
        logger.error("[WorkflowRouter] Create failed", { error });
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Erreur lors de la création" });
      }
    }),

  /**
   * Met à jour un workflow existant
   */
  update: managerProcedure
    .input(WorkflowUpdateSchema.extend({ workflowId: z.number() }))
    .output(workflowSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        const { workflowId, ...data } = input;
        const updated = await WorkflowService.update(workflowId, ctx.tenantId!, data as unknown);
        if (!updated) throw new TRPCError({ code: "NOT_FOUND", message: "Workflow non trouvé" });
        return normalizeDbRecord(updated) as unknown;
      } catch (error: any) {
        logger.error("[WorkflowRouter] Update failed", { error });
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Erreur lors de la mise à jour" });
      }
    }),

  /**
   * Alias pour compatibilité front (WorkflowEditor)
   */
  save: managerProcedure
    .input(
      z.object({
        workflowId: z.number().optional(),
        name: z.string().min(1),
        triggerType: z.string().optional(),
        triggerConfig: z.record(jsonValueSchema).optional(),
        actions: z.array(z.unknown()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { workflowId, ...data } = input;
      if (!ctx.tenantId) throw new TRPCError({ code: 'UNAUTHORIZED' });

      try {
        if (workflowId) {
          const updated = await WorkflowService.update(workflowId, ctx.tenantId!, {
            name: data.name,
            triggerType: data.triggerType,
            triggerConfig: data.triggerConfig,
            actions: data.actions,
          });
          if (!updated) throw new TRPCError({ code: 'NOT_FOUND' });
          return normalizeDbRecord(updated);
        } else {
          const created = await WorkflowService.create({
            tenantId: ctx.tenantId!,
            name: data.name,
            triggerType: data.triggerType || "manual",
            triggerConfig: data.triggerConfig,
            actions: data.actions || [],
            isActive: true,
          });
          return normalizeDbRecord(created);
        }
      } catch (error: any) {
        logger.error("[WorkflowRouter] Save failed", { error });
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Erreur lors de la sauvegarde" });
      }
    }),

  /**
   * Supprime un workflow
   */
  delete: managerProcedure 
    .input(z.object({ workflowId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      if (!ctx.tenantId) throw new TRPCError({ code: 'UNAUTHORIZED' });
      const result = await WorkflowService.delete(input.workflowId, ctx.tenantId);
      if (!result) throw new TRPCError({ code: "NOT_FOUND", message: "Workflow not found" });
      return normalizeResponse(result, 'workflow.delete');
    }),

  /**
   * Récupère l'historique des exécutions
   */
  getExecutionHistory: managerProcedure 
    .input(z.object({ workflowId: z.number(), limit: z.number().optional().default(50) }))
    .output(z.object({
      workflowId: z.number(),
      executions: z.array(WorkflowExecutionDTOSchema),
      total: z.number(),
    }))
    .query(async ({ input, ctx }) => {
      if (!ctx.tenantId) throw new TRPCError({ code: 'UNAUTHORIZED' });
      const history = await WorkflowService.getExecutionHistory(input.workflowId, input.limit);
      return {
        workflowId: input.workflowId,
        executions: history.map(e => mapToWorkflowExecutionDTO(e)),
        total: history.length,
      };
    }),

  /**
   * Importe un blueprint
   */
  importBlueprint: managerProcedure
    .input(z.object({ blueprintId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenantId) throw new TRPCError({ code: 'UNAUTHORIZED' });
      try {
        const workflow = await BlueprintCatalogService.import(input.blueprintId, ctx.tenantId);
        return normalizeDbRecord(workflow);
      } catch (error: any) {
        logger.error("[WorkflowRouter] Import failed", { error, blueprintId: input.blueprintId });
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Erreur lors de l'import du blueprint" });
      }
    }),

  /**
   * Liste les blueprints
   */
  listBlueprints: tenantProcedure
    .input(z.object({ category: z.string().optional(), limit: z.number().default(50), offset: z.number().default(0) }))
    .query(async ({ input }) => {
      const blueprints = await BlueprintCatalogService.list(input);
      return normalizeResponse({ blueprints }, 'workflow.blueprintsList');
    }),
});
