import { z } from 'zod';

/**
 * Schémas Zod Communs et Réutilisables
 * 
 * Ces schémas définissent les types de base et les validations communes
 * utilisées à travers l'application.
 */

// ============================================
// TYPES DE BASE
// ============================================

export const IdSchema = z.number().int().positive('L\'ID doit être un nombre positif');

export const TenantIdSchema = z.number().int().positive('L\'ID du tenant doit être un nombre positif');

export const EmailSchema = z.string().email('Email invalide').toLowerCase();

export const PhoneSchema = z.string().regex(/^\+?[0-9\s\-()]{7,}$/, 'Numéro de téléphone invalide').optional().nullable();

export const UrlSchema = z.string().url('URL invalide');

export const DateSchema = z.date().or(z.string().datetime());

export const JsonSchema = z.record(z.unknown());

// ============================================
// PAGINATION ET FILTRAGE
// ============================================

export const PaginationSchema = z.object({
  page: z.number().int().positive('La page doit être un nombre positif').default(1),
  limit: z.number().int().min(1).max(100).default(20),
});

export const SortOrderSchema = z.enum(['asc', 'desc']).default('asc');

export const FilterBaseSchema = z.object({
  search: z.string().optional(),
  sortBy: z.string().optional(),
  sortOrder: SortOrderSchema,
  ...PaginationSchema.shape,
});

// ============================================
// RÉPONSES STANDARDISÉES
// ============================================

export const SuccessResponseSchema = z.object({
  success: z.literal(true),
  data: z.unknown(),
  message: z.string().optional(),
});

export const ErrorResponseSchema = z.object({
  success: z.literal(false),
  error: z.string(),
  code: z.string().optional(),
  details: z.unknown().optional(),
});

export const PaginatedResponseSchema = z.object({
  data: z.array(z.unknown()),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  limit: z.number().int().positive(),
  pages: z.number().int().nonnegative(),
});

// ============================================
// ÉNUMÉRATIONS
// ============================================

export const RoleEnum = z.enum(['owner', 'superadmin', 'admin', 'manager', 'agent', 'agentIA', 'user']);

export const StatusEnum = z.enum(['new', 'contacted', 'qualified', 'converted', 'lost']);

export const CallTypeEnum = z.enum(['inbound', 'outbound']);

export const OutcomeEnum = z.enum(['success', 'no_answer', 'voicemail', 'busy', 'failed']);

export const TriggerTypeEnum = z.enum(['manual', 'scheduled', 'event']);

export const PlanEnum = z.enum(['free', 'starter', 'professional', 'enterprise']);

export const PriorityEnum = z.enum(['low', 'medium', 'high', 'urgent']);

export const SeverityEnum = z.enum(['low', 'medium', 'high', 'critical']);

// ============================================
// TYPES GÉNÉRÉS
// ============================================

export type Id = z.infer<typeof IdSchema>;
export type TenantId = z.infer<typeof TenantIdSchema>;
export type Email = z.infer<typeof EmailSchema>;
export type Phone = z.infer<typeof PhoneSchema>;
export type Role = z.infer<typeof RoleEnum>;
export type Status = z.infer<typeof StatusEnum>;
export type Priority = z.infer<typeof PriorityEnum>;

export type Pagination = z.infer<typeof PaginationSchema>;
export type FilterBase = z.infer<typeof FilterBaseSchema>;
export type SuccessResponse = z.infer<typeof SuccessResponseSchema>;
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;
export type PaginatedResponse = z.infer<typeof PaginatedResponseSchema>;
