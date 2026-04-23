import type { JsonValue } from "../workflow/contracts";
import type { ActionType } from "../workflow/action-types";

export type WorkflowTrigger =
  | { mode: "manual" }
  | { mode: "scheduled"; schedule: string }
  | { mode: "event"; eventType: string };

export type WorkflowActionConfig = Record<string, JsonValue>;

export interface WorkflowStep {
  id: string | number;
  type: ActionType;
  name?: string;
  label?: string;
  config: WorkflowActionConfig;
  order?: number;
  on_true?: string | number;
  on_false?: string | number;
  stop_on_failure?: boolean;
  retry?: {
    maxAttempts?: number;
    backoffMs?: number;
    backoffMultiplier?: number;
  };
}

export interface Workflow {
  id: number;
  tenantId: number;
  name: string;
  description: string | null;
  triggerType: string | null;
  trigger?: string | null;
  triggerConfig?: Record<string, JsonValue> | null;
  actions: WorkflowStep[] | null;
  isActive: boolean | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface WorkflowExecution {
  id: number;
  workflowId: number;
  tenantId: number;
  status: string;
  trigger: string;
  input: JsonValue | null;
  output: JsonValue | null;
  error: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}
