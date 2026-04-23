import { ComplianceDashboard, ComplianceViolation } from "../../../../shared/types/security";
import { complianceDashboardSchema, complianceViolationSchema } from "../../../../shared/validation/security";

export function normalizeComplianceDashboard(d: any): ComplianceDashboard {
  const result = complianceDashboardSchema.safeParse(d);

  if (!result.success) {
    console.warn("[Normalizer] ComplianceDashboard validation failed", result.error);
    return {
      complianceRate: d?.complianceRate ?? d?.score ?? 0,
      violationsCount: d?.violationsCount ?? d?.totalViolations ?? 0,
      warningsCount: d?.warningsCount ?? d?.activeViolations ?? 0,
      nextAuditDate: d?.nextAuditDate ?? d?.lastAuditAt ?? new Date().toISOString(),
      violations: Array.isArray(d?.violations) ? d.violations.map(normalizeComplianceViolation) : [],
      recommendations: Array.isArray(d?.recommendations) ? d.recommendations : [],
      history: Array.isArray(d?.history) ? d.history : [],
    } as unknown as ComplianceDashboard;
  }

  return result.data as unknown as ComplianceDashboard;
}

export function normalizeComplianceViolation(v: any): ComplianceViolation {
  const result = complianceViolationSchema.safeParse(v);

  if (!result.success) {
    console.warn("[Normalizer] ComplianceViolation validation failed", result.error);
    return {
      id: String(v?.id ?? "unknown"),
      type: v?.type ?? "unknown",
      severity: v?.severity ?? "low",
      description: v?.description ?? "",
      detectedAt: v?.detectedAt ?? new Date().toISOString(),
      status: v?.status ?? "pending",
      resolvedAt: v?.resolvedAt ?? undefined,
      resolution: v?.resolution ?? undefined,
    } as ComplianceViolation;
  }

  return result.data as unknown as ComplianceViolation;
}
