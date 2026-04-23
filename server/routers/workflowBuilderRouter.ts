/**
 * WORKFLOW BUILDER ROUTER — SERVICALL V8
 * API → Service → Domain → Infra
 */
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { AppError } from "@shared/_core/errors";
import { EVENT_TYPES, isValidEventType } from "@shared/eventTypes";
import { ACTION_METADATA, ActionTypeSchema } from "@shared/workflow/action-types";
import { JsonValueSchema } from "@shared/workflow/contracts";
import { assertNotFrozen } from "@server/_core/freeze";
import { normalizeDbRecord } from "@server/_core/responseNormalizer";
import { createLogger } from "@server/lib/logger";
// withTenantContext removed - using tenantProcedure context directly
import { router, tenantProcedure, managerProcedure } from "@server/procedures";
import { WorkflowService } from "@server/services/workflowService";
import { actionRegistry } from "@server/workflow-engine/actionRegistry";

const logger = createLogger("workflowBuilderRouter");

const WorkflowBuilderActionSchema = z.object({
  id: z.string().min(1),
  type: ActionTypeSchema,
  label: z.string().min(1),
  config: z.record(JsonValueSchema).default({}),
  order: z.number().int().nonnegative(),
});

const WorkflowBuilderSaveInputSchema = z.object({
  workflowId: z.number().int().positive().optional(),
  name: z.string().min(1),
  description: z.string().min(1).optional(),
  triggerMode: z.enum(["manual", "scheduled", "event"]).default("manual"),
  eventType: z.enum(EVENT_TYPES).optional(),
  triggerConfig: z.record(JsonValueSchema).optional(),
  actions: z.array(WorkflowBuilderActionSchema).default([]),
});

function mapAppErrorToTrpc(error: AppError): TRPCError {
  if (
    error.code === "UNKNOWN_ACTION" ||
    error.code === "VALIDATION_ERROR" ||
    error.code === "INVALID_WORKFLOW_DEFINITION"
  ) {
    return new TRPCError({ code: "BAD_REQUEST", message: error.message });
  }

  return new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Erreur lors de la sauvegarde" });
}

export const workflowBuilderRouter = router({
  save: managerProcedure
    .input(WorkflowBuilderSaveInputSchema)
    .mutation(async ({ ctx, input }) => {
      assertNotFrozen("workflowBuilder.save");

      try {
          input.actions.forEach((action) => {
            actionRegistry.getHandler(action.type);
          });

          if (input.triggerMode === "event" && (!input.eventType || !isValidEventType(input.eventType))) {
            throw new AppError(
              "VALIDATION_ERROR",
              `INVALID_TRIGGER: Le type d'événement "${String(input.eventType)}" est invalide.`,
            );
          }

          const triggerConfig = input.triggerMode === "event"
            ? {
                ...(input.triggerConfig ?? {}),
                eventType: input.eventType,
              }
            : input.triggerConfig;

          if (input.workflowId) {
            const updated = await WorkflowService.update(input.workflowId, ctx.tenantId, {
              name: input.name,
              description: input.description,
              triggerType: input.triggerMode,
              triggerConfig,
              actions: input.actions,
            });

            if (!updated) {
              throw new TRPCError({ code: "NOT_FOUND", message: "Workflow non trouvé" });
            }

            return normalizeDbRecord(updated);
          }

          const created = await WorkflowService.create({
            tenantId: ctx.tenantId,
            name: input.name,
            description: input.description,
            triggerType: input.triggerMode,
            triggerConfig: triggerConfig ?? null,
            actions: input.actions,
            isActive: true,
          });

          return normalizeDbRecord(created);
        } catch (error) {
          if (error instanceof TRPCError) {
            throw error;
          }

          const appError = AppError.fromUnknown("INTERNAL_ERROR", "Workflow save failed", error, {
            tenantId: ctx.tenantId,
            workflowId: input.workflowId,
          });

          logger.error(appError.message, appError, {
            code: appError.code,
            tenantId: ctx.tenantId,
            workflowId: input.workflowId,
          });

          throw mapAppErrorToTrpc(appError);
        }
    }),

  list: tenantProcedure
    .input(z.object({
      limit: z.number().int().min(1).max(100).default(50),
      offset: z.number().int().min(0).default(0),
    }))
    .query(async ({ ctx, input }) => {
      const { data, total } = await WorkflowService.list(ctx.tenantId!, input.limit, input.offset);
      return { data: data.map(normalizeDbRecord), total };
    }),

  activate: managerProcedure
    .input(z.object({ workflowId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const updated = await WorkflowService.update(input.workflowId, ctx.tenantId!, { isActive: true });
      if (!updated) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Workflow non trouvé" });
      }
      return normalizeDbRecord(updated);
    }),

  deactivate: managerProcedure
    .input(z.object({ workflowId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const updated = await WorkflowService.update(input.workflowId, ctx.tenantId!, { isActive: false });
      if (!updated) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Workflow non trouvé" });
      }
      return normalizeDbRecord(updated);
    }),

  duplicate: managerProcedure
    .input(z.object({
      workflowId: z.number().int().positive(),
      newName: z.string().min(1).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      assertNotFrozen("workflowBuilder.duplicate");

      const source = await WorkflowService.getById(input.workflowId, ctx.tenantId!);
      if (!source) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Workflow source non trouvé" });
      }

      const copy = await WorkflowService.create({
        tenantId: ctx.tenantId!,
        name: input.newName ?? `${source.name} (copie)`,
        description: source.description ?? undefined,
        triggerType: source.triggerType ?? "manual",
        triggerConfig: source.triggerConfig ?? null,
        actions: source.actions ?? [],
        isActive: false,
      });

      return normalizeDbRecord(copy);
    }),

  delete: managerProcedure
    .input(z.object({ workflowId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      assertNotFrozen("workflowBuilder.delete");

      const result = await WorkflowService.delete(input.workflowId, ctx.tenantId!);
      if (!result) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Workflow non trouvé" });
      }
      return { success: true, workflowId: input.workflowId };
    }),

  listActionTypes: tenantProcedure.query(async () => ({
    data: actionRegistry.listTypes().map((type) => ACTION_METADATA[type]),
  })),

  listEventTypes: tenantProcedure.query(async () => ({
    data: EVENT_TYPES.map((type) => ({
      type,
      label: type.split(".").map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1)).join(" "),
    })),
  })),

  getExecutions: tenantProcedure
    .input(z.object({
      workflowId: z.number().int().positive(),
      limit: z.number().int().min(1).max(200).default(50),
    }))
    .query(async ({ ctx, input }) => {
      const executions = await WorkflowService.getExecutionHistory(input.workflowId, input.limit);
      return { data: executions };
    }),
});
