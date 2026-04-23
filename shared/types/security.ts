export interface KeyHealth {
  healthy: boolean;
  warnings: string[];
  errors: string[];
  lastCheckAt: string;
}

export interface ComplianceViolation {
  id: string;
  type: string;
  severity: "low" | "medium" | "high" | "critical";
  description: string;
  detectedAt: string;
  status: "pending" | "resolved" | "ignored";
  resolution?: string;
  resolvedBy?: number;
  resolvedAt?: string;
}

export interface ComplianceDashboard {
  complianceRate: number;
  violationsCount: number;
  warningsCount: number;
  nextAuditDate: string;
  violations: ComplianceViolation[];
  recommendations: string[];
  history: {
    date: string;
    rate: number;
  }[];
}

export interface KeyGenerationResult {
  success: boolean;
  keyId: string;
  version: number;
  expiresAt: string;
}

export interface AuditReport {
  success: boolean;
  report: any;
  format: string;
}
