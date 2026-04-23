/**
 * BLOC 2 — WORKFLOW DTOs (Data Transfer Objects)
 * ────────────────────────────────────────────────────────
 * DTOs pour les réponses API du domaine Workflow.
 * Abstraction des structures complexes et des métadonnées internes.
 */

import { z } from "zod";

// ============================================
// WORKFLOW DTO
// ============================================

export const WorkflowDTOSchema = z.object({
  id: z.number().int(),
  tenantId: z.number().int(),
  name: z.string(),
  description: z.string().nullable(),
  trigger: z.string(),
  isActive: z.boolean(),
  stepCount: z.number().int().min(0),
  createdAt: z.date(),
  updatedAt: z.date(),
}).strict();

export type WorkflowDTO = z.infer<typeof WorkflowDTOSchema>;

// ============================================
// WORKFLOW_EXECUTION DTO
// ============================================

export const WorkflowExecutionDTOSchema = z.object({
  id: z.number().int(),
  workflowId: z.number().int(),
  tenantId: z.number().int(),
  status: z.enum(["pending", "running", "completed", "failed", "cancelled"]),
  errorMessage: z.string().nullable(),
  executionTime: z.number().int().min(0).nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
}).strict();

export type WorkflowExecutionDTO = z.infer<typeof WorkflowExecutionDTOSchema>;

// ============================================
// WORKFLOW_TEMPLATE DTO
// ============================================

export const WorkflowTemplateDTOSchema = z.object({
  id: z.number().int(),
  templateId: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  triggerType: z.string().nullable(),
  isActive: z.boolean(),
  stepCount: z.number().int().min(0),
  createdAt: z.date(),
}).strict();

export type WorkflowTemplateDTO = z.infer<typeof WorkflowTemplateDTOSchema>;

// ============================================
// WORKFLOW_STEP DTO
// ============================================

export const WorkflowStepDTOSchema = z.object({
  id: z.string(),
  workflowId: z.number().int(),
  type: z.string(),
  name: z.string().nullable(),
  order: z.number().int().min(0),
  isActive: z.boolean(),
}).strict();

export type WorkflowStepDTO = z.infer<typeof WorkflowStepDTOSchema>;

// ============================================
// MAPPERS
// ============================================

export function mapToWorkflowDTO(raw: unknown): WorkflowDTO {
  if (!raw || typeof raw !== 'object') throw new Error('Invalid workflow data');
  const obj = raw as Record<string, unknown>;
  return WorkflowDTOSchema.parse({
    id: obj.id,
    tenantId: obj.tenantId,
    name: obj.name,
    description: obj.description ?? null,
    trigger: obj.trigger ?? "manual",
    isActive: obj.isActive ?? true,
    stepCount: typeof obj.stepCount === 'number' ? obj.stepCount : 0,
    createdAt: obj.createdAt instanceof Date ? obj.createdAt : new Date(String(obj.createdAt)),
    updatedAt: obj.updatedAt instanceof Date ? obj.updatedAt : new Date(String(obj.updatedAt)),
  });
}

export function mapToWorkflowExecutionDTO(raw: unknown): WorkflowExecutionDTO {
  if (!raw || typeof raw !== 'object') throw new Error('Invalid workflow execution data');
  const obj = raw as Record<string, unknown>;
  return WorkflowExecutionDTOSchema.parse({
    id: obj.id,
    workflowId: obj.workflowId,
    tenantId: obj.tenantId,
    status: obj.status ?? "pending",
    errorMessage: obj.errorMessage ?? null,
    executionTime: typeof obj.executionTime === 'number' ? obj.executionTime : null,
    createdAt: obj.createdAt instanceof Date ? obj.createdAt : new Date(String(obj.createdAt)),
    updatedAt: obj.updatedAt instanceof Date ? obj.updatedAt : new Date(String(obj.updatedAt)),
  });
}

export function mapToWorkflowTemplateDTO(raw: unknown): WorkflowTemplateDTO {
  if (!raw || typeof raw !== 'object') throw new Error('Invalid workflow template data');
  const obj = raw as Record<string, unknown>;
  return WorkflowTemplateDTOSchema.parse({
    id: obj.id,
    templateId: obj.templateId,
    name: obj.name,
    description: obj.description ?? null,
    triggerType: obj.triggerType ?? null,
    isActive: obj.isActive ?? true,
    stepCount: typeof obj.stepCount === 'number' ? obj.stepCount : 0,
    createdAt: obj.createdAt instanceof Date ? obj.createdAt : new Date(String(obj.createdAt)),
  });
}

export function mapToWorkflowStepDTO(raw: unknown): WorkflowStepDTO {
  if (!raw || typeof raw !== 'object') throw new Error('Invalid workflow step data');
  const obj = raw as Record<string, unknown>;
  return WorkflowStepDTOSchema.parse({
    id: String(obj.id),
    workflowId: obj.workflowId,
    type: obj.type,
    name: obj.name ?? null,
    order: typeof obj.order === 'number' ? obj.order : 0,
    isActive: obj.isActive ?? true,
  });
}
