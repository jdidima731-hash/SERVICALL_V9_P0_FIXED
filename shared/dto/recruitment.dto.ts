/**
 * BLOC 2 — RECRUITMENT DTOs (Data Transfer Objects)
 * ────────────────────────────────────────────────────────
 * DTOs pour les réponses API du domaine Recruitment.
 * Masquage des données sensibles (PII) et abstraction des structures internes.
 */

import { z } from "zod";
import { CVParsedDataSchema } from "../validation/jsonb-history-analysis";
import { MatchingDetailsSchema } from "../validation/jsonb-history-analysis";

// ============================================
// CANDIDATE DTO (Public)
// ============================================

export const CandidateDTOSchema = z.object({
  id: z.number().int(),
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
  email: z.string().email().nullable(), // Masqué en production
  phone: z.string().nullable(), // Masqué en production
  company: z.string().nullable(),
  jobTitle: z.string().nullable(),
  source: z.string().nullable(),
  status: z.enum(["new", "contacted", "qualified", "rejected", "hired"]),
  yearsOfExperience: z.number().int().min(0).nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
}).strict();

export type CandidateDTO = z.infer<typeof CandidateDTOSchema>;

// ============================================
// CANDIDATE_INTERVIEW DTO
// ============================================

export const CandidateInterviewDTOSchema = z.object({
  id: z.number().int(),
  candidateId: z.number().int(),
  jobOfferId: z.number().int().nullable(),
  status: z.enum(["pending", "scheduled", "in_progress", "completed", "cancelled"]),
  matchingScore: z.number().min(0).max(100).nullable(),
  matchingDetails: MatchingDetailsSchema.optional(),
  globalScore: z.number().min(0).max(10).nullable(),
  aiRecommendation: z.enum(["hire", "maybe", "reject"]).nullable(),
  duration: z.number().int().min(0).nullable(),
  scheduledAt: z.date().nullable(),
  completedAt: z.date().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
}).strict();

export type CandidateInterviewDTO = z.infer<typeof CandidateInterviewDTOSchema>;

// ============================================
// JOB_OFFER DTO
// ============================================

export const JobOfferDTOSchema = z.object({
  id: z.number().int(),
  tenantId: z.number().int(),
  title: z.string(),
  description: z.string().nullable(),
  status: z.enum(["draft", "published", "closed"]),
  createdAt: z.date(),
  updatedAt: z.date(),
}).strict();

export type JobOfferDTO = z.infer<typeof JobOfferDTOSchema>;

// ============================================
// JOB_REQUIREMENT DTO
// ============================================

export const JobRequirementDTOSchema = z.object({
  id: z.number().int(),
  jobOfferId: z.number().int(),
  title: z.string(),
  status: z.enum(["active", "archived"]),
  createdAt: z.date(),
  updatedAt: z.date(),
}).strict();

export type JobRequirementDTO = z.infer<typeof JobRequirementDTOSchema>;

// ============================================
// MAPPERS
// ============================================

export function mapToCandidateDTO(raw: unknown): CandidateDTO {
  if (!raw || typeof raw !== 'object') throw new Error('Invalid candidate data');
  const obj = raw as Record<string, unknown>;
  return CandidateDTOSchema.parse({
    id: obj.id,
    firstName: obj.firstName ?? null,
    lastName: obj.lastName ?? null,
    email: obj.email ?? null,
    phone: obj.phone ?? null,
    company: obj.company ?? null,
    jobTitle: obj.jobTitle ?? null,
    source: obj.source ?? null,
    status: obj.status ?? "new",
    yearsOfExperience: obj.yearsOfExperience ?? null,
    createdAt: obj.createdAt instanceof Date ? obj.createdAt : new Date(String(obj.createdAt)),
    updatedAt: obj.updatedAt instanceof Date ? obj.updatedAt : new Date(String(obj.updatedAt)),
  });
}

export function mapToCandidateInterviewDTO(raw: unknown): CandidateInterviewDTO {
  if (!raw || typeof raw !== 'object') throw new Error('Invalid candidate interview data');
  const obj = raw as Record<string, unknown>;
  return CandidateInterviewDTOSchema.parse({
    id: obj.id,
    candidateId: obj.candidateId,
    jobOfferId: obj.jobOfferId ?? null,
    status: obj.status ?? "pending",
    matchingScore: typeof obj.matchingScore === 'number' ? obj.matchingScore : null,
    matchingDetails: obj.matchingDetails && typeof obj.matchingDetails === 'object' ? obj.matchingDetails : undefined,
    globalScore: typeof obj.globalScore === 'number' ? obj.globalScore : null,
    aiRecommendation: obj.aiRecommendation ?? null,
    duration: typeof obj.duration === 'number' ? obj.duration : null,
    scheduledAt: obj.scheduledAt instanceof Date ? obj.scheduledAt : null,
    completedAt: obj.completedAt instanceof Date ? obj.completedAt : null,
    createdAt: obj.createdAt instanceof Date ? obj.createdAt : new Date(String(obj.createdAt)),
    updatedAt: obj.updatedAt instanceof Date ? obj.updatedAt : new Date(String(obj.updatedAt)),
  });
}

export function mapToJobOfferDTO(raw: unknown): JobOfferDTO {
  if (!raw || typeof raw !== 'object') throw new Error('Invalid job offer data');
  const obj = raw as Record<string, unknown>;
  return JobOfferDTOSchema.parse({
    id: obj.id,
    tenantId: obj.tenantId,
    title: obj.title,
    description: obj.description ?? null,
    status: obj.status ?? "draft",
    createdAt: obj.createdAt instanceof Date ? obj.createdAt : new Date(String(obj.createdAt)),
    updatedAt: obj.updatedAt instanceof Date ? obj.updatedAt : new Date(String(obj.updatedAt)),
  });
}

export function mapToJobRequirementDTO(raw: unknown): JobRequirementDTO {
  if (!raw || typeof raw !== 'object') throw new Error('Invalid job requirement data');
  const obj = raw as Record<string, unknown>;
  return JobRequirementDTOSchema.parse({
    id: obj.id,
    jobOfferId: obj.jobOfferId,
    title: obj.title,
    status: obj.status ?? "active",
    createdAt: obj.createdAt instanceof Date ? obj.createdAt : new Date(String(obj.createdAt)),
    updatedAt: obj.updatedAt instanceof Date ? obj.updatedAt : new Date(String(obj.updatedAt)),
  });
}
