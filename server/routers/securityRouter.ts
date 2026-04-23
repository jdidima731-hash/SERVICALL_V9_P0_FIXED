import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { tenantProcedure, router } from "../procedures";
import { logger } from "../infrastructure/logger";
import { SecurityService } from "../services/securityService";
import { complianceService } from "../services/complianceService";
import {
  complianceDashboardSchema,
  keyHealthSchema,
} from "../../shared/validation/security";

/**
 * Security Router — Thin Router
 * ✅ BLOC 3 FIX: Architecture API -> Service -> Domain -> Infra
 */

const dateStringSchema = z.string().min(1).refine((value) => !Number.isNaN(new Date(value).getTime()), {
  message: "Invalid date",
});

const dateRangeInputSchema = z.object({
  startDate: dateStringSchema,
  endDate: dateStringSchema,
});

const resolveViolationInputSchema = z.object({
  violationId: z.string().min(1),
  resolution: z.string().min(1),
});

const auditReportInputSchema = z.object({
  startDate: dateStringSchema,
  endDate: dateStringSchema,
  format: z.enum(["json", "csv", "pdf"]),
});

const successResponseSchema = z.object({ success: z.boolean() });
const auditLogSchema = z.record(z.unknown());
const auditLogsResponseSchema = z.object({
  logs: z.array(auditLogSchema),
  total: z.number().int().nonnegative(),
});
const auditReportResponseSchema = z.object({
  success: z.literal(true),
  format: z.enum(["json", "csv", "pdf"]),
  content: z.unknown(),
});

function toValidatedDate(value: string, fieldName: string): Date {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `${fieldName} is invalid`,
    });
  }
  return parsed;
}

function assertDateRange(startDate: Date, endDate: Date): void {
  if (startDate.getTime() > endDate.getTime()) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "startDate must be earlier than or equal to endDate",
    });
  }
}

function mapComplianceDashboard(
  rawDashboard: Awaited<ReturnType<typeof SecurityService.getComplianceDashboard>>,
) {
  const violations = rawDashboard.violations.map((violation, index) => {
    const digitsOnly = violation.id.replace(/\D+/gu, "");
    const numericId = Number.parseInt(digitsOnly, 10);

    if (!Number.isInteger(numericId)) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: `Invalid compliance violation identifier at index ${index}`,
      });
    }

    return {
      id: numericId,
      type: violation.type,
      severity: violation.severity,
      description: violation.description,
      detectedAt: violation.detectedAt,
      status: "pending" as const,
    };
  });

  const status = rawDashboard.violationsCount > 0
    ? "warning"
    : rawDashboard.warningsCount > 0
      ? "monitoring"
      : "healthy";

  return complianceDashboardSchema.parse({
    score: rawDashboard.complianceRate,
    status,
    totalViolations: rawDashboard.violationsCount,
    activeViolations: violations.length,
    lastAuditAt: null,
    violations,
  });
}

function parseAuditReportContent(format: "json" | "csv" | "pdf", report: string): unknown {
  if (format !== "json") {
    return report;
  }

  try {
    return JSON.parse(report) as unknown;
  } catch (error: unknown) {
    logger.error("[SecurityRouter] Invalid JSON audit report returned by compliance service", {
      error: error instanceof Error ? error.message : String(error),
    });
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Le service de conformité a renvoyé un rapport JSON invalide",
    });
  }
}

export const securityRouter = router({
  /**
   * Récupère le dashboard de conformité
   */
  getComplianceDashboard: tenantProcedure
    .input(dateRangeInputSchema)
    .output(z.object({ dashboard: complianceDashboardSchema }))
    .query(async ({ input, ctx }) => {
      const startDate = toValidatedDate(input.startDate, "startDate");
      const endDate = toValidatedDate(input.endDate, "endDate");
      assertDateRange(startDate, endDate);

      try {
        const dashboard = await SecurityService.getComplianceDashboard(ctx.tenantId);
        return { dashboard: mapComplianceDashboard(dashboard) };
      } catch (error: unknown) {
        logger.error("[SecurityRouter] Failed to get compliance dashboard", {
          error: error instanceof Error ? error.message : String(error),
          tenantId: ctx.tenantId,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        });

        if (error instanceof TRPCError) {
          throw error;
        }

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to get compliance dashboard",
        });
      }
    }),

  /**
   * Vérifie la santé des clés API
   */
  checkKeyHealth: tenantProcedure.output(keyHealthSchema).query(async ({ ctx }) => {
    try {
      const health = await SecurityService.checkKeyHealth(ctx.tenantId);
      return keyHealthSchema.parse(health);
    } catch (error: unknown) {
      logger.error("[SecurityRouter] Failed to check key health", {
        error: error instanceof Error ? error.message : String(error),
        tenantId: ctx.tenantId,
      });

      if (error instanceof TRPCError) {
        throw error;
      }

      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to check key health",
      });
    }
  }),

  /**
   * Résout une violation
   */
  resolveViolation: tenantProcedure
    .input(resolveViolationInputSchema)
    .output(successResponseSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        return successResponseSchema.parse(
          await SecurityService.resolveViolation(ctx.tenantId, input.violationId, input.resolution),
        );
      } catch (error: unknown) {
        logger.error("[SecurityRouter] Failed to resolve violation", {
          error: error instanceof Error ? error.message : String(error),
          tenantId: ctx.tenantId,
          violationId: input.violationId,
        });

        if (error instanceof TRPCError) {
          throw error;
        }

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to resolve violation",
        });
      }
    }),

  /**
   * Lance une vérification périodique
   */
  runPeriodicComplianceCheck: tenantProcedure
    .output(successResponseSchema)
    .mutation(async ({ ctx }) => {
      try {
        await complianceService.checkStorageCompliance(ctx.tenantId);
        return { success: true };
      } catch (error: unknown) {
        logger.error("[SecurityRouter] Failed to run periodic compliance check", {
          error: error instanceof Error ? error.message : String(error),
          tenantId: ctx.tenantId,
        });

        if (error instanceof TRPCError) {
          throw error;
        }

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to run periodic compliance check",
        });
      }
    }),

  /**
   * Génère un rapport d'audit
   */
  generateAuditReport: tenantProcedure
    .input(auditReportInputSchema)
    .output(auditReportResponseSchema)
    .mutation(async ({ input, ctx }) => {
      const startDate = toValidatedDate(input.startDate, "startDate");
      const endDate = toValidatedDate(input.endDate, "endDate");
      assertDateRange(startDate, endDate);

      try {
        const report = await complianceService.generateAuditReport(
          ctx.tenantId,
          startDate,
          endDate,
          input.format,
        );

        return auditReportResponseSchema.parse({
          success: true,
          format: input.format,
          content: parseAuditReportContent(input.format, report),
        });
      } catch (error: unknown) {
        logger.error("[SecurityRouter] Audit report generation failed", {
          error: error instanceof Error ? error.message : String(error),
          tenantId: ctx.tenantId,
        });

        if (error instanceof TRPCError) {
          throw error;
        }

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Échec de la génération du rapport",
        });
      }
    }),

  /**
   * Rotation de clé
   */
  rotateKey: tenantProcedure.output(successResponseSchema).mutation(async ({ ctx }) => {
    try {
      return successResponseSchema.parse(await SecurityService.rotateKey(ctx.tenantId));
    } catch (error: unknown) {
      logger.error("[SecurityRouter] Failed to rotate key", {
        error: error instanceof Error ? error.message : String(error),
        tenantId: ctx.tenantId,
      });

      if (error instanceof TRPCError) {
        throw error;
      }

      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to rotate key",
      });
    }
  }),

  /**
   * Récupère les logs d'audit
   */
  getAuditLogs: tenantProcedure
    .input(
      z.object({
        limit: z.number().int().min(1).max(500).default(100),
      }),
    )
    .output(auditLogsResponseSchema)
    .query(async ({ ctx, input }) => {
      try {
        const logs = await SecurityService.getAuditLogs(ctx.tenantId, input.limit);
        return auditLogsResponseSchema.parse({
          logs: logs.map((log) => auditLogSchema.parse(log)),
          total: logs.length,
        });
      } catch (error: unknown) {
        logger.error("[SecurityRouter] getAuditLogs failed", {
          error: error instanceof Error ? error.message : String(error),
          tenantId: ctx.tenantId,
          limit: input.limit,
        });

        if (error instanceof TRPCError) {
          throw error;
        }

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Impossible de récupérer les logs d'audit",
        });
      }
    }),
});
