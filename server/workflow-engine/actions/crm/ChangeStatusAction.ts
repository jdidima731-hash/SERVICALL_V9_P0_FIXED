/**
 * CHANGE STATUS ACTION - HARDENED
 * Change le statut d'un prospect avec validation par machine d'état.
 */

import { z } from "zod";
import type { ActionHandler, ActionResult } from "@server/workflow-engine/types";
import type { FinalExecutionContext } from "@server/workflow-engine/structured-types";
import { getDbInstance, prospects } from "@server/db";
import { eq } from "drizzle-orm";
import { Logger } from "@server/infrastructure/logger";
import { IdempotencyService } from "@server/workflow-engine/utils/IdempotencyService";
import { StateMachineEngine, ProspectStateMachine, ProspectStatus } from "@server/state-machine/StateMachine";
import { AuditService } from "@server/services/auditService";

// Configuration structurée
const ChangeStatusConfigSchema = z.object({
  prospect_id: z.number().optional(),
  status: z.string().min(1, "Le statut est obligatoire"),
  output_vars: z.record(z.string()).optional(), // ex: { "previous_status": "oldStatus" }
});
type ChangeStatusConfig = z.infer<typeof ChangeStatusConfigSchema>;

// Résultat structuré
interface ChangeStatusResult {
  oldStatus: string;
  newStatus: string;
  skipped?: boolean;
}

export class ChangeStatusAction implements ActionHandler<ChangeStatusConfig, FinalExecutionContext, ChangeStatusResult> {
  name = 'crm_change_status';
  private logger = new Logger('ChangeStatusAction');

  async execute(
    context: FinalExecutionContext,
    config: ChangeStatusConfig
  ): Promise<ActionResult<ChangeStatusResult>> {
    try {
      // BLOC AUDIT : Validation stricte de la config
      const validatedConfig = ChangeStatusConfigSchema.parse(config);

      const db = getDbInstance();
      if (!db) throw new Error("Database not available");

      const prospectId: number | undefined =
        config.prospect_id ?? context.variables.prospect?.id;

      const targetStatus = config.status as ProspectStatus;

      if (!prospectId || !targetStatus) {
        throw new Error('Prospect ID and target status are required');
      }

      // 1. Idempotency Check
      const idempotencyKey = IdempotencyService.generateKey({
        prospectId,
        targetStatus,
        eventId: context.event.id
      });

      const isFirstTime = await IdempotencyService.checkAndSet(idempotencyKey, 'change_status');
      if (!isFirstTime) {
        this.logger.info('Duplicate change_status detected, skipping', { prospectId });
        return { success: true, data: { skipped: true, oldStatus: '', newStatus: '' } };
      }

      // 2. State Machine Validation
      const currentProspect = await db
        .select()
        .from(prospects)
        .where(eq(prospects.id, prospectId))
        .limit(1);

      if (currentProspect.length === 0) {
        throw new Error(`Prospect ${prospectId} not found`);
      }

      const currentStatus = currentProspect[0]?.status ?? 'new';

      if (targetStatus !== currentStatus) {
        let transitionAction = '';
        if (targetStatus === 'contacted') transitionAction = 'CONTACT';
        else if (targetStatus === 'qualified') transitionAction = 'QUALIFY';
        else if (targetStatus === 'converted') transitionAction = 'CONVERT';
        else if (targetStatus === 'lost') transitionAction = 'LOSE';
        else if (targetStatus === 'new') transitionAction = 'REOPEN';

        if (transitionAction) {
          const canTransition = StateMachineEngine.canTransition(
            currentStatus,
            transitionAction,
            ProspectStateMachine
          );
          if (!canTransition) {
            throw new Error(`Illegal state transition from ${currentStatus} to ${targetStatus}`);
          }
        }
      }

      // 3. Atomic Mutation
      await db
        .update(prospects)
        .set({ status: targetStatus, updatedAt: new Date() })
        .where(eq(prospects.id, prospectId))
        .execute();

      // 4. Audit Logging
      await AuditService.log({
        tenantId: context.tenant.id,
        userId: Number(context.event.metadata?.triggered_by) || 0,
        action: "RESOURCE_UPDATE",
        resource: "prospect_status",
        resourceId: prospectId,
        actorType: "system",
        source: "SYSTEM",
        metadata: { oldStatus: currentStatus, newStatus: targetStatus }
      });

      // Mise à jour du contexte structuré
      if (context.variables.prospect) {
        context.variables.prospect.status = targetStatus;
      }

      // ✅ FIX [11] — output_vars : mapper les résultats dans context.variables
      if (config.output_vars) {
        const resultData: Record<string, string> = {
          oldStatus: currentStatus,
          newStatus: targetStatus,
        };
        for (const [contextKey, resultKey] of Object.entries(config.output_vars)) {
          if (resultKey in resultData) {
            context.variables[contextKey] = resultData[resultKey];
          }
        }
      }

      return {
        success: true,
        data: { oldStatus: currentStatus, newStatus: targetStatus }
      };
    } catch (error: unknown) {
      this.logger.error('Failed to change status', { error });
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  validate(config: Record<string, unknown>): boolean {
    const result = ChangeStatusConfigSchema.safeParse(config);
    if (!result.success) {
      this.logger.error('Validation failed', { errors: result.error.format() });
      return false;
    }
    return true;
  }
}
