/**
 * CREATE APPOINTMENT ACTION - HARDENED
 */

import { z } from "zod";
import type { ActionHandler, ActionResult } from "@server/workflow-engine/types";
import type { FinalExecutionContext } from "@server/workflow-engine/structured-types";
import { getDbInstance, appointments } from "@server/db";
import { logger } from "@server/infrastructure/logger";
import { IdempotencyService } from "@server/workflow-engine/utils/IdempotencyService";
import { AuditService } from "@server/services/auditService";

// Configuration structurée
const CreateAppointmentConfigSchema = z.object({
  prospect_id: z.number().optional(),
  title: z.string().optional(),
  description: z.string().optional(),
  scheduled_at: z.string().optional(),
  duration: z.number().optional(),
  status: z.string().optional(),
  location: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

type CreateAppointmentConfig = z.infer<typeof CreateAppointmentConfigSchema>;

// Résultat structuré
interface CreateAppointmentResult {
  appointment_id: number;
  skipped?: boolean;
}

export class CreateAppointmentAction implements ActionHandler<CreateAppointmentConfig, FinalExecutionContext, CreateAppointmentResult> {
  name = 'create_appointment';

  async execute(
    context: FinalExecutionContext,
    config: CreateAppointmentConfig
  ): Promise<ActionResult<CreateAppointmentResult>> {
    try {
      // BLOC AUDIT : Validation stricte de la config
      const validatedConfig = CreateAppointmentConfigSchema.parse(config);

      const db = getDbInstance();
      if (!db) throw new Error("Database not available");

      const prospectId: number | undefined =
        validatedConfig.prospect_id ?? (context.variables.prospect as any)?.id;

      // 1. Idempotency Check
      const idempotencyKey = IdempotencyService.generateKey({
        prospectId,
        title: validatedConfig.title,
        scheduledAt: validatedConfig.scheduled_at,
        eventId: context.event.id
      });

      const isFirstTime = await IdempotencyService.checkAndSet(idempotencyKey, 'create_appointment');
      if (!isFirstTime) {
        logger.info('[CreateAppointmentAction] Duplicate detected, skipping', { prospectId });
        return { success: true, data: { appointment_id: 0, skipped: true } };
      }

      // 2. Data Preparation
      const scheduledAt = validatedConfig.scheduled_at
        ? new Date(validatedConfig.scheduled_at)
        : new Date(Date.now() + 24 * 60 * 60 * 1000);

      const appointmentData = {
        tenantId: context.tenant.id,
        prospectId: prospectId ?? undefined,
        title: validatedConfig.title ?? 'Rendez-vous',
        description: validatedConfig.description ?? `RDV créé par workflow: ${context.workflow.name}`,
        startTime: scheduledAt,
        endTime: new Date(scheduledAt.getTime() + (validatedConfig.duration ?? 30) * 60 * 1000),
        status: validatedConfig.status ?? 'scheduled',
        location: validatedConfig.location ?? '',
        metadata: {
          workflow_id: context.workflow.id,
          workflow_execution_id: context.event.id,
          created_by: 'workflow',
          ...(validatedConfig.metadata ?? {}),
        }
      };

      // 3. Atomic Mutation
      const [result] = await db.insert(appointments).values(appointmentData as any).returning();
      const appointmentId = result?.id ?? 0;

      // 4. Audit Logging
      await AuditService.log({
        tenantId: context.tenant.id,
        userId: Number(context.event.metadata?.triggered_by) || 0,
        action: "RESOURCE_CREATE",
        resource: "appointment",
        resourceId: appointmentId,
        actorType: "system",
        source: "SYSTEM",
        metadata: {
          prospectId,
          scheduledAt: appointmentData.startTime,
          title: appointmentData.title
        }
      });

      // Stocker le rendez-vous dans le contexte structuré
      context.variables.appointment = result as Record<string, unknown>;

      logger.info('[CreateAppointmentAction] Appointment created', {
        appointment_id: appointmentId,
        tenant: context.tenant.id
      });

      return { success: true, data: { appointment_id: appointmentId } };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error('[CreateAppointmentAction] Failed to create appointment', { error: msg });
      return {
        success: false,
        error: msg
      };
    }
  }

  validate(config: Record<string, unknown>): boolean {
    try {
      CreateAppointmentConfigSchema.parse(config);
      return true;
    } catch {
      return false;
    }
  }
}
