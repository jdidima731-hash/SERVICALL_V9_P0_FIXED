/**
 * DEAD LETTER QUEUE SERVICE — SERVICALL V8
 * Gère les échecs critiques de workflows pour intervention manuelle.
 */
import { logger } from "../../infrastructure/logger";
import { getDbInstance, workflowExecutions, workflowDeadLetters } from "../../db";
import { eq } from "drizzle-orm";

export interface DLQEntry {
  workflowId: number;
  tenantId: number;
  eventId: string;
  executionId?: number;
  payload: unknown;
  errors: unknown;
  failedAt: Date;
}

export const dlqService = {
  privateLogger: logger,

  async push(entry: DLQEntry): Promise<void> {
    try {
      const db = getDbInstance();
      if (!db) throw new Error("Database not available for DLQ");

      // 1. Log critique pour monitoring (Datadog/Sentry)
      this.privateLogger.error(`[DLQ_PUSH] Workflow ${entry.workflowId} failed critically`, {
        tenantId: entry.tenantId,
        eventId: entry.eventId,
        errors: entry.errors
      });

      // 2. Persistance dans workflowDeadLetters
      // Le payload stocké doit être exactement celui qui sera rejoué par l'API.
      await db.insert(workflowDeadLetters).values({
        tenantId: entry.tenantId,
        workflowId: entry.workflowId,
        jobId: entry.eventId,
        queueName: 'workflow_engine',
        payload: entry.payload as unknown,
        error: JSON.stringify({
          eventId: entry.eventId,
          executionId: entry.executionId ?? null,
          errors: entry.errors,
        }),
        stack: JSON.stringify({
          transition: 'failed',
          failedAt: (entry.failedAt || new Date()).toISOString(),
        }),
        status: 'failed',
        createdAt: entry.failedAt || new Date()
      } as unknown);

      // 3. Mise à jour de l'exécution si on a un executionId
      if (entry.executionId) {
        await db.update(workflowExecutions)
          .set({
            status: 'failed',
            error: JSON.stringify({
              dlq_flag: true,
              critical_errors: entry.errors,
              failed_event_id: entry.eventId
            }),
            updatedAt: new Date()
          })
          .where(eq(workflowExecutions.id, entry.executionId));
      }

    } catch (err) {
      console.error('[DLQService] Failed to push to DLQ:', err);
    }
  }
};
