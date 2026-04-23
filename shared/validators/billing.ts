import { z } from "zod";

export const subscriptionSchema = z.object({
  id: z.number(),
  tenantId: z.number(),
  plan: z.string(),
  status: z.string(),
  currentPeriodStart: z.string().nullable(),
  currentPeriodEnd: z.string().nullable(),
  stripeSubscriptionId: z.string().nullable(),
  stripeCustomerId: z.string().nullable(),
  callsIncluded: z.number(),
  agentSeats: z.number(),
  createdAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
});

export const invoiceSchema = z.object({
  id: z.number(),
  tenantId: z.number(),
  subscriptionId: z.number().nullable(),
  invoiceNumber: z.string(),
  amount: z.union([z.number(), z.string()]),
  currency: z.string(),
  status: z.string(),
  stripeInvoiceId: z.string().nullable(),
  pdfUrl: z.string().nullable(),
  dueDate: z.string().nullable(),
  paidAt: z.string().nullable(),
  createdAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
});

export const billingInfoSchema = z.object({
  subscription: subscriptionSchema.nullable(),
  invoices: z.array(invoiceSchema),
});

export const usageStatsSchema = z.object({
  totalCalls: z.number(),
  callsInPeriod: z.number(),
  totalDuration: z.number(),
  averageDuration: z.number(),
  plan: z.string(),
  callsIncluded: z.number(),
  callsRemaining: z.number(),
  usagePercentage: z.number(),
});
