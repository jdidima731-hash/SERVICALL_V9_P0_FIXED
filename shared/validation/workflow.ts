import { z } from 'zod';
import { IdSchema, TenantIdSchema, DateSchema, TriggerTypeEnum, JsonSchema } from './common';

/**
 * Schémas Zod pour les Workflows
 * 
 * Définit les types pour les workflows, les exécutions et les configurations.
 */

// ============================================
// WORKFLOWS
// ============================================

// ✅ FIX P1: Définition de schémas explicites pour les actions et conditions
// Plus de z.unknown() sur le périmètre critique.

const jsonLiteralSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);
export const jsonValueSchema: z.ZodTypeAny = z.lazy(() => z.union([
  jsonLiteralSchema,
  z.array(jsonValueSchema),
  z.record(jsonValueSchema),
]));

export const WorkflowActionSchema = z.object({
  id: z.string().or(z.number()),
  type: z.string().min(1),
  name: z.string().optional(),
  config: z.record(jsonValueSchema).default({}),
  on_true: z.string().or(z.number()).optional(),
  on_false: z.string().or(z.number()).optional(),
  stop_on_failure: z.boolean().optional(),
  retry: z.object({
    maxAttempts: z.number().int().min(1).max(5).optional(),
    backoffMs: z.number().int().min(100).optional(),
    backoffMultiplier: z.number().min(1).optional(),
  }).optional(),
});

export const WorkflowConditionSchema = z.object({
  id: z.string().or(z.number()),
  field: z.string().min(1),
  operator: z.enum(['equals', 'notEquals', 'contains', 'notContains', 'greaterThan', 'lessThan', 'exists', 'notExists']),
  value: jsonValueSchema.optional(),
  logicalOperator: z.enum(['and', 'or']).default('and'),
});

export const WorkflowTriggerConfigSchema = z.object({
  eventType: z.string().optional(),
  channel: z.string().optional(),
  sourcePattern: z.string().optional(),
  agentType: z.enum(['AI', 'HUMAN', 'BOTH']).optional(),
  blueprintId: z.string().optional(),
  blueprintVersion: z.number().int().positive().optional(),
  importedAt: z.string().datetime().optional(),
});

export const WorkflowBaseSchema = z.object({
  id: IdSchema,
  tenantId: TenantIdSchema,
  name: z.string().min(1, 'Nom du workflow requis'),
  description: z.string().optional().nullable(),
  isActive: z.boolean().default(true),
  triggerType: TriggerTypeEnum,
  triggerConfig: WorkflowTriggerConfigSchema.optional().nullable(),
  actions: z.array(WorkflowActionSchema).optional().nullable(),
  conditions: z.array(WorkflowConditionSchema).optional().nullable(),
  createdAt: DateSchema.optional().nullable(),
  updatedAt: DateSchema.optional().nullable(),
  createdBy: IdSchema.optional().nullable(),
});

// ✅ Alias pour cohérence (workflowSchema vs WorkflowSchema)
export const WorkflowSchema = WorkflowBaseSchema;
export const workflowSchema = WorkflowBaseSchema;

export const WorkflowCreateSchema = z.object({
  name: z.string().min(1, 'Nom du workflow requis'),
  description: z.string().optional(),
  triggerType: TriggerTypeEnum,
  triggerConfig: WorkflowTriggerConfigSchema.optional(),
  actions: z.array(WorkflowActionSchema).optional(),
  conditions: z.array(WorkflowConditionSchema).optional(),
});

export const WorkflowUpdateSchema = z.object({
  name: z.string().min(1, 'Nom du workflow requis').optional(),
  description: z.string().optional(),
  isActive: z.boolean().optional(),
  triggerType: TriggerTypeEnum.optional(),
  triggerConfig: WorkflowTriggerConfigSchema.optional(),
  actions: z.array(WorkflowActionSchema).optional(),
  conditions: z.array(WorkflowConditionSchema).optional(),
});

export const paginatedWorkflowSchema = z.object({
  data: z.array(workflowSchema),
  pagination: z.object({
    total: z.number(),
    page: z.number(),
    limit: z.number(),
    totalPages: z.number(),
  }),
});

// ============================================
// WORKFLOW EXECUTIONS
// ============================================

export const WorkflowExecutionBaseSchema = z.object({
  id: IdSchema,
  workflowId: IdSchema,
  tenantId: TenantIdSchema,
  status: z.enum(['pending', 'running', 'completed', 'failed']).default('pending'),
  trigger: z.string().min(1, 'Trigger requis'),
  input: JsonSchema.optional().nullable(),
  output: JsonSchema.optional().nullable(),
  error: z.string().optional().nullable(),
  startedAt: DateSchema.optional().nullable(),
  completedAt: DateSchema.optional().nullable(),
  createdAt: DateSchema.optional().nullable(),
  updatedAt: DateSchema.optional().nullable(),
});

export const WorkflowExecutionCreateSchema = z.object({
  workflowId: IdSchema,
  trigger: z.string().min(1, 'Trigger requis'),
  input: JsonSchema.optional(),
});

export const WorkflowExecutionUpdateSchema = z.object({
  status: z.enum(['pending', 'running', 'completed', 'failed']).optional(),
  output: JsonSchema.optional(),
  error: z.string().optional(),
  completedAt: DateSchema.optional(),
});

export const WorkflowExecutionSchema = WorkflowExecutionBaseSchema;

// ============================================
// WORKFLOW ACTIONS
// ============================================

// ✅ WorkflowActionBaseSchema et WorkflowConditionBaseSchema ont été remplacés par WorkflowActionSchema et WorkflowConditionSchema plus haut.
export const WorkflowActionCreateSchema = WorkflowActionSchema;
export const WorkflowConditionCreateSchema = WorkflowConditionSchema;

// ============================================
// TYPES GÉNÉRÉS
// ============================================

export type Workflow = z.infer<typeof WorkflowSchema>;
export type WorkflowCreate = z.infer<typeof WorkflowCreateSchema>;
export type WorkflowUpdate = z.infer<typeof WorkflowUpdateSchema>;

export type WorkflowExecution = z.infer<typeof WorkflowExecutionSchema>;
export type WorkflowExecutionCreate = z.infer<typeof WorkflowExecutionCreateSchema>;
export type WorkflowExecutionUpdate = z.infer<typeof WorkflowExecutionUpdateSchema>;

export type WorkflowAction = z.infer<typeof WorkflowActionSchema>;
export type WorkflowActionCreate = z.infer<typeof WorkflowActionCreateSchema>;

export type WorkflowCondition = z.infer<typeof WorkflowConditionSchema>;
export type WorkflowConditionCreate = z.infer<typeof WorkflowConditionCreateSchema>;
