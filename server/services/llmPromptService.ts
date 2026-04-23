/**
 * LLM Prompt Service - Gestion des prompts LLM externalisés
 */

import { logger } from "../infrastructure/logger";

export interface LLMPrompt {
  id: string;
  tenantId?: number;
  name: string;
  category: string;
  prompt: string;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

// Default prompts - À remplacer par une table dans la base de données
const DEFAULT_PROMPTS: Record<string, LLMPrompt> = {
  "call-qualification": {
    id: "call-qualification",
    name: "Call Qualification",
    category: "call",
    prompt: `Analyze the following call transcript and determine if the prospect is qualified.
Respond with a JSON object containing:
- isQualified: boolean
- confidence: number (0-100)
- reasons: string[]
- nextSteps: string[]

Transcript:
{{transcript}}`,
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  "call-summary": {
    id: "call-summary",
    name: "Call Summary",
    category: "call",
    prompt: `Summarize the following call transcript in a concise manner.
Include:
- Main topics discussed
- Key decisions made
- Action items
- Follow-up required

Transcript:
{{transcript}}`,
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  "sentiment-analysis": {
    id: "sentiment-analysis",
    name: "Sentiment Analysis",
    category: "analysis",
    prompt: `Analyze the sentiment of the following text.
Respond with:
- sentiment: 'positive' | 'neutral' | 'negative'
- score: number (-1 to 1)
- explanation: string

Text:
{{text}}`,
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  "email-draft": {
    id: "email-draft",
    name: "Email Draft",
    category: "communication",
    prompt: `Draft a professional email based on the following context:
Recipient: {{recipientName}}
Subject: {{subject}}
Context: {{context}}

Requirements:
- Professional tone
- Concise and clear
- Call to action
- Personalized`,
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
};

/**
 * Get a prompt by ID
 */
export async function getPrompt(
  promptId: string,
  _tenantId?: number
): Promise<LLMPrompt | null> {
  // In production, query the database
  // For now, return default prompts
  const prompt = DEFAULT_PROMPTS[promptId];

  if (!prompt) {
    logger.warn(`[LLM Prompt Service] Prompt not found: ${promptId}`);
    return null;
  }

  return prompt;
}

/**
 * Get all prompts for a category
 */
export async function getPromptsByCategory(
  category: string,
  _tenantId?: number
): Promise<LLMPrompt[]> {
  return Object.values(DEFAULT_PROMPTS).filter((p: any) => p.category === category);
}

/**
 * Interpolate variables in a prompt
 */
export function interpolatePrompt(
  prompt: string,
  variables: Record<string, any>
): string {
  let result = prompt;

  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`{{${key}}}`, "g");
    result = result.replace(regex, String(value ?? ""));
  }

  return result;
}

/**
 * Get and interpolate a prompt
 */
export async function getAndInterpolatePrompt(
  promptId: string,
  variables: Record<string, any>,
  tenantId?: number
): Promise<string | null> {
  const prompt = await getPrompt(promptId, tenantId);

  if (!prompt) {
    return null;
  }

  return interpolatePrompt(prompt.prompt, variables);
}

/**
 * Create or update a custom prompt for a tenant
 */
export async function saveCustomPrompt(
  tenantId: number,
  promptId: string,
  name: string,
  category: string,
  prompt: string
): Promise<LLMPrompt> {
  // In production, save to database
  const customPrompt: LLMPrompt = {
    id: promptId,
    tenantId,
    name,
    category,
    prompt,
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  logger.info(`[LLM Prompt Service] Saved custom prompt: ${promptId} for tenant ${tenantId}`);
  return customPrompt;
}

/**
 * Delete a custom prompt
 */
export async function deleteCustomPrompt(
  tenantId: number,
  promptId: string
): Promise<void> {
  // In production, delete from database
  logger.info(`[LLM Prompt Service] Deleted custom prompt: ${promptId} for tenant ${tenantId}`);
}
