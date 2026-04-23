import { z } from "zod";

/**
 * Zod Schemas for AI Module
 * Used for runtime validation of JSONB fields and AI responses.
 */

export const KeyFactsSchema = z.record(z.union([z.string(), z.number(), z.boolean(), z.array(z.string())])).default({});

export const RiskFactorsSchema = z.array(z.object({
  factor: z.string(),
  impact: z.enum(["low", "medium", "high"]),
  description: z.string().optional(),
})).default([]);

export const PredictiveFactorsSchema = z.record(z.union([z.string(), z.number(), z.boolean()])).default({});

export const AIMetadataSchema = z.record(z.any()).default({});

export type KeyFacts = z.infer<typeof KeyFactsSchema>;
export type RiskFactors = z.infer<typeof RiskFactorsSchema>;
export type PredictiveFactors = z.infer<typeof PredictiveFactorsSchema>;
export type AIMetadata = z.infer<typeof AIMetadataSchema>;
