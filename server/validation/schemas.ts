/**
 * SCHÉMAS DE VALIDATION CENTRALISÉS
 * Validation Zod pour toutes les API REST
 * ✅ Typage strict et réutilisable
 */

import { z } from "zod";

// ============================================
// SCHÉMAS COMMUNS
// ============================================

export const idSchema = z.number().int().positive();

export const paginationSchema = z.object({
  limit: z.number().int().min(1).max(100).default(20),
  offset: z.number().int().min(0).default(0),
});

export const searchSchema = z.object({
  query: z.string().min(1).max(255).optional(),
  ...paginationSchema.shape,
});

export const dateRangeSchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

// ============================================
// BUSINESS ENTITIES
// ============================================

export const entityTypeSchema = z.enum([
  "product",
  "service",
  "property",
  "room",
  "appointment",
  "menu_item",
  "other",
]);

export const createBusinessEntitySchema = z.object({
  type: entityTypeSchema,
  title: z.string().min(1).max(255),
  description: z.string().max(2000).optional(),
  price: z.number().nonnegative().optional(),
  vatRate: z.number().min(0).max(100).optional(),
  availabilityJson: z.record(z.string(), z.any()).optional(),
  metadataJson: z.record(z.string(), z.any()).optional(),
  isActive: z.boolean().default(true),
});

export const updateBusinessEntitySchema = createBusinessEntitySchema.partial().extend({
  id: idSchema,
});

export const searchBusinessEntitiesSchema = z.object({
  query: z.string().optional(),
  type: entityTypeSchema.optional(),
  isActive: z.boolean().optional(),
});

// ============================================
// POS CONNECTOR
// ============================================

export const posProviderSchema = z.enum([
  "lightspeed",
  "sumup",
  "zettle",
  "square",
  "tiller",
  "none",
]);

export const posConfigSchema = z.object({
  apiKey: z.string().min(1).optional(),
  accessToken: z.string().min(1).optional(),
  clientId: z.string().min(1).optional(),
  clientSecret: z.string().min(1).optional(),
  merchantId: z.string().min(1).optional(),
  apiUrl: z.string().url().optional(),
});

export const updatePosConfigSchema = z.object({
  provider: posProviderSchema,
  syncEnabled: z.boolean(),
  config: posConfigSchema,
});

export const syncOrderSchema = z.object({
  crmOrderId: z.string().min(1),
  items: z.array(z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    quantity: z.number().int().positive(),
    price: z.number().nonnegative(),
    vatRate: z.number().min(0).max(100),
  })).min(1),
  totalAmount: z.number().nonnegative(),
  vatAmount: z.number().nonnegative(),
});

// ============================================
// CALENDRIER
// ============================================

export const appointmentStatusSchema = z.enum([
  "scheduled",
  "confirmed",
  "cancelled",
  "completed",
  "no_show",
]);

export const createAppointmentSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().max(2000).optional(),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  prospectId: z.number().int().positive().optional(),
  agentId: z.number().int().positive().optional(),
  status: appointmentStatusSchema.default("scheduled"),
  metadataJson: z.record(z.string(), z.any()).optional(),
});

export const updateAppointmentSchema = createAppointmentSchema.partial().extend({
  id: idSchema,
});

export const searchAppointmentsSchema = z.object({
  ...dateRangeSchema.shape,
  status: appointmentStatusSchema.optional(),
  agentId: z.number().int().positive().optional(),
  prospectId: z.number().int().positive().optional(),
});

// ============================================
// AUTOMATISATION / WORKFLOW
// ============================================

export const workflowTriggerSchema = z.enum([
  "call_received",
  "call_completed",
  "prospect_created",
  "prospect_qualified",
  "appointment_scheduled",
  "appointment_confirmed",
  "appointment_cancelled",
  "invoice_created",
  "invoice_overdue",
]);

export const workflowActionTypeSchema = z.enum([
  "send_sms",
  "create_outbound_call",
  "assign_agent",
  "update_status"
]);

export const workflowActionSchema = z.object({
  type: workflowActionTypeSchema,
  config: z.record(z.string(), z.any()),
});

export const createWorkflowSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(2000).optional(),
  trigger: workflowTriggerSchema,
  actions: z.array(workflowActionSchema).min(1),
  isActive: z.boolean().default(true),
  conditions: z.record(z.string(), z.any()).optional(),
});

export const updateWorkflowSchema = createWorkflowSchema.partial().extend({
  id: idSchema,
});

// ============================================
// PROSPECTS / CONTACTS
// ============================================

export const prospectStatusSchema = z.enum([
  "new",
  "contacted",
  "qualified",
  "proposal",
  "negotiation",
  "won",
  "lost",
]);

export const createProspectSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  email: z.string().email().optional(),
  phone: z.string().min(1).max(20).optional(),
  company: z.string().max(255).optional(),
  status: prospectStatusSchema.default("new"),
  source: z.string().max(100).optional(),
  notes: z.string().max(5000).optional(),
  metadataJson: z.record(z.string(), z.any()).optional(),
});

export const updateProspectSchema = createProspectSchema.partial().extend({
  id: idSchema,
});

export const searchProspectsSchema = z.object({
  query: z.string().optional(),
  status: prospectStatusSchema.optional(),
  source: z.string().optional(),
  ...paginationSchema.shape,
});

// ============================================
// APPELS
// ============================================

export const callStatusSchema = z.enum([
  "initiated",
  "ringing",
  "in_progress",
  "completed",
  "failed",
  "no_answer",
  "busy",
]);

export const callDirectionSchema = z.enum([
  "inbound",
  "outbound",
]);

export const createCallSchema = z.object({
  direction: callDirectionSchema,
  fromNumber: z.string().min(1).max(20),
  toNumber: z.string().min(1).max(20),
  prospectId: z.number().int().positive().optional(),
  agentId: z.number().int().positive().optional(),
  status: callStatusSchema.default("initiated"),
});

export const updateCallSchema = z.object({
  id: idSchema,
  status: callStatusSchema.optional(),
  duration: z.number().int().nonnegative().optional(),
  recordingUrl: z.string().url().optional(),
  transcription: z.string().optional(),
  summary: z.string().optional(),
  sentiment: z.enum(["positive", "neutral", "negative"]).optional(),
});

// ============================================
// UTILISATEURS
// ============================================

export const userRoleSchema = z.enum([
  "admin",
  "manager",
  "agent",
  "viewer",
]);

export const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(100),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  role: userRoleSchema.default("agent"),
});

export const updateUserSchema = z.object({
  id: idSchema,
  email: z.string().email().optional(),
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  role: userRoleSchema.optional(),
  isActive: z.boolean().optional(),
});

// ============================================
// AUTHENTIFICATION
// ============================================

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(100),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  companyName: z.string().min(1).max(255),
});

export const resetPasswordSchema = z.object({
  email: z.string().email(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(100),
});

// ============================================
// TYPES EXPORTÉS
// ============================================

export type EntityType = z.infer<typeof entityTypeSchema>;
export type PosProvider = z.infer<typeof posProviderSchema>;
export type AppointmentStatus = z.infer<typeof appointmentStatusSchema>;
export type WorkflowTrigger = z.infer<typeof workflowTriggerSchema>;
export type WorkflowActionType = z.infer<typeof workflowActionTypeSchema>;
export type ProspectStatus = z.infer<typeof prospectStatusSchema>;
export type CallStatus = z.infer<typeof callStatusSchema>;
export type CallDirection = z.infer<typeof callDirectionSchema>;
export type UserRole = z.infer<typeof userRoleSchema>;
