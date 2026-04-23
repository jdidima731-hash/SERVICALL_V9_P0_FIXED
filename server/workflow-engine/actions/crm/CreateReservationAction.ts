/**
 * CREATE RESERVATION ACTION
 * Crée une réservation (restaurant, hôtel, taxi, etc.)
 */

import { z } from "zod";
import type { ActionHandler, ActionResult } from "@server/workflow-engine/types";
import type { FinalExecutionContext } from "@server/workflow-engine/structured-types";
import { Logger } from "@server/infrastructure/logger";
import { getDbInstance, prospects } from "@server/db";
import { eq } from "drizzle-orm";

const CreateReservationConfigSchema = z.object({
  prospect_id: z.number().optional(),
  phone: z.string().optional(),
  customer_name: z.string().optional(),
  customer_email: z.string().email().optional(),
  type: z.string().optional(),
  date: z.string().optional(),
  time: z.string().optional(),
  number_of_people: z.number().optional(),
  special_requests: z.string().optional(),
  status: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
type CreateReservationConfig = z.infer<typeof CreateReservationConfigSchema>;

export class CreateReservationAction implements ActionHandler<CreateReservationConfig, FinalExecutionContext, Record<string, unknown>> {
  name = 'create_reservation';
  private logger = new Logger('CreateReservationAction');

  async execute(
    context: FinalExecutionContext,
    config: CreateReservationConfig
  ): Promise<ActionResult<Record<string, unknown>>> {
    try {
      // BLOC AUDIT : Validation stricte de la config
      const validatedConfig = CreateReservationConfigSchema.parse(config);

      const prospectId: number | undefined =
        config.prospect_id ?? context.variables.prospect?.id;

      if (prospectId) {
        const db = getDbInstance();
        const prospectExists = await db
          .select()
          .from(prospects)
          .where(eq(prospects.id, prospectId))
          .limit(1);
        if (prospectExists.length === 0) {
          throw new Error(`Cannot create reservation: Prospect ${prospectId} not found`);
        }
      }

      const phone =
        config.phone ??
        context.variables.caller_phone ??
        context.event.source;

      const reservationData: Record<string, unknown> = {
        tenant_id: context.tenant.id,
        prospect_id: prospectId,
        customer_name: config.customer_name ?? context.variables.prospect?.firstName,
        customer_phone: phone,
        customer_email: config.customer_email ?? context.variables.prospect?.email,
        reservation_type: config.type ?? 'general',
        reservation_date: config.date
          ? new Date(config.date)
          : new Date(Date.now() + 24 * 60 * 60 * 1000),
        reservation_time: config.time ?? '19:00',
        number_of_people: config.number_of_people ?? 2,
        special_requests: config.special_requests ?? '',
        status: config.status ?? 'confirmed',
        metadata: {
          workflow_id: context.workflow.id,
          workflow_execution_id: context.event.id,
          created_by: 'workflow',
          ...(config.metadata ?? {}),
        },
        created_at: new Date()
      };

      context.variables.reservation = reservationData;
      context.variables.reservation_id = `res_${Date.now()}`;

      this.logger.info('Reservation created', {
        type: reservationData['reservation_type'],
        date: reservationData['reservation_date'],
        customer: reservationData['customer_name'],
        tenant: context.tenant.id
      });

      return { success: true, data: reservationData };

    } catch (error: unknown) {
      this.logger.error('Failed to create reservation', { error });
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  validate(config: Record<string, unknown>): boolean {
    try {
      CreateReservationConfigSchema.parse(config);
      return true;
    } catch {
      return false;
    }
  }
}
