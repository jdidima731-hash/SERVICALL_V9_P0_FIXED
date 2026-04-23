/**
 * CREATE LEAD ACTION
 * Intégré avec le service Prospect de ServiceCall
 * ✅ BLOC 3 : Validation robuste et Fallback intelligent
 */

import { z } from "zod";
import type { ActionHandler, ActionResult, ProspectData } from "../../types";
import type { FinalExecutionContext } from "../structured-types";
import { getDbInstance } from "../../../../server/db";
import { prospects } from "../../../../drizzle/schema";
import { Logger } from "../../infrastructure/logger";
import { IdempotencyService } from "../../utils/IdempotencyService";

// Configuration structurée
const CreateLeadConfigSchema = z.object({
  phone: z.string().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  email: z.string().email("Format email invalide").optional(),
  source: z.string().optional(),
  notes: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
type CreateLeadConfig = z.infer<typeof CreateLeadConfigSchema>;

// Résultat structuré
interface CreateLeadResult {
  prospect_id: number;
  status: 'created' | 'already_exists';
}

export class CreateLeadAction implements ActionHandler<CreateLeadConfig, FinalExecutionContext, CreateLeadResult> {
  name = 'create_lead';
  private logger = new Logger('CreateLeadAction');

  async execute(
    context: FinalExecutionContext,
    config: CreateLeadConfig
  ): Promise<ActionResult<CreateLeadResult>> {
    try {
      // BLOC AUDIT : Validation stricte de la config
      const validatedConfig = CreateLeadConfigSchema.parse(config);

      // Accès typé via les variables structurées
      const phone =
        config.phone ??
        context.variables.phone ??
        context.event.source;

      const idempotencyKey = IdempotencyService.generateKey({ phone, eventId: context.event.id });
      const isFirstTime = await IdempotencyService.checkAndSet(idempotencyKey, 'create_lead');

      if (!isFirstTime) {
        this.logger.info('Duplicate lead creation detected, skipping', { phone });
        return { success: true, data: { status: 'already_exists', prospect_id: 0 } };
      }

      const prospectData = {
        tenantId: context.tenant.id,
        firstName: config.firstName ?? 'Prospect',
        lastName: config.lastName ?? 'Inconnu',
        email: config.email ?? context.variables.email,
        phone: phone,
        source: config.source ?? context.event.channel ?? 'workflow',
        notes: config.notes ?? `Créé automatiquement par workflow: ${context.workflow.name}`,
        metadata: {
          ...(config.metadata ?? {}),
          workflow_execution_id: context.event.id,
          created_at: new Date().toISOString()
        }
      };

      this.logger.info('Creating prospect', { phone: prospectData.phone });
      
      const db = getDbInstance();
      const [prospect] = await db.insert(prospects).values(prospectData as never).returning();

      // Mise à jour du contexte structuré
      context.variables.prospect = prospect as ProspectData;
      
      context.variables['prospect_id'] = prospect.id;

      return {
        success: true,
        
        data: { prospect_id: prospect.id, status: 'created' }
      };
    } catch (error: unknown) {
      this.logger.error('Failed to create prospect', { error });
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  validate(config: Record<string, unknown>): boolean {
    const result = CreateLeadConfigSchema.safeParse(config);
    if (!result.success) {
      this.logger.warn('Validation failed', { errors: result.error.format() });
      return false;
    }
    return true;
  }
}