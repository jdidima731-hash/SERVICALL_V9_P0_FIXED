/**
 * Validation Schemas — Réutilisables dans tous les routeurs
 * ✅ FIX P2.3: Centralise les schémas Zod pour une validation cohérente
 */

import { z } from "zod";

/**
 * Schémas primitifs réutilisables
 */
export const commonSchemas = {
  id: z.number().int().positive("ID doit être un nombre positif"),
  tenantId: z.number().int().positive("Tenant ID doit être un nombre positif"),
  email: z.string().email("Email invalide"),
  phone: z.string().regex(/^\+?[0-9\s\-()]{10,}$/, "Numéro de téléphone invalide"),
  url: z.string().url("URL invalide"),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/, "Slug invalide"),
  
  pagination: z.object({
    page: z.number().int().positive().default(1),
    limit: z.number().int().min(1).max(100).default(20),
  }),
};

/**
 * Prospect Schemas
 */
export const prospectSchemas = {
  create: z.object({
    firstName: z.string().min(1).max(100, "Prénom trop long"),
    lastName: z.string().min(1).max(100, "Nom trop long"),
    phone: commonSchemas.phone,
    email: commonSchemas.email.optional(),
    status: z.enum(["pending", "contacted", "qualified", "converted", "lost"]).default("pending"),
  }),

  update: z.object({
    prospectId: commonSchemas.id,
    firstName: z.string().min(1).max(100).optional(),
    lastName: z.string().min(1).max(100).optional(),
    phone: commonSchemas.phone.optional(),
    email: commonSchemas.email.optional(),
    status: z.enum(["pending", "contacted", "qualified", "converted", "lost"]).optional(),
  }),

  getById: z.object({
    prospectId: commonSchemas.id,
  }),

  list: commonSchemas.pagination,

  delete: z.object({
    prospectId: commonSchemas.id,
  }),
};

/**
 * Subscription Schemas
 */
export const subscriptionSchemas = {
  create: z.object({
    planId: z.enum(["starter", "pro", "enterprise"], {
      errorMap: () => ({ message: "Plan invalide" }),
    }),
    customerId: z.string().min(1, "Customer ID requis"),
  }),

  update: z.object({
    subscriptionId: commonSchemas.id,
    planId: z.enum(["starter", "pro", "enterprise"]).optional(),
    status: z.enum(["active", "paused", "cancelled"]).optional(),
  }),

  getById: z.object({
    subscriptionId: commonSchemas.id,
  }),

  list: commonSchemas.pagination,

  cancel: z.object({
    subscriptionId: commonSchemas.id,
  }),
};

/**
 * Call Schemas
 */
export const callSchemas = {
  create: z.object({
    prospectId: commonSchemas.id,
    phoneNumber: commonSchemas.phone,
    campaignId: commonSchemas.id.optional(),
    recordingUrl: commonSchemas.url.optional(),
  }),

  getById: z.object({
    callId: commonSchemas.id,
  }),

  list: commonSchemas.pagination,

  updateStatus: z.object({
    callId: commonSchemas.id,
    status: z.enum(["pending", "in_progress", "completed", "failed"]),
  }),
};

/**
 * Campaign Schemas
 */
export const campaignSchemas = {
  create: z.object({
    name: z.string().min(1).max(255, "Nom trop long"),
    description: z.string().max(1000).optional(),
    status: z.enum(["draft", "active", "paused", "completed"]).default("draft"),
  }),

  update: z.object({
    campaignId: commonSchemas.id,
    name: z.string().min(1).max(255).optional(),
    description: z.string().max(1000).optional(),
    status: z.enum(["draft", "active", "paused", "completed"]).optional(),
  }),

  getById: z.object({
    campaignId: commonSchemas.id,
  }),

  list: commonSchemas.pagination,

  delete: z.object({
    campaignId: commonSchemas.id,
  }),
};

/**
 * Workflow Schemas
 */
export const workflowSchemas = {
  create: z.object({
    name: z.string().min(1).max(255),
    description: z.string().max(1000).optional(),
    triggers: z.array(z.object({})).optional(),
    actions: z.array(z.object({})).optional(),
  }),

  execute: z.object({
    workflowId: commonSchemas.id,
    prospectId: commonSchemas.id,
  }),

  getById: z.object({
    workflowId: commonSchemas.id,
  }),

  list: commonSchemas.pagination,
};
