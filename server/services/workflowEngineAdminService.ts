/**
 * WORKFLOW ENGINE ADMIN SERVICE — SERVICALL V8
 * ─────────────────────────────────────────────────────────────
 * Service pour la gestion administrative du moteur de workflow.
 * Gère les dead letters, les retries et les opérations de maintenance.
 */

import { db, workflowDeadLetters } from "../db";
import { eq, and, desc } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { logger } from "../infrastructure/logger";
import { WorkflowEngine } from "../workflow-engine/core/WorkflowEngine";

const engine = new WorkflowEngine();

export class WorkflowEngineAdminService {
  /**
   * Liste les dead letters pour un tenant
   */
  static async listDeadLetters(tenantId: number, limit: number = 50, offset: number = 0) {
    return await db.select()
      .from(workflowDeadLetters)
      .where(eq(workflowDeadLetters.tenantId, tenantId))
      .limit(limit)
      .offset(offset)
      .orderBy(desc(workflowDeadLetters.createdAt));
  }

  /**
   * Retente une dead letter spécifique
   */
  static async retryDeadLetter(tenantId: number, id: number) {
    const deadLetter = await db.query.workflowDeadLetters.findFirst({
      where: and(
        eq(workflowDeadLetters.id, id),
        eq(workflowDeadLetters.tenantId, tenantId)
      ),
    });

    if (!deadLetter) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Dead letter non trouvée" });
    }

    logger.info("[WorkflowEngineAdminService] Retrying dead letter", { deadLetterId: id, tenantId });

    await db.update(workflowDeadLetters)
      .set({ status: 'retrying' })
      .where(eq(workflowDeadLetters.id, id));

    try {
      const event = deadLetter.payload as unknown;
      await engine.handle(event);

      await db.update(workflowDeadLetters)
        .set({ status: 'resolved', resolvedAt: new Date() })
        .where(eq(workflowDeadLetters.id, id));

      const errorDetails = typeof deadLetter.error === 'string'
        ? JSON.parse(deadLetter.error)
        : null;

      return { success: true, executionId: errorDetails?.executionId ?? null };
    } catch (error: any) {
      logger.warn("[WorkflowEngineAdminService] Retry failed", { deadLetterId: id, error: error.message });

      await db.update(workflowDeadLetters)
        .set({ 
          status: 'failed', 
          error: JSON.stringify({
            ...(typeof deadLetter.error === 'string' ? JSON.parse(deadLetter.error) : {}),
            replayError: error.message,
          }) 
        })
        .where(eq(workflowDeadLetters.id, id));
      
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Échec du rejeu : " + error.message
      });
    }
  }

  /**
   * Supprime une dead letter
   */
  static async deleteDeadLetter(tenantId: number, id: number) {
    const result = await db.delete(workflowDeadLetters)
      .where(and(
        eq(workflowDeadLetters.id, id),
        eq(workflowDeadLetters.tenantId, tenantId)
      ))
      .returning();

    if (result.length === 0) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Dead letter non trouvée" });
    }

    return { success: true };
  }
}
