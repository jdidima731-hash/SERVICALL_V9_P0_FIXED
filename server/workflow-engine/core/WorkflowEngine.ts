import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { AppError } from "../../../shared/_core/errors";
import { withRLS, workflows, tenants, workflowExecutions, type InsertWorkflowExecution } from "../../db";
import { mapDbWorkflowToRuntime, mapExecutionOutput, mapTenantToRuntime, normalizeEventType } from "../../workflow-engine/mappers/runtimeWorkflow";
import type {
  EventMetadata,
  FinalExecutionContext,
  IncomingEvent,
  StructuredIncomingEvent,
  WorkflowExecutionResult,
  WorkflowVariables,
} from "../../workflow-engine/types";
import { Logger } from "../../workflow-engine/utils/Logger";
import { WorkflowExecutor } from "../../workflow-engine/core/WorkflowExecutor";

const RecordSchema = z.record(z.unknown());

export class WorkflowEngine {
  private readonly executor = new WorkflowExecutor();
  private readonly logger = new Logger("WorkflowEngine");

  async handle(
    event: IncomingEvent,
  ): Promise<WorkflowExecutionResult<WorkflowVariables> | { status: "no_workflow" }> {
    this.logger.info("Handling event", {
      type: event.type,
      channel: event.channel,
    });

    const tenantId = this.resolveTenant(event);
    const userId = this.resolveUserId(event.metadata);

    return withRLS({ userId, tenantId }, async (tx) => {
      const [tenantRecord] = await tx.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1);
      if (!tenantRecord) {
        throw new AppError("TENANT_RESOLUTION_FAILED", `Tenant not found: ${tenantId}`, {
          details: { tenantId },
        });
      }

      const activeWorkflows = await tx
        .select()
        .from(workflows)
        .where(and(eq(workflows.tenantId, tenantId), eq(workflows.isActive, true)));

      const normalizedEventType = normalizeEventType(event.type);
      const candidates = activeWorkflows
        .map((workflowRecord) => mapDbWorkflowToRuntime(workflowRecord))
        .filter((workflowRecord) => workflowRecord.triggerType === "event")
        .map((workflowRecord) => ({
          workflow: workflowRecord,
          score: this.scoreWorkflow(workflowRecord.triggerConfig.eventType, normalizedEventType),
        }))
        .filter((candidate) => candidate.score > 0)
        .sort((left, right) => right.score - left.score);

      const selectedWorkflow = candidates[0]?.workflow;
      if (!selectedWorkflow) {
        this.logger.warn("No matching workflow found", { tenantId, eventType: normalizedEventType });
        return { status: "no_workflow" };
      }

      const structuredEvent: StructuredIncomingEvent = {
        ...event,
        metadata: this.normalizeEventMetadata(event.metadata, tenantId),
      };

      const context: FinalExecutionContext = {
        event: structuredEvent,
        tenant: mapTenantToRuntime(tenantRecord),
        workflow: {
          ...selectedWorkflow,
          trigger: selectedWorkflow.triggerConfig.eventType ?? "manual",
          steps: selectedWorkflow.actions,
        },
        variables: this.normalizeVariables(event.data),
        steps_results: {},
      };

      const executionInsert: InsertWorkflowExecution = {
        workflowId: selectedWorkflow.id,
        tenantId,
        status: "pending",
        trigger: normalizedEventType ?? String(event.type),
        input: mapExecutionOutput({
          workflow_id: selectedWorkflow.id,
          result_status: "SUCCESS",
          variables: this.normalizeVariables(event.data),
          steps_results: {},
        }),
        startedAt: new Date(),
      };

      const [executionRow] = await tx
        .insert(workflowExecutions)
        .values(executionInsert)
        .returning({ id: workflowExecutions.id });

      context.executionId = executionRow?.id;

      const result = await this.executor.execute(context);

      if (context.executionId) {
        await tx
          .update(workflowExecutions)
          .set({
            status: result.status === "SUCCESS" ? "completed" : "failed",
            output: mapExecutionOutput({
              workflow_id: result.workflow_id,
              execution_id: context.executionId,
              result_status: result.status,
              variables: this.ensureRecord(result.variables),
              steps_results: this.ensureRecord(result.results),
            }),
            error: result.status === "SUCCESS" ? null : JSON.stringify(result.results),
            completedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(workflowExecutions.id, context.executionId));
      }

      return result;
    });
  }

  private scoreWorkflow(workflowEventType: string | undefined, normalizedEventType: string | undefined): number {
    if (!workflowEventType || !normalizedEventType) {
      return -1;
    }
    return workflowEventType === normalizedEventType ? 100 : -1;
  }

  private resolveTenant(event: IncomingEvent): number {
    const metadata = this.ensureRecord(event.metadata);
    const rawTenantId = event.tenant_id ?? metadata.tenant_id;
    const tenantId = typeof rawTenantId === "string" ? Number(rawTenantId) : rawTenantId;

    if (!Number.isInteger(tenantId) || Number(tenantId) <= 0) {
      throw new AppError("TENANT_RESOLUTION_FAILED", `Missing tenant_id for event ${event.type}`, {
        details: { eventId: event.id },
      });
    }

    return Number(tenantId);
  }

  private resolveUserId(metadata: unknown): number {
    const safeMetadata = this.ensureRecord(metadata);
    const rawUserId = safeMetadata.userId;
    const userId = typeof rawUserId === "string" ? Number(rawUserId) : rawUserId;
    return Number.isInteger(userId) && Number(userId) > 0 ? Number(userId) : 1;
  }

  private normalizeEventMetadata(metadata: unknown, tenantId: number): EventMetadata {
    const safeMetadata = this.ensureRecord(metadata);
    return {
      ...safeMetadata,
      tenant_id: safeMetadata.tenant_id ?? tenantId,
    };
  }

  private normalizeVariables(data: unknown): WorkflowVariables {
    return RecordSchema.parse(this.ensureRecord(data));
  }

  private ensureRecord(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return {};
    }
    return RecordSchema.parse(value);
  }
}
