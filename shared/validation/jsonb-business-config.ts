/**
 * BLOC 1 — JSONB BUSINESS CONFIG TYPES & SCHEMAS
 * ────────────────────────────────────────────────────────
 * Validation stricte et mappers pour les configurations métier :
 * - posConfig (Point of Sale)
 * - triggerConfig (Workflow Triggers)
 * - agentSwitchSettings (Agent Handover)
 * - billingConfig (Billing Logic)
 */

import { z } from "zod";

// ============================================
// 1. POS_CONFIG (Point of Sale)
// ============================================

export const POSConfigSchema = z.object({
  provider: z.enum(["none", "clover", "square", "shopify", "custom"]).default("none"),
  apiKey: z.string().optional(),
  accessToken: z.string().optional(),
  clientId: z.string().optional(),
  clientSecret: z.string().optional(),
  merchantId: z.string().optional(),
  apiUrl: z.string().url().optional(),
  syncEnabled: z.boolean().default(false),
  lastSyncAt: z.date().optional(),
  options: z.record(z.unknown()).default({}),
}).strict();

export type POSConfig = z.infer<typeof POSConfigSchema>;

export function validatePOSConfig(data: unknown): POSConfig {
  try {
    return POSConfigSchema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(`Invalid POS Config: ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ')}`);
    }
    throw error;
  }
}

export function mapToPOSConfig(raw: unknown): POSConfig {
  if (!raw || typeof raw !== 'object') {
    return POSConfigSchema.parse({});
  }
  const obj = raw as Record<string, unknown>;
  return validatePOSConfig({
    provider: typeof obj.provider === 'string' ? obj.provider : "none",
    apiKey: typeof obj.apiKey === 'string' ? obj.apiKey : undefined,
    accessToken: typeof obj.accessToken === 'string' ? obj.accessToken : undefined,
    clientId: typeof obj.clientId === 'string' ? obj.clientId : undefined,
    clientSecret: typeof obj.clientSecret === 'string' ? obj.clientSecret : undefined,
    merchantId: typeof obj.merchantId === 'string' ? obj.merchantId : undefined,
    apiUrl: typeof obj.apiUrl === 'string' ? obj.apiUrl : undefined,
    syncEnabled: typeof obj.syncEnabled === 'boolean' ? obj.syncEnabled : false,
    lastSyncAt: obj.lastSyncAt instanceof Date ? obj.lastSyncAt : undefined,
    options: obj.options && typeof obj.options === 'object' ? obj.options : {},
  });
}

// ============================================
// 2. TRIGGER_CONFIG (Workflow Triggers)
// ============================================

export const TriggerConfigSchema = z.object({
  type: z.enum(["manual", "webhook", "schedule", "event", "api"]).default("manual"),
  webhookUrl: z.string().url().optional(),
  cronExpression: z.string().optional(),
  eventName: z.string().optional(),
  conditions: z.array(z.object({
    field: z.string(),
    operator: z.enum(["eq", "neq", "gt", "lt", "contains", "regex"]),
    value: z.unknown(),
  })).default([]),
  retryPolicy: z.object({
    maxRetries: z.number().int().min(0).default(3),
    backoffRate: z.number().min(1).default(2),
  }).optional(),
  isActive: z.boolean().default(true),
}).strict();

export type TriggerConfig = z.infer<typeof TriggerConfigSchema>;

export function validateTriggerConfig(data: unknown): TriggerConfig {
  try {
    return TriggerConfigSchema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(`Invalid Trigger Config: ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ')}`);
    }
    throw error;
  }
}

export function mapToTriggerConfig(raw: unknown): TriggerConfig {
  if (!raw || typeof raw !== 'object') {
    return TriggerConfigSchema.parse({});
  }
  const obj = raw as Record<string, unknown>;
  return validateTriggerConfig({
    type: typeof obj.type === 'string' ? obj.type : "manual",
    webhookUrl: typeof obj.webhookUrl === 'string' ? obj.webhookUrl : undefined,
    cronExpression: typeof obj.cronExpression === 'string' ? obj.cronExpression : undefined,
    eventName: typeof obj.eventName === 'string' ? obj.eventName : undefined,
    conditions: Array.isArray(obj.conditions) ? obj.conditions : [],
    retryPolicy: obj.retryPolicy && typeof obj.retryPolicy === 'object' ? obj.retryPolicy : undefined,
    isActive: typeof obj.isActive === 'boolean' ? obj.isActive : true,
  });
}

// ============================================
// 3. AGENT_SWITCH_SETTINGS (Agent Handover)
// ============================================

export const AgentSwitchSettingsV2Schema = z.object({
  enableAutoSwitch: z.boolean().default(true),
  confidenceThreshold: z.number().min(0).max(1).default(0.7),
  transferToHumanOnFailure: z.boolean().default(true),
  preferredAgentId: z.number().int().optional(),
  fallbackAgentId: z.number().int().optional(),
  escalationRules: z.array(z.object({
    trigger: z.string(),
    targetAgentId: z.number().int(),
    priority: z.number().int().default(1),
  })).default([]),
  timeoutSeconds: z.number().int().min(0).default(30),
}).strict();

export type AgentSwitchSettings = z.infer<typeof AgentSwitchSettingsV2Schema>;

export function validateAgentSwitchSettings(data: unknown): AgentSwitchSettings {
  try {
    return AgentSwitchSettingsV2Schema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(`Invalid Agent Switch Settings: ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ')}`);
    }
    throw error;
  }
}

export function mapToAgentSwitchSettings(raw: unknown): AgentSwitchSettings {
  if (!raw || typeof raw !== 'object') {
    return AgentSwitchSettingsV2Schema.parse({});
  }
  const obj = raw as Record<string, unknown>;
  return validateAgentSwitchSettings({
    enableAutoSwitch: typeof obj.enableAutoSwitch === 'boolean' ? obj.enableAutoSwitch : true,
    confidenceThreshold: typeof obj.confidenceThreshold === 'number' ? obj.confidenceThreshold : 0.7,
    transferToHumanOnFailure: typeof obj.transferToHumanOnFailure === 'boolean' ? obj.transferToHumanOnFailure : true,
    preferredAgentId: typeof obj.preferredAgentId === 'number' ? obj.preferredAgentId : undefined,
    fallbackAgentId: typeof obj.fallbackAgentId === 'number' ? obj.fallbackAgentId : undefined,
    escalationRules: Array.isArray(obj.escalationRules) ? obj.escalationRules : [],
    timeoutSeconds: typeof obj.timeoutSeconds === 'number' ? obj.timeoutSeconds : 30,
  });
}

// ============================================
// 4. BILLING_CONFIG (Billing Logic)
// ============================================

export const BillingConfigSchema = z.object({
  plan: z.enum(["free", "starter", "professional", "enterprise"]).default("free"),
  billingCycle: z.enum(["monthly", "yearly"]).default("monthly"),
  autoRenew: z.boolean().default(true),
  taxId: z.string().optional(),
  vatExempt: z.boolean().default(false),
  paymentMethodId: z.string().optional(),
  limits: z.object({
    maxUsers: z.number().int().min(1).default(1),
    maxWorkflows: z.number().int().min(0).default(5),
    maxStorageGb: z.number().int().min(0).default(1),
  }).default({}),
  customPricing: z.record(z.number()).optional(),
}).strict();

export type BillingConfig = z.infer<typeof BillingConfigSchema>;

export function validateBillingConfig(data: unknown): BillingConfig {
  try {
    return BillingConfigSchema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(`Invalid Billing Config: ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ')}`);
    }
    throw error;
  }
}

export function mapToBillingConfig(raw: unknown): BillingConfig {
  if (!raw || typeof raw !== 'object') {
    return BillingConfigSchema.parse({});
  }
  const obj = raw as Record<string, unknown>;
  return validateBillingConfig({
    plan: typeof obj.plan === 'string' ? obj.plan : "free",
    billingCycle: typeof obj.billingCycle === 'string' ? obj.billingCycle : "monthly",
    autoRenew: typeof obj.autoRenew === 'boolean' ? obj.autoRenew : true,
    taxId: typeof obj.taxId === 'string' ? obj.taxId : undefined,
    vatExempt: typeof obj.vatExempt === 'boolean' ? obj.vatExempt : false,
    paymentMethodId: typeof obj.paymentMethodId === 'string' ? obj.paymentMethodId : undefined,
    limits: obj.limits && typeof obj.limits === 'object' ? obj.limits : {},
    customPricing: obj.customPricing && typeof obj.customPricing === 'object' ? obj.customPricing : undefined,
  });
}

// ============================================
// EXPORT SUMMARY
// ============================================

export const JSONB_BUSINESS_VALIDATORS = {
  posConfig: validatePOSConfig,
  triggerConfig: validateTriggerConfig,
  agentSwitchSettings: validateAgentSwitchSettings,
  billingConfig: validateBillingConfig,
} as const;

export const JSONB_BUSINESS_MAPPERS = {
  posConfig: mapToPOSConfig,
  triggerConfig: mapToTriggerConfig,
  agentSwitchSettings: mapToAgentSwitchSettings,
  billingConfig: mapToBillingConfig,
} as const;
