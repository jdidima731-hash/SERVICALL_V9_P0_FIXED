/**
 * UPDATE LEAD ACTION - HARDENED
 * Met à jour un prospect existant dans le CRM avec machine d'état et idempotence.
 */

import { z } from "zod";
import type { ActionHandler, ActionResult, ProspectData, FinalExecutionContext } from "@server/workflow-engine/types";
import { getDbInstance, prospects } from "@server/db";
import { eq } from "drizzle-orm";
import { logger } from "@server/infrastructure/logger";
import { IdempotencyService } from "@server/workflow-engine/utils/IdempotencyService";
import { StateMachineEngine, ProspectStateMachine } from "@server/state-machine/StateMachine";
import { AuditService } from "@server/services/auditService";

// Configuration structurée
const UpdateLeadConfigSchema = z.object({
  prospect_id: z.number().optional(),
  status: z.enum(['new', 'contacted', 'qualified', 'converted', 'lost']).optional(),
  score: z.number().optional(),
  notes: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

type UpdateLeadConfig = z.infer<typeof UpdateLeadConfigSchema>;

// Résultat structuré
interface UpdateLeadResult {
  prospect_id: number;
  updated: Record<string, unknown>;
  skipped?: boolean;
}

export class UpdateLeadAction implements ActionHandler<UpdateLeadConfig, FinalExecutionContext, UpdateLeadResult> {
  name = 'update_lead';

  async execute(
    context: FinalExecutionContext,
    config: UpdateLeadConfig
  ): Promise<ActionResult<UpdateLeadResult>> {
    try {
      // Validation de la config
      const validatedConfig = UpdateLeadConfigSchema.parse(config);

      const db = getDbInstance();
      if (!db) throw new Error("Database not available");

      const prospectId: number | undefined =
        validatedConfig.prospect_id ?? context.variables.prospect?.id;

      if (!prospectId) {
        throw new Error('No prospect ID provided for update');
      }

      // 1. Idempotency Check
      const idempotencyKey = IdempotencyService.generateKey({
        prospectId,
        config: validatedConfig,
        eventId: context.event.id
      });

      const isFirstTime = await IdempotencyService.checkAndSet(idempotencyKey, 'update_lead');
      if (!isFirstTime) {
        logger.info('[UpdateLeadAction] Duplicate update_lead detected, skipping', { prospectId });
        return { success: true, data: { prospect_id: prospectId, skipped: true, updated: {} } };
      }

      // 2. State Machine Validation
      const currentProspectData = await db
        .select()
        .from(prospects)
        .where(eq(prospects.id, prospectId))
        .limit(1);

      if (currentProspectData.length === 0) {
        throw new Error(`Prospect ${prospectId} not found`);
      }

      const currentProspect = currentProspectData[0]!;
      const currentStatus = (currentProspect.status as any) || 'new';

      if (validatedConfig.status && validatedConfig.status !== currentStatus) {
        let transitionAction = '';
        if (validatedConfig.status === 'contacted') transitionAction = 'CONTACT';
        else if (validatedConfig.status === 'qualified') transitionAction = 'QUALIFY';
        else if (validatedConfig.status === 'converted') transitionAction = 'CONVERT';
        else if (validatedConfig.status === 'lost') transitionAction = 'LOSE';
        else if (validatedConfig.status === 'new') transitionAction = 'REOPEN';

        if (transitionAction) {
          const canTransition = StateMachineEngine.canTransition(
            currentStatus,
            transitionAction,
            ProspectStateMachine
          );
          if (!canTransition) {
            logger.warn('[UpdateLeadAction] Illegal state transition attempted', {
              from: currentStatus,
              to: validatedConfig.status,
              prospectId
            });
            throw new Error(`Illegal state transition from ${currentStatus} to ${validatedConfig.status}`);
          }
        }
      }

      // 3. Data Preparation
      const updateData: any = { updatedAt: new Date() };

      if (validatedConfig.status !== undefined) updateData.status = validatedConfig.status;
      if (validatedConfig.score !== undefined) updateData.score = validatedConfig.score;
      if (validatedConfig.notes !== undefined) updateData.notes = validatedConfig.notes;
      if (validatedConfig.email !== undefined) updateData.email = validatedConfig.email;
      if (validatedConfig.phone !== undefined) updateData.phone = validatedConfig.phone;
      if (validatedConfig.firstName !== undefined) updateData.firstName = validatedConfig.firstName;
      if (validatedConfig.lastName !== undefined) updateData.lastName = validatedConfig.lastName;

      if (validatedConfig.metadata !== undefined) {
        updateData.metadata = {
          ...(currentProspect.metadata as Record<string, unknown> || {}),
          ...validatedConfig.metadata,
          last_workflow_execution: context.event.id,
          updated_by_workflow: context.workflow.name
        };
      }

      // 4. Mutation
      await db
        .update(prospects)
        .set(updateData)
        .where(eq(prospects.id, prospectId));

      // 5. Audit Logging
      await AuditService.log({
        tenantId: context.tenant.id,
        userId: Number(context.event.metadata?.triggered_by) || 0,
        action: "RESOURCE_UPDATE",
        resource: "prospect",
        resourceId: prospectId,
        actorType: "system",
        source: "SYSTEM",
        metadata: {
          oldStatus: currentStatus,
          newStatus: validatedConfig.status ?? currentStatus,
          fieldsUpdated: Object.keys(updateData)
        }
      });

      // Mise à jour du contexte
      const updatedProspectData = await db
        .select()
        .from(prospects)
        .where(eq(prospects.id, prospectId))
        .limit(1);

      context.variables.prospect = updatedProspectData[0] as ProspectData;

      return {
        success: true,
        data: { prospect_id: prospectId, updated: updateData }
      };
    } catch (error: unknown) {
      logger.error('[UpdateLeadAction] Failed to update lead', { error });
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  validate(config: Record<string, unknown>): boolean {
    const result = UpdateLeadConfigSchema.safeParse(config);
    return result.success || config.prospect_id === undefined; // prospect_id peut venir du contexte
  }
}
