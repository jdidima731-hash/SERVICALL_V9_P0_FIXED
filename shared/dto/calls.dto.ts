/**
 * BLOC 2 — CALLS DTOs (Data Transfer Objects)
 * ────────────────────────────────────────────────────────
 * DTOs pour les réponses API du domaine Calls.
 * Masquage des données sensibles (PII) et abstraction des structures internes.
 */

import { z } from "zod";

// ============================================
// CALL DTO (Public)
// ============================================

export const CallDTOSchema = z.object({
  id: z.number().int(),
  tenantId: z.number().int(),
  prospectId: z.number().int().nullable(),
  agentId: z.number().int().nullable(),
  callType: z.enum(["inbound", "outbound"]),
  status: z.enum(["pending", "active", "completed", "failed"]),
  duration: z.number().int().min(0).nullable(),
  sentiment: z.enum(["positive", "neutral", "negative"]).nullable(),
  outcome: z.enum(["success", "partial", "failed"]).nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
}).strict();

export type CallDTO = z.infer<typeof CallDTOSchema>;

// ============================================
// CALL_RECORDING DTO
// ============================================

export const CallRecordingDTOSchema = z.object({
  id: z.number().int(),
  callId: z.number().int(),
  recordingUrl: z.string().url().nullable(),
  transcription: z.string().nullable(),
  summary: z.string().nullable(),
  createdAt: z.date(),
}).strict();

export type CallRecordingDTO = z.infer<typeof CallRecordingDTOSchema>;

// ============================================
// CALL_SCORING DTO
// ============================================

export const CallScoringDTOSchema = z.object({
  id: z.number().int(),
  callId: z.number().int(),
  agentId: z.number().int().nullable(),
  score: z.number().min(0).max(100),
  criteria: z.record(z.number()).default({}),
  feedback: z.string().nullable(),
  createdAt: z.date(),
}).strict();

export type CallScoringDTO = z.infer<typeof CallScoringDTOSchema>;

// ============================================
// SIMULATED_CALL DTO
// ============================================

export const SimulatedCallDTOSchema = z.object({
  id: z.string(),
  tenantId: z.number().int(),
  agentId: z.number().int().nullable(),
  scenarioName: z.string().nullable(),
  status: z.enum(["in_progress", "completed", "abandoned"]),
  duration: z.number().int().min(0),
  score: z.number().int().min(0).max(100),
  startedAt: z.date(),
  completedAt: z.date().nullable(),
  createdAt: z.date(),
}).strict();

export type SimulatedCallDTO = z.infer<typeof SimulatedCallDTOSchema>;

// ============================================
// AGENT_SWITCH_HISTORY DTO
// ============================================

export const AgentSwitchHistoryDTOSchema = z.object({
  id: z.number().int(),
  tenantId: z.number().int(),
  userId: z.number().int().nullable(),
  previousAgentType: z.enum(["AI", "Human"]).nullable(),
  newAgentType: z.enum(["AI", "Human"]).nullable(),
  reason: z.string().nullable(),
  createdAt: z.date(),
}).strict();

export type AgentSwitchHistoryDTO = z.infer<typeof AgentSwitchHistoryDTOSchema>;

// ============================================
// MAPPERS
// ============================================

export function mapToCallDTO(raw: unknown): CallDTO {
  if (!raw || typeof raw !== 'object') throw new Error('Invalid call data');
  const obj = raw as Record<string, unknown>;
  return CallDTOSchema.parse({
    id: obj.id,
    tenantId: obj.tenantId,
    prospectId: obj.prospectId ?? null,
    agentId: obj.agentId ?? null,
    callType: obj.callType ?? "inbound",
    status: obj.status ?? "pending",
    duration: typeof obj.duration === 'number' ? obj.duration : null,
    sentiment: obj.sentiment ?? null,
    outcome: obj.outcome ?? null,
    createdAt: obj.createdAt instanceof Date ? obj.createdAt : new Date(String(obj.createdAt)),
    updatedAt: obj.updatedAt instanceof Date ? obj.updatedAt : new Date(String(obj.updatedAt)),
  });
}

export function mapToCallRecordingDTO(raw: unknown): CallRecordingDTO {
  if (!raw || typeof raw !== 'object') throw new Error('Invalid call recording data');
  const obj = raw as Record<string, unknown>;
  return CallRecordingDTOSchema.parse({
    id: obj.id,
    callId: obj.callId,
    recordingUrl: obj.recordingUrl ?? null,
    transcription: obj.transcription ?? null,
    summary: obj.summary ?? null,
    createdAt: obj.createdAt instanceof Date ? obj.createdAt : new Date(String(obj.createdAt)),
  });
}

export function mapToCallScoringDTO(raw: unknown): CallScoringDTO {
  if (!raw || typeof raw !== 'object') throw new Error('Invalid call scoring data');
  const obj = raw as Record<string, unknown>;
  return CallScoringDTOSchema.parse({
    id: obj.id,
    callId: obj.callId,
    agentId: obj.agentId ?? null,
    score: typeof obj.score === 'number' ? obj.score : 0,
    criteria: obj.criteria && typeof obj.criteria === 'object' ? obj.criteria : {},
    feedback: obj.feedback ?? null,
    createdAt: obj.createdAt instanceof Date ? obj.createdAt : new Date(String(obj.createdAt)),
  });
}

export function mapToSimulatedCallDTO(raw: unknown): SimulatedCallDTO {
  if (!raw || typeof raw !== 'object') throw new Error('Invalid simulated call data');
  const obj = raw as Record<string, unknown>;
  return SimulatedCallDTOSchema.parse({
    id: String(obj.id),
    tenantId: obj.tenantId,
    agentId: obj.agentId ?? null,
    scenarioName: obj.scenarioName ?? null,
    status: obj.status ?? "in_progress",
    duration: typeof obj.duration === 'number' ? obj.duration : 0,
    score: typeof obj.score === 'number' ? obj.score : 0,
    startedAt: obj.startedAt instanceof Date ? obj.startedAt : new Date(String(obj.startedAt)),
    completedAt: obj.completedAt instanceof Date ? obj.completedAt : null,
    createdAt: obj.createdAt instanceof Date ? obj.createdAt : new Date(String(obj.createdAt)),
  });
}

export function mapToAgentSwitchHistoryDTO(raw: unknown): AgentSwitchHistoryDTO {
  if (!raw || typeof raw !== 'object') throw new Error('Invalid agent switch history data');
  const obj = raw as Record<string, unknown>;
  return AgentSwitchHistoryDTOSchema.parse({
    id: obj.id,
    tenantId: obj.tenantId,
    userId: obj.userId ?? null,
    previousAgentType: obj.previousAgentType ?? null,
    newAgentType: obj.newAgentType ?? null,
    reason: obj.reason ?? null,
    createdAt: obj.createdAt instanceof Date ? obj.createdAt : new Date(String(obj.createdAt)),
  });
}
