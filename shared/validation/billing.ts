import { z } from 'zod';
import { IdSchema, TenantIdSchema, DateSchema, PlanEnum, JsonSchema } from './common';

/**
 * Schémas Zod pour la Facturation
 * 
 * Définit les types pour les commandes, les factures et les paiements.
 */

// ============================================
// COMMANDES
// ============================================

export const OrderBaseSchema = z.object({
  id: IdSchema,
  tenantId: TenantIdSchema,
  orderNumber: z.string().min(1, 'Numéro de commande requis'),
  status: z.enum(['pending', 'confirmed', 'shipped', 'delivered', 'cancelled']).default('pending'),
  totalAmount: z.number().nonnegative('Le montant doit être positif'),
  currency: z.string().length(3, 'Code devise invalide').default('EUR'),
  items: z.array(z.unknown()).optional().nullable(),
  metadata: JsonSchema.optional().nullable(),
  createdAt: DateSchema.optional().nullable(),
  updatedAt: DateSchema.optional().nullable(),
});

export const OrderCreateSchema = z.object({
  orderNumber: z.string().min(1, 'Numéro de commande requis'),
  totalAmount: z.number().nonnegative('Le montant doit être positif'),
  currency: z.string().length(3, 'Code devise invalide').optional(),
  items: z.array(z.unknown()).optional(),
  metadata: JsonSchema.optional(),
});

export const OrderUpdateSchema = z.object({
  status: z.enum(['pending', 'confirmed', 'shipped', 'delivered', 'cancelled']).optional(),
  totalAmount: z.number().nonnegative('Le montant doit être positif').optional(),
  items: z.array(z.unknown()).optional(),
  metadata: JsonSchema.optional(),
});

export const OrderSchema = OrderBaseSchema;

// ============================================
// FACTURES
// ============================================

export const InvoiceBaseSchema = z.object({
  id: IdSchema,
  tenantId: TenantIdSchema,
  invoiceNumber: z.string().min(1, 'Numéro de facture requis'),
  orderId: IdSchema.optional(),
  status: z.enum(['draft', 'sent', 'paid', 'overdue', 'cancelled']).default('draft'),
  amount: z.number().nonnegative('Le montant doit être positif'),
  currency: z.string().length(3, 'Code devise invalide').default('EUR'),
  dueDate: DateSchema.optional().nullable(),
  paidDate: DateSchema.optional().nullable(),
  items: z.array(z.unknown()).optional().nullable(),
  metadata: JsonSchema.optional().nullable(),
  createdAt: DateSchema.optional().nullable(),
  updatedAt: DateSchema.optional().nullable(),
});

export const InvoiceCreateSchema = z.object({
  invoiceNumber: z.string().min(1, 'Numéro de facture requis'),
  orderId: IdSchema.optional(),
  amount: z.number().nonnegative('Le montant doit être positif'),
  currency: z.string().length(3, 'Code devise invalide').optional(),
  dueDate: DateSchema.optional(),
  items: z.array(z.unknown()).optional(),
  metadata: JsonSchema.optional(),
});

export const InvoiceUpdateSchema = z.object({
  status: z.enum(['draft', 'sent', 'paid', 'overdue', 'cancelled']).optional(),
  amount: z.number().nonnegative('Le montant doit être positif').optional(),
  dueDate: DateSchema.optional(),
  paidDate: DateSchema.optional(),
  items: z.array(z.unknown()).optional(),
  metadata: JsonSchema.optional(),
});

export const invoiceSchema = InvoiceBaseSchema;

// ============================================
// PLANS D'ABONNEMENT
// ============================================

export const SubscriptionPlanBaseSchema = z.object({
  id: IdSchema,
  name: z.string().min(1, 'Nom du plan requis'),
  plan: PlanEnum,
  price: z.number().nonnegative('Le prix doit être positif'),
  currency: z.string().length(3, 'Code devise invalide').default('EUR'),
  billingCycle: z.enum(['monthly', 'yearly']).default('monthly'),
  features: z.array(z.string()).optional().nullable(),
  isActive: z.boolean().default(true),
  createdAt: DateSchema.optional().nullable(),
  updatedAt: DateSchema.optional().nullable(),
});

export const SubscriptionPlanCreateSchema = z.object({
  name: z.string().min(1, 'Nom du plan requis'),
  plan: PlanEnum,
  price: z.number().nonnegative('Le prix doit être positif'),
  currency: z.string().length(3, 'Code devise invalide').optional(),
  billingCycle: z.enum(['monthly', 'yearly']).optional(),
  features: z.array(z.string()).optional(),
});

export const SubscriptionPlanSchema = SubscriptionPlanBaseSchema;

// ============================================
// ABONNEMENTS
// ============================================

export const SubscriptionBaseSchema = z.object({
  id: IdSchema,
  tenantId: TenantIdSchema,
  planId: IdSchema,
  status: z.enum(['active', 'paused', 'cancelled']).default('active'),
  startDate: DateSchema,
  endDate: DateSchema.optional().nullable(),
  autoRenew: z.boolean().default(true),
  createdAt: DateSchema.optional().nullable(),
  updatedAt: DateSchema.optional().nullable(),
});

export const SubscriptionCreateSchema = z.object({
  planId: IdSchema,
  startDate: DateSchema,
  autoRenew: z.boolean().optional(),
});

export const SubscriptionUpdateSchema = z.object({
  status: z.enum(['active', 'paused', 'cancelled']).optional(),
  endDate: DateSchema.optional(),
  autoRenew: z.boolean().optional(),
});

export const subscriptionSchema = SubscriptionBaseSchema;

export const usageStatsSchema = z.object({
  totalCalls: z.number(),
  callsInPeriod: z.number(),
  totalDuration: z.number(),
  averageDuration: z.number(),
  plan: PlanEnum,
  callsIncluded: z.number(),
  callsRemaining: z.number(),
  usagePercentage: z.number(),
});

// ============================================
// TYPES GÉNÉRÉS
// ============================================

export type Order = z.infer<typeof OrderSchema>;
export type OrderCreate = z.infer<typeof OrderCreateSchema>;
export type OrderUpdate = z.infer<typeof OrderUpdateSchema>;

export type Invoice = z.infer<typeof invoiceSchema>;
export type InvoiceCreate = z.infer<typeof InvoiceCreateSchema>;
export type InvoiceUpdate = z.infer<typeof InvoiceUpdateSchema>;

export type SubscriptionPlan = z.infer<typeof SubscriptionPlanSchema>;
export type SubscriptionPlanCreate = z.infer<typeof SubscriptionPlanCreateSchema>;

export type Subscription = z.infer<typeof subscriptionSchema>;
export type SubscriptionCreate = z.infer<typeof SubscriptionCreateSchema>;
export type SubscriptionUpdate = z.infer<typeof SubscriptionUpdateSchema>;
