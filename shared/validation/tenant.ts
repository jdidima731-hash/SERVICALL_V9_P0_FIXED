import { z } from "zod";

/**
 * Zod Schemas for Tenant Module
 * Used for runtime validation of JSONB fields.
 */

export const EnabledCapabilitiesSchema = z.array(z.string()).default([]);

export const EnabledWorkflowsSchema = z.array(z.string()).default([]);

export const WorkflowStepSchema = z.object({
  id: z.string(),
  type: z.string(),
  config: z.record(z.any()).default({}),
  nextStepId: z.string().optional(),
});

export const WorkflowStepsSchema = z.array(WorkflowStepSchema).default([]);

export const AgentSwitchSettingsSchema = z.object({
  enableAutoSwitch: z.boolean().default(true),
  confidenceThreshold: z.number().default(0.7),
  transferToHumanOnFailure: z.boolean().default(true),
  preferredAgentId: z.number().optional(),
}).default({});

export const TenantBrandAIConfigSchema = z.object({
  tone: z.string().default("professional"),
  persona: z.string().default("assistant"),
  language: z.string().default("fr"),
  customInstructions: z.string().optional(),
}).default({});

export const TenantSettingsSchema = z.object({
  timezone: z.string().default("Europe/Paris"),
  currency: z.string().default("EUR"),
  notifications: z.object({
    email: z.boolean().default(true),
    sms: z.boolean().default(false),
  }).default({}),
}).default({});

export type EnabledCapabilities = z.infer<typeof EnabledCapabilitiesSchema>;
export type EnabledWorkflows = z.infer<typeof EnabledWorkflowsSchema>;
export type WorkflowSteps = z.infer<typeof WorkflowStepsSchema>;
export type AgentSwitchSettings = z.infer<typeof AgentSwitchSettingsSchema>;
export type TenantBrandAIConfig = z.infer<typeof TenantBrandAIConfigSchema>;
export type TenantSettings = z.infer<typeof TenantSettingsSchema>;
