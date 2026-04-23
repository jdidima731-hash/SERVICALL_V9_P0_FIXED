/**
 * Workflow Service - Automation et règles métier
 * Module 7: Workflow Automation
 * ✅ BLOC 1 FIX: Runtime canonique unique via WorkflowEngine
 * ✅ BLOC 1 FIX: CRUD workflows centralisé (Architecture Service)
 */

import { db, workflows, workflowExecutions } from "../db";
import { logger } from "../infrastructure/logger";
import { deleteCache, CACHE_KEYS } from "./cacheService";
import { WorkflowEngine } from "../workflow-engine/core/WorkflowEngine";
import type { IncomingEvent, Channel } from "../workflow-engine/types";
import { eq, and, desc, count } from "drizzle-orm";

// ============================================
// WORKFLOW EXECUTION — CANONICAL RUNTIME
// ============================================

/**
 * Execute a workflow based on trigger
 */
export async function executeWorkflow(
  tenantId: number,
  trigger: string,
  context: Record<string, any>
): Promise<void> {
  try {
    logger.info(`[Workflow Service] Triggering workflows for: ${trigger}`, { tenantId, trigger });

    const incomingEvent: IncomingEvent = {
      type: trigger as unknown,
      channel: 'telephony' as Channel,
      tenant_id: tenantId,
      data: context,
      metadata: {
        triggerType: trigger,
        source: 'workflow_service'
      }
    };

    const engine = new WorkflowEngine();
    const result = await engine.handle(incomingEvent);

    if (result.status === 'no_workflow') {
      logger.info(`[Workflow Service] No active workflow found for trigger`, { tenantId, trigger });
    } else {
      logger.info(`[Workflow Service] Workflow executed successfully`, { tenantId, trigger, result });
    }

  } catch (error: any) {
    logger.error("[Workflow Service] Error in executeWorkflow", error, { tenantId, trigger });
    throw error;
  }
}

/**
 * Invalider le cache des workflows
 */
export async function invalidateWorkflowCache(tenantId: number): Promise<void> {
  await deleteCache(CACHE_KEYS.ACTIVE_WORKFLOWS(tenantId));
  logger.info("[Workflow Service] Workflow cache invalidated", { tenantId });
}

// ============================================
// WORKFLOW CRUD — SERVICE LAYER
// ============================================

export class WorkflowService {
  static async list(tenantId: number, limit: number = 50, offset: number = 0) {
    const [data, totalResult] = await Promise.all([
      db.select().from(workflows)
        .where(eq(workflows.tenantId, tenantId))
        .limit(limit)
        .offset(offset)
        .orderBy(desc(workflows.createdAt)),
      db.select({ value: count() })
        .from(workflows)
        .where(eq(workflows.tenantId, tenantId))
    ]);
    return { data, total: totalResult[0]?.value ?? 0 };
  }

  static async getById(id: number, tenantId: number) {
    const [workflow] = await db.select().from(workflows)
      .where(and(eq(workflows.id, id), eq(workflows.tenantId, tenantId)))
      .limit(1);
    return workflow || null;
  }

  static async create(data: {
    tenantId: number;
    name: string;
    description?: string | null;
    triggerType: string;
    triggerConfig?: any;
    actions: any[];
    isActive?: boolean;
  }) {
    const [workflow] = await db.insert(workflows).values({
      tenantId: data.tenantId,
      name: data.name,
      description: data.description ?? null,
      triggerType: data.triggerType as unknown,
      triggerConfig: data.triggerConfig ?? null,
      actions: data.actions,
      isActive: data.isActive ?? true,
    }).returning();
    
    await invalidateWorkflowCache(data.tenantId);
    return workflow;
  }

  static async update(id: number, tenantId: number, data: Partial<{
    name: string;
    description: string | null;
    triggerType: string;
    triggerConfig: any;
    actions: any[];
    isActive: boolean;
  }>) {
    const [updated] = await db.update(workflows)
      .set({
        ...data,
        updatedAt: new Date(),
      } as unknown)
      .where(and(eq(workflows.id, id), eq(workflows.tenantId, tenantId)))
      .returning();
    
    if (updated) {
      await invalidateWorkflowCache(tenantId);
    }
    return updated;
  }

  static async delete(id: number, tenantId: number) {
    const [deleted] = await db.delete(workflows)
      .where(and(eq(workflows.id, id), eq(workflows.tenantId, tenantId)))
      .returning();
    
    if (deleted) {
      await invalidateWorkflowCache(tenantId);
    }
    return deleted;
  }

  static async getExecutionHistory(workflowId: number, limit: number = 50) {
    return await db.select()
      .from(workflowExecutions)
      .where(eq(workflowExecutions.workflowId, workflowId))
      .orderBy(desc(workflowExecutions.createdAt))
      .limit(limit);
  }
}

/**
 * Legacy exports for compatibility
 */
export const getWorkflowExecutionHistory = WorkflowService.getExecutionHistory;
export async function getTenantWorkflowExecutionHistory(tenantId: number, limit: number = 100) {
  return await db.select({
    execution: workflowExecutions,
    workflow: workflows,
  })
  .from(workflowExecutions)
  .innerJoin(workflows, eq(workflowExecutions.workflowId, workflows.id))
  .where(eq(workflows.tenantId, tenantId))
  .orderBy(desc(workflowExecutions.createdAt))
  .limit(limit);
}

// TS2305 FIX — stub triggerCallCompletedWorkflow
export async function triggerCallCompletedWorkflow(params: { tenantId: number; callId: number; outcome?: string }): Promise<void> {
  await executeWorkflow(params.tenantId, "call_completed", { callId: params.callId, outcome: params.outcome });
}
