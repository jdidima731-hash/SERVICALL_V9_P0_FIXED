import { z } from "zod";

/**
 * Zod Schemas for Recruitment Module
 * Used for runtime validation of JSONB fields and AI responses.
 */

export const CVParseResultSchema = z.object({
  skills: z.array(z.string()).default([]),
  experience: z.array(z.object({
    title: z.string(),
    company: z.string(),
    duration: z.string(),
    description: z.string().optional(),
  })).default([]),
  education: z.array(z.object({
    degree: z.string(),
    institution: z.string(),
    year: z.string().optional(),
  })).default([]),
  languages: z.array(z.string()).default([]),
  summary: z.string().optional(),
  yearsOfExperience: z.number().optional(),
  salary: z.string().optional(),
  availability: z.string().optional(),
  location: z.string().optional(),
});

export const AIGeneratedProfileSchema = z.object({
  requiredSkills: z.array(z.string()).default([]),
  preferredSkills: z.array(z.string()).default([]),
  minExperience: z.number().default(0),
  educationLevel: z.string().default("Non spécifié"),
  personalityTraits: z.array(z.string()).default([]),
  dealBreakers: z.array(z.string()).default([]),
  salaryRange: z.string().optional(),
  contractType: z.string().optional(),
  workMode: z.string().optional(),
  keywords: z.array(z.string()).default([]),
  scoringCriteria: z.array(z.object({
    criterion: z.string(),
    weight: z.number(),
    description: z.string(),
  })).default([]),
});

export const InterviewAnalysisSchema = z.object({
  globalScore: z.number().min(0).max(10),
  criteriaScores: z.record(z.object({
    score: z.number().min(0).max(10),
    comment: z.string(),
    weight: z.number(),
  })),
  behavioralAnalysis: z.object({
    emotions: z.array(z.string()),
    emotionTimeline: z.array(z.object({
      timestamp: z.number(),
      emotion: z.string(),
      intensity: z.number(),
    })),
    coherenceScore: z.number().min(0).max(10),
    honestyScore: z.number().min(0).max(10),
    communicationScore: z.number().min(0).max(10),
  }),
  redFlags: z.array(z.string()),
  strengths: z.array(z.string()),
});

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
  notesJson: InterviewAnalysisSchema.nullable(),
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

export type Interview = z.infer<typeof interviewSchema>;
export type RecruitmentStats = z.infer<typeof recruitmentStatsSchema>;
export type CVParseResult = z.infer<typeof CVParseResultSchema>;
export type AIGeneratedProfile = z.infer<typeof AIGeneratedProfileSchema>;
export type InterviewAnalysis = z.infer<typeof InterviewAnalysisSchema>;
