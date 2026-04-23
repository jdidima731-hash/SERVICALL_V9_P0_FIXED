/**
 * BLOC 2 — TENANT DTOs (Data Transfer Objects)
 * ────────────────────────────────────────────────────────
 * DTOs pour les réponses API du domaine Tenant.
 * Découplage complet entre la base de données (Drizzle) et les réponses API.
 */

import { z } from "zod";

// ============================================
// TENANT DTO
// ============================================

export const TenantDTOSchema = z.object({
  id: z.number().int(),
  slug: z.string(),
  name: z.string(),
  domain: z.string().optional(),
  businessType: z.string().optional(),
  isActive: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
}).strict();

export type TenantDTO = z.infer<typeof TenantDTOSchema>;

// ============================================
// TENANT_SETTINGS DTO
// ============================================

export const TenantSettingsDTOSchema = z.object({
  tenantId: z.number().int(),
  aiAutomationRate: z.number().int().min(0).max(100),
  escalationThreshold: z.number().int().min(0).max(100),
  updatedAt: z.date(),
}).strict();

export type TenantSettingsDTO = z.infer<typeof TenantSettingsDTOSchema>;

// ============================================
// TENANT_INDUSTRY_CONFIG DTO
// ============================================

export const TenantIndustryConfigDTOSchema = z.object({
  tenantId: z.number().int(),
  industryId: z.string(),
  enabledCapabilities: z.array(z.string()).default([]),
  enabledWorkflows: z.array(z.string()).default([]),
  createdAt: z.date(),
  updatedAt: z.date(),
}).strict();

export type TenantIndustryConfigDTO = z.infer<typeof TenantIndustryConfigDTOSchema>;

// ============================================
// TENANT_PROFILE DTO (Agrégé)
// ============================================

export const TenantProfileDTOSchema = z.object({
  tenant: TenantDTOSchema,
  settings: TenantSettingsDTOSchema.optional(),
  industryConfig: TenantIndustryConfigDTOSchema.optional(),
}).strict();

export type TenantProfileDTO = z.infer<typeof TenantProfileDTOSchema>;

// ============================================
// MAPPERS
// ============================================

export function mapToTenantDTO(raw: unknown): TenantDTO {
  if (!raw || typeof raw !== 'object') throw new Error('Invalid tenant data');
  const obj = raw as Record<string, unknown>;
  return TenantDTOSchema.parse({
    id: obj.id,
    slug: obj.slug,
    name: obj.name,
    domain: obj.domain,
    businessType: obj.businessType,
    isActive: obj.isActive ?? true,
    createdAt: obj.createdAt instanceof Date ? obj.createdAt : new Date(String(obj.createdAt)),
    updatedAt: obj.updatedAt instanceof Date ? obj.updatedAt : new Date(String(obj.updatedAt)),
  });
}

export function mapToTenantSettingsDTO(raw: unknown): TenantSettingsDTO {
  if (!raw || typeof raw !== 'object') throw new Error('Invalid tenant settings data');
  const obj = raw as Record<string, unknown>;
  return TenantSettingsDTOSchema.parse({
    tenantId: obj.tenantId,
    aiAutomationRate: obj.aiAutomationRate ?? 80,
    escalationThreshold: obj.escalationThreshold ?? 50,
    updatedAt: obj.updatedAt instanceof Date ? obj.updatedAt : new Date(String(obj.updatedAt)),
  });
}

export function mapToTenantIndustryConfigDTO(raw: unknown): TenantIndustryConfigDTO {
  if (!raw || typeof raw !== 'object') throw new Error('Invalid tenant industry config data');
  const obj = raw as Record<string, unknown>;
  return TenantIndustryConfigDTOSchema.parse({
    tenantId: obj.tenantId,
    industryId: obj.industryId,
    enabledCapabilities: Array.isArray(obj.enabledCapabilities) ? obj.enabledCapabilities : [],
    enabledWorkflows: Array.isArray(obj.enabledWorkflows) ? obj.enabledWorkflows : [],
    createdAt: obj.createdAt instanceof Date ? obj.createdAt : new Date(String(obj.createdAt)),
    updatedAt: obj.updatedAt instanceof Date ? obj.updatedAt : new Date(String(obj.updatedAt)),
  });
}

export function mapToTenantProfileDTO(
  tenant: unknown,
  settings?: unknown,
  industryConfig?: unknown
): TenantProfileDTO {
  return TenantProfileDTOSchema.parse({
    tenant: mapToTenantDTO(tenant),
    settings: settings ? mapToTenantSettingsDTO(settings) : undefined,
    industryConfig: industryConfig ? mapToTenantIndustryConfigDTO(industryConfig) : undefined,
  });
}
