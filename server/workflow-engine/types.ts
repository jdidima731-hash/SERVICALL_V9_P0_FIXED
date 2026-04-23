import type { calls, prospects, tenants, workflows } from "../../../drizzle/schema";
import type { ActionType } from "../../../shared/workflow/action-types";
import type { JsonValue, WorkflowStepDefinition } from "../../../shared/workflow/contracts";

export type Tenant = typeof tenants.$inferSelect & {
  phoneNumber?: string | null;
};
export type Workflow = typeof workflows.$inferSelect;
export type Contact = typeof prospects.$inferSelect;
export type Call = typeof calls.$inferSelect;

export enum Channel {
  CALL = "call",
  SMS = "sms",
  WHATSAPP = "whatsapp",
  EMAIL = "email",
  FORM = "form",
  WEBHOOK = "webhook",
  APPOINTMENT = "appointment",
  CALENDAR = "calendar",
}

export interface IncomingEvent<
  TData extends Record<string, unknown> = Record<string, unknown>,
  TMeta extends Record<string, unknown> = Record<string, unknown>,
> {
  id: string;
  tenant_id: number;
  channel: Channel | string;
  type: string;
  source: string;
  destination: string;
  data: TData;
  metadata: TMeta;
  status: string;
  created_at: Date;
}

export interface ActionResult<TOutput = Record<string, unknown>> {
  success: boolean;
  data?: TOutput;
  error?: string;
}

export type ActionConfig = Record<string, JsonValue>;

export interface ActionHandler<
  TConfig extends Record<string, unknown>,
  TContext = ExecutionContext<WorkflowVariables>,
  TOutput = unknown,
> {
  name: ActionType | string;
  execute(context: TContext, config: TConfig): Promise<ActionResult<TOutput>>;
  validate(config: TConfig | Record<string, unknown>): boolean;
}

export interface ProspectData {
  id?: number;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  status?: string;
  metadata?: Record<string, unknown>;
}

export interface CallData {
  call_sid?: string;
  recording_url?: string;
  duration?: number;
  transcription?: string;
}

export interface AIData {
  sentiment?: "positif" | "negatif" | "neutre";
  score?: number;
  summary?: string;
  intent?: string;
  classification?: string;
}

export interface WorkflowVariables extends Record<string, unknown> {
  prospect?: ProspectData;
  call?: CallData;
  ai?: AIData;
  last_message?: string;
  transcription?: string;
  ai_score?: number;
  ai_summary?: string;
  business_entities?: Record<string, unknown>;
  appointment?: Record<string, unknown>;
  reservation?: Record<string, unknown>;
  reservation_id?: string;
  recording_url?: string;
  phone?: string;
  caller_phone?: string;
  email?: string;
  audioData?: string | Buffer;
  callId?: string | number;
  visit?: Record<string, unknown>;
  property?: Record<string, unknown>;
  order?: Record<string, unknown>;
  order_id?: string | number;
  order_number?: string;
  order_total?: number;
}

export type ProspectVariables = ProspectData;
export type CallVariables = CallData;
export type CommonExecutionVariables = WorkflowVariables;

export interface EventMetadata extends Record<string, unknown> {
  triggered_by?: string | number;
  webhook_tenant_id?: string | number;
  tenant_id?: string | number;
  trigger?: string;
  agentType?: "AI" | "HUMAN" | "BOTH";
  userId?: number | string;
}

export type StructuredIncomingEvent = IncomingEvent<Record<string, unknown>, EventMetadata>;

export interface ExecutionContext<TVars = WorkflowVariables> {
  event: IncomingEvent;
  tenant: Tenant;
  workflow: Workflow;
  variables: TVars;
  steps_results: Record<string, ActionResult<unknown>>;
}

export interface FinalExecutionContext {
  event: StructuredIncomingEvent;
  tenant: Tenant;
  workflow: Workflow & { steps: WorkflowStepDefinition[] | string };
  executionId?: number;
  variables: WorkflowVariables;
  steps_results: Record<string, ActionResult<unknown>>;
}

export interface TriggerConfig {
  channel?: Channel | string;
  eventType?: string;
  sourcePattern?: string;
  trigger?: string;
  conditions?: JsonValue;
  agentType?: "AI" | "HUMAN" | "BOTH";
}

export type WorkflowExecutionStatus = "SUCCESS" | "FAILED" | "PARTIAL" | "FAILED_INVALID_DEFINITION";

export interface WorkflowExecutionResult<TVars = WorkflowVariables> {
  status: WorkflowExecutionStatus;
  workflow_id: number;
  variables: TVars;
  results: Record<string, ActionResult<unknown>>;
}

export interface WorkflowStep extends WorkflowStepDefinition {}

export interface RetryConfig {
  maxAttempts: number;
  backoffMs: number;
  backoffMultiplier: number;
}

export enum AnalysisType {
  INTENT = "intent",
  SENTIMENT = "sentiment",
  SUMMARY = "summary",
  SCORE = "score",
  CLASSIFICATION = "classification",
}

export interface Industry {
  id: string;
  name: string;
  category: string;
  description: string;
  icon: string;
  capabilities: string[];
  workflows: string[];
  aiSystemPrompt: string;
  workflowCount: number;
}
