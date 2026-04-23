/**
 * BLOC 1 — JSONB HISTORY & ANALYSIS TYPES & SCHEMAS
 * ────────────────────────────────────────────────────────
 * Validation stricte et mappers pour les structures d'historiques et d'analyses :
 * - conversationHistory (WhatsApp, Recruitment)
 * - cvParsedData (Extraction CV)
 * - matchingDetails (Matching Candidat/Offre)
 * - callTranscript (Transcriptions d'appels)
 * - interviewAnalysis (Notes et scores d'entretiens)
 */

import { z } from "zod";

// ============================================
// 1. CONVERSATION_HISTORY
// ============================================

export const ConversationMessageSchema = z.object({
  role: z.enum(["user", "assistant", "system", "tool"]),
  content: z.string().min(1),
  timestamp: z.string().or(z.date()).default(() => new Date().toISOString()),
  metadata: z.record(z.unknown()).optional(),
});

export const ConversationHistorySchema = z.array(ConversationMessageSchema).default([]);

export type ConversationMessage = z.infer<typeof ConversationMessageSchema>;
export type ConversationHistory = z.infer<typeof ConversationHistorySchema>;

export function validateConversationHistory(data: unknown): ConversationHistory {
  try {
    return ConversationHistorySchema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(`Invalid Conversation History: ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ')}`);
    }
    throw error;
  }
}

export function mapToConversationHistory(raw: unknown): ConversationHistory {
  if (!Array.isArray(raw)) return [];
  return raw.map(msg => {
    const m = msg as Record<string, unknown>;
    return {
      role: (typeof m.role === 'string' && ["user", "assistant", "system", "tool"].includes(m.role)) 
        ? m.role as ConversationMessage["role"] 
        : "user",
      content: typeof m.content === 'string' ? m.content : String(m.content || ""),
      timestamp: typeof m.timestamp === 'string' || m.timestamp instanceof Date 
        ? m.timestamp 
        : new Date().toISOString(),
      metadata: m.metadata && typeof m.metadata === 'object' ? m.metadata as Record<string, unknown> : undefined,
    };
  });
}

// ============================================
// 2. CV_PARSED_DATA
// ============================================

export const CVParsedDataSchema = z.object({
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
  yearsOfExperience: z.number().min(0).default(0),
  salary: z.string().optional(),
  availability: z.string().optional(),
  location: z.string().optional(),
  contactInfo: z.object({
    email: z.string().email().optional(),
    phone: z.string().optional(),
    linkedin: z.string().url().optional(),
  }).optional(),
}).strict();

export type CVParsedData = z.infer<typeof CVParsedDataSchema>;

export function validateCVParsedData(data: unknown): CVParsedData {
  return CVParsedDataSchema.parse(data);
}

export function mapToCVParsedData(raw: unknown): CVParsedData {
  if (!raw || typeof raw !== 'object') return CVParsedDataSchema.parse({});
  const obj = raw as Record<string, unknown>;
  return {
    skills: Array.isArray(obj.skills) ? obj.skills : [],
    experience: Array.isArray(obj.experience) ? obj.experience : [],
    education: Array.isArray(obj.education) ? obj.education : [],
    languages: Array.isArray(obj.languages) ? obj.languages : [],
    summary: typeof obj.summary === 'string' ? obj.summary : undefined,
    yearsOfExperience: typeof obj.yearsOfExperience === 'number' ? obj.yearsOfExperience : 0,
    salary: typeof obj.salary === 'string' ? obj.salary : undefined,
    availability: typeof obj.availability === 'string' ? obj.availability : undefined,
    location: typeof obj.location === 'string' ? obj.location : undefined,
    contactInfo: obj.contactInfo && typeof obj.contactInfo === 'object' ? obj.contactInfo as any : undefined,
  };
}

// ============================================
// 3. MATCHING_DETAILS
// ============================================

export const MatchingDetailsSchema = z.object({
  skillsMatch: z.number().min(0).max(100).default(0),
  experienceMatch: z.number().min(0).max(100).default(0),
  educationMatch: z.number().min(0).max(100).default(0),
  salaryMatch: z.number().min(0).max(100).default(0),
  overallFit: z.enum(["excellent", "good", "fair", "poor"]).default("fair"),
  strengths: z.array(z.string()).default([]),
  gaps: z.array(z.string()).default([]),
  recommendation: z.string().optional(),
}).strict();

export type MatchingDetails = z.infer<typeof MatchingDetailsSchema>;

export function validateMatchingDetails(data: unknown): MatchingDetails {
  return MatchingDetailsSchema.parse(data);
}

// ============================================
// 4. CALL_TRANSCRIPT
// ============================================

export const TranscriptEntrySchema = z.object({
  timestamp: z.number().min(0),
  speaker: z.string().min(1),
  text: z.string().min(1),
  sentiment: z.number().min(-1).max(1).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const CallTranscriptSchema = z.array(TranscriptEntrySchema).default([]);

export type TranscriptEntry = z.infer<typeof TranscriptEntrySchema>;
export type CallTranscript = z.infer<typeof CallTranscriptSchema>;

export function validateCallTranscript(data: unknown): CallTranscript {
  return CallTranscriptSchema.parse(data);
}

// ============================================
// 5. INTERVIEW_ANALYSIS (Notes JSON)
// ============================================

export const InterviewAnalysisV2Schema = z.object({
  globalScore: z.number().min(0).max(10).default(0),
  criteriaScores: z.record(z.object({
    score: z.number().min(0).max(10),
    comment: z.string().default(""),
    weight: z.number().min(0).default(1),
  })).default({}),
  behavioralAnalysis: z.object({
    emotions: z.array(z.string()).default([]),
    emotionTimeline: z.array(z.object({
      timestamp: z.number(),
      emotion: z.string(),
      intensity: z.number().min(0).max(1),
    })).default([]),
    coherenceScore: z.number().min(0).max(10).default(5),
    honestyScore: z.number().min(0).max(10).default(5),
    communicationScore: z.number().min(0).max(10).default(5),
  }).default({}),
  redFlags: z.array(z.string()).default([]),
  strengths: z.array(z.string()).default([]),
  weaknesses: z.array(z.string()).default([]),
  summary: z.string().optional(),
}).strict();

export type InterviewAnalysis = z.infer<typeof InterviewAnalysisV2Schema>;

export function validateInterviewAnalysis(data: unknown): InterviewAnalysis {
  return InterviewAnalysisV2Schema.parse(data);
}

// ============================================
// EXPORT SUMMARY
// ============================================

export const JSONB_HISTORY_VALIDATORS = {
  conversationHistory: validateConversationHistory,
  cvParsedData: validateCVParsedData,
  matchingDetails: validateMatchingDetails,
  callTranscript: validateCallTranscript,
  interviewAnalysis: validateInterviewAnalysis,
} as const;
