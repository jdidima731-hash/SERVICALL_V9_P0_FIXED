import { z } from 'zod';
import { IdSchema, TenantIdSchema, EmailSchema, PhoneSchema, DateSchema, StatusEnum, PriorityEnum } from './common';

/**
 * Schémas Zod pour le CRM
 * 
 * Définit les types pour les prospects, leads, contacts et les opérations CRM.
 */

// ============================================
// PROSPECTS
// ============================================

export const ProspectBaseSchema = z.object({
  id: IdSchema,
  tenantId: TenantIdSchema,
  firstName: z.string().min(1, 'Prénom requis'),
  lastName: z.string().min(1, 'Nom requis'),
  email: EmailSchema.optional().nullable(),
  phone: PhoneSchema,
  company: z.string().optional().nullable(),
  status: StatusEnum.default('new'),
  source: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  metadata: z.record(z.unknown()).optional().nullable(),
  createdAt: DateSchema.optional().nullable(),
  updatedAt: DateSchema.optional().nullable(),
});

export const ProspectCreateSchema = z.object({
  firstName: z.string().min(1, 'Prénom requis'),
  lastName: z.string().min(1, 'Nom requis'),
  email: EmailSchema.optional(),
  phone: PhoneSchema,
  company: z.string().optional(),
  status: StatusEnum.optional(),
  source: z.string().optional(),
  notes: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const ProspectUpdateSchema = z.object({
  firstName: z.string().min(1, 'Prénom requis').optional(),
  lastName: z.string().min(1, 'Nom requis').optional(),
  email: EmailSchema.optional(),
  phone: PhoneSchema,
  company: z.string().optional(),
  status: StatusEnum.optional(),
  source: z.string().optional(),
  notes: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const ProspectIdSchema = z.object({
  prospectId: IdSchema,
});

export const ProspectSchema = ProspectBaseSchema;

// ============================================
// APPOINTMENTS
// ============================================

export const AppointmentBaseSchema = z.object({
  id: IdSchema,
  tenantId: TenantIdSchema,
  prospectId: IdSchema.optional(),
  title: z.string().min(1, 'Titre requis'),
  description: z.string().optional().nullable(),
  startTime: DateSchema,
  endTime: DateSchema,
  status: z.enum(['scheduled', 'completed', 'cancelled']).default('scheduled'),
  location: z.string().optional().nullable(),
  metadata: z.record(z.unknown()).optional().nullable(),
  createdAt: DateSchema.optional().nullable(),
  updatedAt: DateSchema.optional().nullable(),
});

export const AppointmentCreateSchema = z.object({
  prospectId: IdSchema.optional(),
  title: z.string().min(1, 'Titre requis'),
  description: z.string().optional(),
  startTime: DateSchema,
  endTime: DateSchema,
  location: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
}).refine(
  (data) => new Date(data.endTime) > new Date(data.startTime),
  {
    message: 'La date de fin doit être après la date de début',
    path: ['endTime'],
  }
);

export const AppointmentUpdateSchema = z.object({
  title: z.string().min(1, 'Titre requis').optional(),
  description: z.string().optional(),
  startTime: DateSchema.optional(),
  endTime: DateSchema.optional(),
  status: z.enum(['scheduled', 'completed', 'cancelled']).optional(),
  location: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const AppointmentIdSchema = z.object({
  appointmentId: IdSchema,
});

export const AppointmentSchema = AppointmentBaseSchema;

// ============================================
// INTERACTIONS
// ============================================

export const InteractionBaseSchema = z.object({
  id: IdSchema,
  tenantId: TenantIdSchema,
  prospectId: IdSchema,
  type: z.enum(['call', 'email', 'meeting', 'note']),
  subject: z.string().optional(),
  content: z.string(),
  duration: z.number().int().nonnegative().optional(),
  createdAt: DateSchema.optional().nullable(),
  updatedAt: DateSchema.optional().nullable(),
});

export const InteractionCreateSchema = z.object({
  prospectId: IdSchema,
  type: z.enum(['call', 'email', 'meeting', 'note']),
  subject: z.string().optional(),
  content: z.string().min(1, 'Contenu requis'),
  duration: z.number().int().nonnegative().optional(),
});

export const InteractionSchema = InteractionBaseSchema;

// ============================================
// TYPES GÉNÉRÉS
// ============================================

export type Prospect = z.infer<typeof ProspectSchema>;
export type ProspectCreate = z.infer<typeof ProspectCreateSchema>;
export type ProspectUpdate = z.infer<typeof ProspectUpdateSchema>;

export type Appointment = z.infer<typeof AppointmentSchema>;
export type AppointmentCreate = z.infer<typeof AppointmentCreateSchema>;
export type AppointmentUpdate = z.infer<typeof AppointmentUpdateSchema>;

export type Interaction = z.infer<typeof InteractionSchema>;
export type InteractionCreate = z.infer<typeof InteractionCreateSchema>;
