/**
 * BLOC 2 — USER DTOs (Data Transfer Objects)
 * ────────────────────────────────────────────────────────
 * DTOs pour les réponses API du domaine User.
 * Masquage des données sensibles (passwordHash, tokensValidAfter, etc.)
 */

import { z } from "zod";

// ============================================
// USER_PUBLIC DTO (Réponse API standard)
// ============================================

export const UserPublicDTOSchema = z.object({
  id: z.number().int(),
  name: z.string().nullable(),
  email: z.string().email().nullable(),
  role: z.enum(["owner", "superadmin", "admin", "manager", "agent", "agentIA", "user"]),
  isActive: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
}).strict();

export type UserPublicDTO = z.infer<typeof UserPublicDTOSchema>;

// ============================================
// USER_PROFILE DTO (Profil détaillé)
// ============================================

export const UserProfileDTOSchema = z.object({
  id: z.number().int(),
  name: z.string().nullable(),
  email: z.string().email().nullable(),
  role: z.enum(["owner", "superadmin", "admin", "manager", "agent", "agentIA", "user"]),
  isActive: z.boolean(),
  industry: z.string().nullable(),
  whatsappAiLanguage: z.string().nullable(),
  whatsappAiTone: z.string().nullable(),
  whatsappAiPersona: z.string().nullable(),
  isAvailableForTransfer: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
}).strict();

export type UserProfileDTO = z.infer<typeof UserProfileDTOSchema>;

// ============================================
// USER_AGENT DTO (Pour les appels/agents)
// ============================================

export const UserAgentDTOSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  email: z.string().email().nullable(),
  isAvailableForTransfer: z.boolean(),
  assignedAgentType: z.enum(["AI", "Human"]),
}).strict();

export type UserAgentDTO = z.infer<typeof UserAgentDTOSchema>;

// ============================================
// TENANT_USER DTO (Relation Tenant-User)
// ============================================

export const TenantUserDTOSchema = z.object({
  userId: z.number().int(),
  tenantId: z.number().int(),
  role: z.string(),
  isActive: z.boolean(),
  user: UserPublicDTOSchema,
}).strict();

export type TenantUserDTO = z.infer<typeof TenantUserDTOSchema>;

// ============================================
// MAPPERS
// ============================================

export function mapToUserPublicDTO(raw: unknown): UserPublicDTO {
  if (!raw || typeof raw !== 'object') throw new Error('Invalid user data');
  const obj = raw as Record<string, unknown>;
  return UserPublicDTOSchema.parse({
    id: obj.id,
    name: obj.name ?? null,
    email: obj.email ?? null,
    role: obj.role ?? "user",
    isActive: obj.isActive ?? true,
    createdAt: obj.createdAt instanceof Date ? obj.createdAt : new Date(String(obj.createdAt)),
    updatedAt: obj.updatedAt instanceof Date ? obj.updatedAt : new Date(String(obj.updatedAt)),
  });
}

export function mapToUserProfileDTO(raw: unknown): UserProfileDTO {
  if (!raw || typeof raw !== 'object') throw new Error('Invalid user profile data');
  const obj = raw as Record<string, unknown>;
  return UserProfileDTOSchema.parse({
    id: obj.id,
    name: obj.name ?? null,
    email: obj.email ?? null,
    role: obj.role ?? "user",
    isActive: obj.isActive ?? true,
    industry: obj.industry ?? null,
    whatsappAiLanguage: obj.whatsappAiLanguage ?? null,
    whatsappAiTone: obj.whatsappAiTone ?? null,
    whatsappAiPersona: obj.whatsappAiPersona ?? null,
    isAvailableForTransfer: obj.isAvailableForTransfer ?? true,
    createdAt: obj.createdAt instanceof Date ? obj.createdAt : new Date(String(obj.createdAt)),
    updatedAt: obj.updatedAt instanceof Date ? obj.updatedAt : new Date(String(obj.updatedAt)),
  });
}

export function mapToUserAgentDTO(raw: unknown): UserAgentDTO {
  if (!raw || typeof raw !== 'object') throw new Error('Invalid user agent data');
  const obj = raw as Record<string, unknown>;
  return UserAgentDTOSchema.parse({
    id: obj.id,
    name: String(obj.name || ""),
    email: obj.email ?? null,
    isAvailableForTransfer: obj.isAvailableForTransfer ?? true,
    assignedAgentType: obj.assignedAgentType === "Human" ? "Human" : "AI",
  });
}

export function mapToTenantUserDTO(raw: unknown, user: unknown): TenantUserDTO {
  if (!raw || typeof raw !== 'object') throw new Error('Invalid tenant user data');
  const obj = raw as Record<string, unknown>;
  return TenantUserDTOSchema.parse({
    userId: obj.userId,
    tenantId: obj.tenantId,
    role: obj.role ?? "agent",
    isActive: obj.isActive ?? true,
    user: mapToUserPublicDTO(user),
  });
}
