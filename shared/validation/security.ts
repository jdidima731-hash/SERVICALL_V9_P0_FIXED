import { z } from "zod";

/**
 * Schémas de Sécurité et Anti Cross-Tenant
 * 
 * Centralise les validations pour empêcher l'injection de tenantId
 * et protéger l'isolation des données.
 */

export const complianceViolationSchema = z.object({
  id: z.number(),
  type: z.string(),
  severity: z.enum(["low", "medium", "high", "critical"]),
  description: z.string(),
  detectedAt: z.string(),
  status: z.enum(["pending", "resolved", "ignored"]),
});

export const complianceDashboardSchema = z.object({
  score: z.number(),
  status: z.string(),
  totalViolations: z.number(),
  activeViolations: z.number(),
  lastAuditAt: z.string().nullable(),
  violations: z.array(complianceViolationSchema),
});

export type ComplianceViolation = z.infer<typeof complianceViolationSchema>;
export type ComplianceDashboard = z.infer<typeof complianceDashboardSchema>;

export const keyHealthSchema = z.array(z.object({
  provider: z.string(),
  isHealthy: z.boolean(),
  status: z.string(),
  lastValidated: z.string(),
}));

/**
 * Middleware de validation Zod qui refuse tout tenantId dans les inputs
 * Le tenantId doit TOUJOURS provenir de la session (ctx.user.tenantId)
 */
export const RejectTenantIdInInput = z.object({}).strict().refine(
  (data: any) => {
    return !('tenantId' in data || 'tenant_id' in data);
  },
  {
    message: "❌ SECURITY: tenantId cannot be provided in input. It must come from session context.",
  }
);

/**
 * Schéma de validation pour les requêtes qui NE DOIVENT PAS contenir de tenantId
 */
export const NoTenantIdSchema = z.object({
  tenantId: z.never().optional(),
  tenant_id: z.never().optional(),
}).passthrough();

/**
 * Helper pour créer un schéma qui refuse explicitement tenantId
 */
export function withoutTenantId<T extends z.ZodRawShape>(schema: z.ZodObject<T>) {
  return schema.refine(
    (data: any) => !('tenantId' in data || 'tenant_id' in data),
    {
      message: "❌ SECURITY: tenantId injection detected. This field is automatically set from session.",
      path: ['tenantId'],
    }
  );
}

/**
 * Validation stricte pour les opérations de mise à jour
 * Empêche l'injection de champs sensibles
 */
export const SecureUpdateSchema = <T extends z.ZodRawShape>(baseSchema: z.ZodObject<T>) => {
  return baseSchema.refine(
    (data: any) => {
      const forbiddenFields = ['tenantId', 'tenant_id', 'userId', 'user_id', 'role'];
      return !forbiddenFields.some(field => field in data);
    },
    {
      message: "❌ SECURITY: Forbidden field detected in input. System fields cannot be modified directly.",
    }
  );
};
