import { z } from "zod";

export const complianceViolationSchema = z.object({
  id: z.string(),
  type: z.string(),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  description: z.string(),
  detectedAt: z.string(),
  resolvedAt: z.string().nullable().optional(),
  resolution: z.string().nullable().optional(),
});

export const complianceDashboardSchema = z.object({
  complianceRate: z.number(),
  violationsCount: z.number(),
  warningsCount: z.number(),
  nextAuditDate: z.string(),
  violations: z.array(complianceViolationSchema),
});

export const keyHealthSchema = z.object({
  isHealthy: z.boolean(),
  lastValidated: z.string().nullable(),
  provider: z.string(),
  status: z.string(),
});
