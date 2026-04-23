import { z } from "zod";
import { AppError } from "../_core/errors";
import { ACTION_TYPES, ActionTypeSchema } from "./action-types";

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue | undefined };

export const JsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(JsonValueSchema),
    z.record(JsonValueSchema),
  ]),
);

export const WorkflowRetrySchema = z.object({
  maxAttempts: z.number().int().min(1).max(5).default(1),
  backoffMs: z.number().int().min(0).default(0),
  backoffMultiplier: z.number().min(1).default(1),
});

export const WorkflowStepSchema = z.object({
  id: z.union([z.string().min(1), z.number().int()]),
  type: ActionTypeSchema,
  name: z.string().min(1).optional(),
  label: z.string().min(1).optional(),
  config: z.record(JsonValueSchema).default({}),
  order: z.number().int().nonnegative().optional(),
  on_true: z.union([z.string().min(1), z.number().int()]).optional(),
  on_false: z.union([z.string().min(1), z.number().int()]).optional(),
  stop_on_failure: z.boolean().optional(),
  retry: WorkflowRetrySchema.optional(),
});

export const WorkflowStepListSchema = z.array(WorkflowStepSchema);

export const BlueprintActionSchema = z.object({
  type: ActionTypeSchema,
  config: z.record(JsonValueSchema).default({}),
});

export const BlueprintSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  industry: z.string().min(1),
  description: z.string().min(1).optional(),
  systemPrompt: z.string().optional(),
  trigger: z.string().min(1),
  actions: z.array(BlueprintActionSchema).min(1),
  version: z.string().min(1),
});

export const BlueprintCollectionSchema = z.array(BlueprintSchema);

export type WorkflowStepDefinition = z.infer<typeof WorkflowStepSchema>;
export type BlueprintDefinition = z.infer<typeof BlueprintSchema>;

function parseJsonString(raw: string, contextLabel: string): unknown {
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw AppError.fromUnknown(
      "JSON_PARSE_ERROR",
      `${contextLabel} contains invalid JSON`,
      error,
      { contextLabel },
    );
  }
}

export function parseWorkflowSteps(input: unknown, contextLabel = "workflow.actions"): WorkflowStepDefinition[] {
  const rawValue = typeof input === "string" ? parseJsonString(input, contextLabel) : input;

  try {
    return WorkflowStepListSchema.parse(rawValue);
  } catch (error) {
    throw AppError.fromUnknown(
      "INVALID_WORKFLOW_DEFINITION",
      `Invalid workflow steps for ${contextLabel}`,
      error,
      { contextLabel },
    );
  }
}

export function parseBlueprintCollection(input: unknown): BlueprintDefinition[] {
  try {
    return BlueprintCollectionSchema.parse(input);
  } catch (error) {
    throw AppError.fromUnknown(
      "VALIDATION_ERROR",
      "Blueprint collection validation failed",
      error,
      { actionTypes: ACTION_TYPES },
    );
  }
}
