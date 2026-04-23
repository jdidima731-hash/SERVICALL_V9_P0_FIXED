/**
 * BLOC 8 : Validation des Campagnes
 * Valide les données des campagnes avant création
 */


export interface Campaign {
  name: string;
  description?: string;
  type: "ai_qualification" | "human_appointment" | "hybrid_reception";
  status?: "draft" | "active" | "paused" | "completed";
  startDate?: Date;
  endDate?: Date;
  dailyBudget?: number;
  totalBudget?: number;
  workflowId?: number;
}

export class CampaignValidator {
  /**
   * Valider les données d'une campagne
   */
  static validate(campaign: Campaign): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Vérifier le nom
    if (!campaign.name || campaign.name.trim().length === 0) {
      errors.push("Campaign name is required");
    }

    if (campaign.name && campaign.name.length < 3) {
      errors.push("Campaign name must be at least 3 characters");
    }

    if (campaign.name && campaign.name.length > 255) {
      errors.push("Campaign name must be less than 255 characters");
    }

    // Vérifier la description
    if (campaign.description && campaign.description.length > 1000) {
      errors.push("Description must be less than 1000 characters");
    }

    // Vérifier le type
    const validTypes = ["ai_qualification", "human_appointment", "hybrid_reception"];
    if (!validTypes.includes(campaign.type)) {
      errors.push(`Invalid campaign type. Must be one of: ${validTypes.join(", ")}`);
    }

    // Vérifier les dates
    if (campaign.startDate && campaign.endDate) {
      if (campaign.endDate <= campaign.startDate) {
        errors.push("End date must be after start date");
      }

      // Vérifier que la campagne n'est pas trop longue (max 1 an)
      const durationMs = campaign.endDate.getTime() - campaign.startDate.getTime();
      if (durationMs > 365 * 24 * 60 * 60 * 1000) {
        errors.push("Campaign duration cannot exceed 365 days");
      }
    }

    // Vérifier les budgets
    if (campaign.dailyBudget && campaign.dailyBudget <= 0) {
      errors.push("Daily budget must be greater than 0");
    }

    if (campaign.totalBudget && campaign.totalBudget <= 0) {
      errors.push("Total budget must be greater than 0");
    }

    // Vérifier la cohérence des budgets
    if (campaign.dailyBudget && campaign.totalBudget) {
      if (campaign.dailyBudget > campaign.totalBudget) {
        errors.push("Daily budget cannot exceed total budget");
      }

      // Vérifier si le budget journalier est réaliste
      if (campaign.startDate && campaign.endDate) {
        const durationDays = Math.ceil(
          (campaign.endDate.getTime() - campaign.startDate.getTime()) / (1000 * 60 * 60 * 24)
        );
        const estimatedTotal = campaign.dailyBudget * durationDays;

        if (estimatedTotal > campaign.totalBudget * 1.1) {
          // Tolérance de 10%
          errors.push(
            `Daily budget (${campaign.dailyBudget}) × duration (${durationDays} days) exceeds total budget (${campaign.totalBudget})`
          );
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Formater une campagne pour l'affichage
   */
  static format(campaign: Campaign): string {
    const dates = campaign.startDate && campaign.endDate
      ? ` (${campaign.startDate.toLocaleDateString()} - ${campaign.endDate.toLocaleDateString()})`
      : "";
    return `${campaign.name}${dates}`;
  }

  /**
   * Estimer le budget total basé sur le budget journalier et la durée
   */
  static estimateBudget(dailyBudget: number, startDate: Date, endDate: Date): number {
    const durationDays = Math.ceil(
      (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    return dailyBudget * durationDays;
  }
}
