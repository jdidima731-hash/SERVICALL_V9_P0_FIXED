import { LEGACY_EVENT_MAPPING, isValidEventType } from "../../../shared/eventTypes";
import { AppError } from "../../../shared/_core/errors";
import { JsonValueSchema, parseWorkflowSteps, type JsonValue, type WorkflowStepDefinition } from "../../../shared/workflow/contracts";
import { z } from "zod";
import type { Tenant, Workflow as DbWorkflow } from "../types";

const RuntimeTriggerSchema = z.object({
  eventType: z.string().optional(),
  channel: z.string().optional(),
  sourcePattern: z.string().optional(),
  trigger: z.string().optional(),
  agentType: z.enum(["AI", "HUMAN", "BOTH"]).optional(),
  conditions: z.record(JsonValueSchema).optional(),
});

export interface RuntimeWorkflow {
  id: number;
  tenantId: number;
  name: string;
  description: string | null;
  isActive: boolean;
  triggerType: "event" | "manual" | "scheduled";
  triggerConfig: z.infer<typeof RuntimeTriggerSchema>;
  actions: WorkflowStepDefinition[];
}

export interface RuntimeTenant extends Tenant {
  phoneNumber?: string | null;
}

export function normalizeEventType(rawEventType: string | undefined): string | undefined {
  if (!rawEventType) {
    return undefined;
  }

  if (isValidEventType(rawEventType)) {
    return rawEventType;
  }

  return LEGACY_EVENT_MAPPING[rawEventType] ?? rawEventType;
}

export function mapDbWorkflowToRuntime(workflow: DbWorkflow): RuntimeWorkflow {
  const triggerConfigInput = workflow.triggerConfig ?? {};
  const parsedTriggerConfig = RuntimeTriggerSchema.safeParse(triggerConfigInput);

  if (!parsedTriggerConfig.success) {
    throw AppError.fromUnknown(
      "INVALID_WORKFLOW_DEFINITION",
      `Workflow ${workflow.id} has invalid trigger configuration`,
      parsedTriggerConfig.error,
      { workflowId: workflow.id },
    );
  }

  const normalizedEventType = normalizeEventType(
    typeof workflow.trigger === "string"
      ? workflow.trigger
      : parsedTriggerConfig.data.eventType,
  );

  return {
    id: workflow.id,
    tenantId: workflow.tenantId,
    name: workflow.name,
    description: workflow.description ?? null,
    isActive: workflow.isActive ?? false,
    triggerType: normalizedEventType ? "event" : "manual",
    triggerConfig: {
      ...parsedTriggerConfig.data,
      eventType: normalizedEventType,
    },
    actions: parseWorkflowSteps(workflow.steps, `workflow:${workflow.id}.steps`),
  };
}

export function mapTenantToRuntime(tenant: Tenant): RuntimeTenant {
  return {
    ...tenant,
    phoneNumber:
      typeof tenant.phoneNumber === "string" || tenant.phoneNumber === null
        ? tenant.phoneNumber
        : null,
  };
}

export interface ExecutionAuditLog {
  workflow_id: number;
  execution_id?: number;
  result_status: "SUCCESS" | "FAILED" | "PARTIAL" | "FAILED_INVALID_DEFINITION";
  variables: Record<string, unknown>;
  steps_results: Record<string, unknown>;
}

export function mapExecutionOutput(input: ExecutionAuditLog): JsonValue {
  return JsonValueSchema.parse(input);
}
