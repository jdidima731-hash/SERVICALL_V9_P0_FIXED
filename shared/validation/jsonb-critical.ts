/**
 * BLOC 1 — JSONB CRITICAL TYPES & SCHEMAS
 * ────────────────────────────────────────────────────────
 * Validation stricte et mappers pour les structures JSONB critiques :
 * - ai_generated_profile (profils IA générés)
 * - payload (webhooks, messaging)
 * - metadata (données métier)
 * - workflow input/output (exécution workflows)
 *
 * RÈGLE : Chaque structure a :
 *   1. Un type TypeScript strict
 *   2. Un schéma Zod pour validation runtime
 *   3. Un mapper pour transformation sécurisée
 */

import { z } from "zod";

// ============================================
// 1. AI_GENERATED_PROFILE (Recruitment)
// ============================================

export const AIGeneratedProfileV2Schema = z.object({
  requiredSkills: z.array(z.string()).default([]),
  preferredSkills: z.array(z.string()).default([]),
  minExperience: z.number().int().min(0).default(0),
  maxExperience: z.number().int().min(0).optional(),
  educationLevel: z.enum(["Bac", "Licence", "Master", "Doctorat", "Non spécifié"]).default("Non spécifié"),
  personalityTraits: z.array(z.string()).default([]),
  dealBreakers: z.array(z.string()).default([]),
  salaryRange: z.object({
    min: z.number().int().min(0).optional(),
    max: z.number().int().min(0).optional(),
    currency: z.string().default("EUR"),
  }).optional(),
  contractType: z.enum(["CDI", "CDD", "Stage", "Freelance", "Autre"]).optional(),
  workMode: z.enum(["Présentiel", "Télétravail", "Hybride"]).optional(),
  location: z.string().optional(),
  keywords: z.array(z.string()).default([]),
  scoringCriteria: z.array(z.object({
    criterion: z.string().min(1),
    weight: z.number().min(0).max(100),
    description: z.string().optional(),
  })).default([]),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
}).strict();

export type AIGeneratedProfile = z.infer<typeof AIGeneratedProfileV2Schema>;

export function validateAIGeneratedProfile(data: unknown): AIGeneratedProfile {
  try {
    return AIGeneratedProfileV2Schema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(`Invalid AI Generated Profile: ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ')}`);
    }
    throw error;
  }
}

export function mapToAIGeneratedProfile(raw: unknown): AIGeneratedProfile {
  if (!raw || typeof raw !== 'object') {
    return AIGeneratedProfileV2Schema.parse({});
  }
  const obj = raw as Record<string, unknown>;
  return validateAIGeneratedProfile({
    requiredSkills: Array.isArray(obj.requiredSkills) ? obj.requiredSkills : [],
    preferredSkills: Array.isArray(obj.preferredSkills) ? obj.preferredSkills : [],
    minExperience: typeof obj.minExperience === 'number' ? obj.minExperience : 0,
    maxExperience: typeof obj.maxExperience === 'number' ? obj.maxExperience : undefined,
    educationLevel: typeof obj.educationLevel === 'string' ? obj.educationLevel : "Non spécifié",
    personalityTraits: Array.isArray(obj.personalityTraits) ? obj.personalityTraits : [],
    dealBreakers: Array.isArray(obj.dealBreakers) ? obj.dealBreakers : [],
    salaryRange: obj.salaryRange && typeof obj.salaryRange === 'object' ? obj.salaryRange : undefined,
    contractType: typeof obj.contractType === 'string' ? obj.contractType : undefined,
    workMode: typeof obj.workMode === 'string' ? obj.workMode : undefined,
    location: typeof obj.location === 'string' ? obj.location : undefined,
    keywords: Array.isArray(obj.keywords) ? obj.keywords : [],
    scoringCriteria: Array.isArray(obj.scoringCriteria) ? obj.scoringCriteria : [],
  });
}

// ============================================
// 2. PAYLOAD (Webhooks & Messaging)
// ============================================

export const WebhookPayloadSchema = z.object({
  event: z.string().min(1),
  timestamp: z.number().int().min(0),
  source: z.string().min(1),
  data: z.record(z.unknown()).default({}),
  metadata: z.object({
    requestId: z.string().optional(),
    userId: z.number().optional(),
    tenantId: z.number().optional(),
    retryCount: z.number().int().min(0).default(0),
  }).optional(),
}).strict();

export type WebhookPayload = z.infer<typeof WebhookPayloadSchema>;

export function validateWebhookPayload(data: unknown): WebhookPayload {
  try {
    return WebhookPayloadSchema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(`Invalid Webhook Payload: ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ')}`);
    }
    throw error;
  }
}

export function mapToWebhookPayload(raw: unknown): WebhookPayload {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Webhook payload must be a non-null object');
  }
  const obj = raw as Record<string, unknown>;
  return validateWebhookPayload({
    event: typeof obj.event === 'string' ? obj.event : 'unknown',
    timestamp: typeof obj.timestamp === 'number' ? obj.timestamp : Date.now(),
    source: typeof obj.source === 'string' ? obj.source : 'unknown',
    data: obj.data && typeof obj.data === 'object' ? obj.data : {},
    metadata: obj.metadata && typeof obj.metadata === 'object' ? obj.metadata : undefined,
  });
}

// ============================================
// 3. METADATA (Services critiques)
// ============================================

export const ServiceMetadataSchema = z.object({
  version: z.string().default("1.0"),
  processedAt: z.date().optional(),
  processedBy: z.string().optional(),
  source: z.string().optional(),
  tags: z.array(z.string()).default([]),
  status: z.enum(["pending", "processing", "completed", "failed", "archived"]).default("pending"),
  errorDetails: z.object({
    code: z.string().optional(),
    message: z.string().optional(),
    stack: z.string().optional(),
  }).optional(),
  retryInfo: z.object({
    count: z.number().int().min(0).default(0),
    lastAttempt: z.date().optional(),
    nextRetry: z.date().optional(),
  }).optional(),
  customFields: z.record(z.unknown()).default({}),
}).strict();

export type ServiceMetadata = z.infer<typeof ServiceMetadataSchema>;

export function validateServiceMetadata(data: unknown): ServiceMetadata {
  try {
    return ServiceMetadataSchema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(`Invalid Service Metadata: ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ')}`);
    }
    throw error;
  }
}

export function mapToServiceMetadata(raw: unknown): ServiceMetadata {
  if (!raw || typeof raw !== 'object') {
    return ServiceMetadataSchema.parse({});
  }
  const obj = raw as Record<string, unknown>;
  return validateServiceMetadata({
    version: typeof obj.version === 'string' ? obj.version : "1.0",
    processedAt: obj.processedAt instanceof Date ? obj.processedAt : undefined,
    processedBy: typeof obj.processedBy === 'string' ? obj.processedBy : undefined,
    source: typeof obj.source === 'string' ? obj.source : undefined,
    tags: Array.isArray(obj.tags) ? obj.tags.filter(t => typeof t === 'string') : [],
    status: typeof obj.status === 'string' ? obj.status : "pending",
    errorDetails: obj.errorDetails && typeof obj.errorDetails === 'object' ? obj.errorDetails : undefined,
    retryInfo: obj.retryInfo && typeof obj.retryInfo === 'object' ? obj.retryInfo : undefined,
    customFields: obj.customFields && typeof obj.customFields === 'object' ? obj.customFields : {},
  });
}

// ============================================
// 4. WORKFLOW INPUT/OUTPUT
// ============================================

export const WorkflowInputSchema = z.object({
  trigger: z.string().min(1),
  triggerData: z.record(z.unknown()).default({}),
  context: z.object({
    tenantId: z.number().int().min(1),
    userId: z.number().int().optional(),
    sessionId: z.string().optional(),
    timestamp: z.date().default(() => new Date()),
  }),
  variables: z.record(z.unknown()).default({}),
}).strict();

export type WorkflowInput = z.infer<typeof WorkflowInputSchema>;

export function validateWorkflowInput(data: unknown): WorkflowInput {
  try {
    return WorkflowInputSchema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(`Invalid Workflow Input: ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ')}`);
    }
    throw error;
  }
}

export function mapToWorkflowInput(raw: unknown, tenantId: number): WorkflowInput {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Workflow input must be a non-null object');
  }
  const obj = raw as Record<string, unknown>;
  return validateWorkflowInput({
    trigger: typeof obj.trigger === 'string' ? obj.trigger : 'manual',
    triggerData: obj.triggerData && typeof obj.triggerData === 'object' ? obj.triggerData : {},
    context: {
      tenantId,
      userId: typeof obj.userId === 'number' ? obj.userId : undefined,
      sessionId: typeof obj.sessionId === 'string' ? obj.sessionId : undefined,
      timestamp: new Date(),
    },
    variables: obj.variables && typeof obj.variables === 'object' ? obj.variables : {},
  });
}

export const WorkflowOutputSchema = z.object({
  status: z.enum(["success", "partial", "failed"]),
  result: z.record(z.unknown()).default({}),
  errors: z.array(z.object({
    step: z.string(),
    code: z.string(),
    message: z.string(),
  })).default([]),
  warnings: z.array(z.string()).default([]),
  executionTime: z.number().int().min(0).optional(),
  metadata: z.object({
    stepsExecuted: z.number().int().min(0).default(0),
    stepsSkipped: z.number().int().min(0).default(0),
  }).optional(),
}).strict();

export type WorkflowOutput = z.infer<typeof WorkflowOutputSchema>;

export function validateWorkflowOutput(data: unknown): WorkflowOutput {
  try {
    return WorkflowOutputSchema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(`Invalid Workflow Output: ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ')}`);
    }
    throw error;
  }
}

export function mapToWorkflowOutput(raw: unknown): WorkflowOutput {
  if (!raw || typeof raw !== 'object') {
    return WorkflowOutputSchema.parse({ status: 'failed' });
  }
  const obj = raw as Record<string, unknown>;
  return validateWorkflowOutput({
    status: typeof obj.status === 'string' && ['success', 'partial', 'failed'].includes(obj.status) ? obj.status : 'failed',
    result: obj.result && typeof obj.result === 'object' ? obj.result : {},
    errors: Array.isArray(obj.errors) ? obj.errors : [],
    warnings: Array.isArray(obj.warnings) ? obj.warnings.filter(w => typeof w === 'string') : [],
    executionTime: typeof obj.executionTime === 'number' ? obj.executionTime : undefined,
    metadata: obj.metadata && typeof obj.metadata === 'object' ? obj.metadata : undefined,
  });
}

// ============================================
// EXPORT SUMMARY
// ============================================

export const JSONB_CRITICAL_VALIDATORS = {
  aiGeneratedProfile: validateAIGeneratedProfile,
  webhookPayload: validateWebhookPayload,
  serviceMetadata: validateServiceMetadata,
  workflowInput: validateWorkflowInput,
  workflowOutput: validateWorkflowOutput,
} as const;

export const JSONB_CRITICAL_MAPPERS = {
  aiGeneratedProfile: mapToAIGeneratedProfile,
  webhookPayload: mapToWebhookPayload,
  serviceMetadata: mapToServiceMetadata,
  workflowInput: mapToWorkflowInput,
  workflowOutput: mapToWorkflowOutput,
} as const;
