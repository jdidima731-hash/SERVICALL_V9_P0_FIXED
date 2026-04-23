import { z } from "zod";

export const interviewSchema = z.object({
  id: z.number(),
  tenantId: z.number(),
  candidateName: z.string(),
  candidateEmail: z.string().nullable(),
  candidatePhone: z.string(),
  jobPosition: z.string(),
  status: z.string(),
  scheduledAt: z.string().nullable(),
  startedAt: z.string().nullable(),
  completedAt: z.string().nullable(),
  duration: z.number().nullable(),
  recordingUrl: z.string().nullable(),
  transcription: z.string().nullable(),
  summary: z.string().nullable(),
  notesJson: z.any().nullable(),
  recommendation: z.string().nullable(),
  employerDecision: z.string().nullable(),
  employerNotes: z.string().nullable(),
  businessType: z.string().nullable(),
  createdAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
});

export const paginatedInterviewSchema = z.object({
  data: z.array(interviewSchema),
  pagination: z.object({
    total: z.number(),
    page: z.number(),
    limit: z.number(),
    totalPages: z.number(),
  }),
});

export const recruitmentStatsSchema = z.object({
  total: z.number(),
  pending: z.number(),
  completed: z.number(),
  shortlisted: z.number(),
  rejected: z.number(),
  averageScore: z.number(),
});
