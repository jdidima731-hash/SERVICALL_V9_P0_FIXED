/**
 * CREATE DONATION ACTION
 * Crée une demande de don pour les associations et ONG
 * ✅ BLOC AUDIT : Durcissement Zod et Types structurés
 */

import { z } from "zod";
import type { ActionHandler, ActionResult } from "../../types";
import type { FinalExecutionContext } from "../structured-types";
import { Logger } from "../../infrastructure/logger";

const CreateDonationConfigSchema = z.object({
  prospect_id: z.number().optional(),
  amount: z.number().min(0, "Le montant ne peut pas être négatif"),
  donor_name: z.string().optional(),
  donor_email: z.string().email("Format d'email invalide").optional(),
  donor_phone: z.string().optional(),
  currency: z.string().default('EUR'),
  campaign: z.string().default('general'),
  is_recurring: z.boolean().default(false),
  frequency: z.enum(['one_time', 'monthly', 'yearly']).default('one_time'),
  status: z.enum(['pledged', 'paid', 'cancelled']).default('pledged'),
  tax_receipt: z.boolean().default(true),
  metadata: z.record(z.unknown()).optional(),
});

type CreateDonationConfig = z.infer<typeof CreateDonationConfigSchema>;

interface CreateDonationResult {
  donation_id: string;
  amount: number;
  currency: string;
  status: string;
}

export class CreateDonationAction implements ActionHandler<CreateDonationConfig, FinalExecutionContext, CreateDonationResult> {
  name = 'create_donation';
  private logger = new Logger('CreateDonationAction');

  async execute(context: FinalExecutionContext, config: CreateDonationConfig): Promise<ActionResult<CreateDonationResult>> {
    try {
      // BLOC AUDIT : Validation stricte de la config
      const validatedConfig = CreateDonationConfigSchema.parse(config);

      const prospectId = validatedConfig.prospect_id || context.variables.prospect?.id;
      const donorName = validatedConfig.donor_name || context.variables.prospect?.firstName;
      const donorEmail = validatedConfig.donor_email || context.variables.email || context.variables.prospect?.email;
      const donorPhone = validatedConfig.donor_phone || context.variables.phone || context.variables.caller_phone;

      const donationData = {
        tenant_id: context.tenant.id,
        prospect_id: prospectId,
        donation_id: `DON-${Date.now()}`,
        donor_name: donorName,
        donor_email: donorEmail,
        donor_phone: donorPhone,
        amount: validatedConfig.amount,
        currency: validatedConfig.currency,
        campaign: validatedConfig.campaign,
        is_recurring: validatedConfig.is_recurring,
        frequency: validatedConfig.frequency,
        status: validatedConfig.status,
        payment_status: 'pending',
        tax_receipt_requested: validatedConfig.tax_receipt,
        created_at: new Date(),
        metadata: {
          workflow_id: context.workflow.id,
          workflow_execution_id: context.event.id,
          source: 'phone_campaign',
          ...validatedConfig.metadata
        }
      };

      // Stocker le don dans le contexte
      context.variables["donation"] = donationData;
      context.variables["donation_id"] = donationData.donation_id;
      context.variables["donation_amount"] = donationData.amount;

      this.logger.info('Donation created', { 
        donation_id: donationData.donation_id,
        amount: donationData.amount,
        donor: donorName,
        campaign: donationData.campaign,
        tenant: context.tenant.id 
      });

      return {
        success: true,
        data: {
          donation_id: donationData.donation_id,
          amount: donationData.amount,
          currency: donationData.currency,
          status: donationData.status
        }
      };

    } catch (error: unknown) {
      this.logger.error('Failed to create donation', { error });
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  validate(config: Record<string, unknown>): boolean {
    try {
      CreateDonationConfigSchema.parse(config);
      return true;
    } catch {
      return false;
    }
  }
}
