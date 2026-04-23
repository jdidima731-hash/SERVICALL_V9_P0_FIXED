/**
 * Prospect Domain Service — Logique métier isolée
 * ✅ FIX P4.3: Découplage de la couche tRPC
 * 
 * Responsabilités :
 * - Validation métier
 * - Orchestration des opérations
 * - Indépendant de tRPC/HTTP
 */

import { ProspectRepository } from "../../repositories/ProspectRepository";
import { logger } from "../../infrastructure/logger";
import { Errors } from "../../config/appErrors";
import { recordProspectMetric } from "../../infrastructure/metrics/customMetrics";

export class ProspectDomainService {
  constructor(private prospectRepo: ProspectRepository) {}

  /**
   * ✅ FIX P4.3: Créer un prospect avec validation métier
   */
  async createProspect(
    tenantId: number,
    data: {
      firstName: string;
      lastName: string;
      phone: string;
      email?: string;
    }
  ) {
    try {
      // Validation métier
      if (!data.firstName || !data.firstName.trim()) {
        throw Errors.INVALID_INPUT("firstName", "Le prénom est requis");
      }

      if (!data.lastName || !data.lastName.trim()) {
        throw Errors.INVALID_INPUT("lastName", "Le nom est requis");
      }

      if (!data.phone || !data.phone.trim()) {
        throw Errors.INVALID_INPUT("phone", "Le téléphone est requis");
      }

      // Vérifier que le prospect n'existe pas déjà
      // (Logique métier : pas de doublons par téléphone)
      // const existing = await this.prospectRepo.findByPhone(data.phone, tenantId);
      // if (existing) {
      //   throw Errors.CONFLICT("Un prospect avec ce téléphone existe déjà");
      // }

      // Créer le prospect
      const prospect = await this.prospectRepo.create(tenantId, {
        ...data,
        status: "new",
      });

      // Enregistrer la métrique
      recordProspectMetric(tenantId);

      logger.info("[ProspectDomainService] Prospect created", {
        prospectId: prospect.id,
        tenantId,
        firstName: data.firstName,
      });

      return prospect;
    } catch (error: unknown) {
      logger.error("[ProspectDomainService] Failed to create prospect", {
        tenantId,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      throw error;
    }
  }

  /**
   * ✅ FIX P4.3: Qualifier un prospect (logique métier)
   */
  async qualifyProspect(prospectId: number, tenantId: number) {
    try {
      const prospect = await this.prospectRepo.findById(prospectId, tenantId);

      if (!prospect) {
        throw Errors.NOT_FOUND("Prospect");
      }

      // Logique métier : vérifier les conditions de qualification
      if (!prospect.phone) {
        throw Errors.INVALID_INPUT("phone", "Numéro requis pour qualifier");
      }

      // Logique métier : ne pas qualifier les prospects déjà qualifiés
      if (prospect.status === "qualified") {
        throw Errors.CONFLICT("Ce prospect est déjà qualifié");
      }

      const updated = await this.prospectRepo.update(prospectId, tenantId, {
        status: "qualified",
      });

      logger.info("[ProspectDomainService] Prospect qualified", {
        prospectId,
        tenantId,
      });

      return updated;
    } catch (error: unknown) {
      logger.error("[ProspectDomainService] Failed to qualify prospect", {
        prospectId,
        tenantId,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      throw error;
    }
  }

  /**
   * ✅ FIX P4.3: Convertir un prospect (logique métier)
   */
  async convertProspect(prospectId: number, tenantId: number) {
    try {
      const prospect = await this.prospectRepo.findById(prospectId, tenantId);

      if (!prospect) {
        throw Errors.NOT_FOUND("Prospect");
      }

      // Logique métier : ne convertir que les prospects qualifiés
      if (prospect.status !== "qualified") {
        throw Errors.CONFLICT("Seuls les prospects qualifiés peuvent être convertis");
      }

      const updated = await this.prospectRepo.update(prospectId, tenantId, {
        status: "converted",
      });

      logger.info("[ProspectDomainService] Prospect converted", {
        prospectId,
        tenantId,
      });

      return updated;
    } catch (error: unknown) {
      logger.error("[ProspectDomainService] Failed to convert prospect", {
        prospectId,
        tenantId,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      throw error;
    }
  }

  /**
   * ✅ FIX P4.3: Obtenir les statistiques des prospects
   */
  async getProspectStats(tenantId: number) {
    try {
      // Logique métier : agrégation des données
      const allProspects = await this.prospectRepo.findAll(tenantId, 1000, 0);

      const stats = {
        total: allProspects.length,
        byStatus: {
          new: allProspects.filter((p) => p.status === "new").length,
          qualified: allProspects.filter((p) => p.status === "qualified").length,
          converted: allProspects.filter((p) => p.status === "converted").length,
          lost: allProspects.filter((p) => p.status === "lost").length,
        },
        conversionRate:
          allProspects.length > 0
            ? (allProspects.filter((p) => p.status === "converted").length /
                allProspects.length) *
              100
            : 0,
      };

      logger.debug("[ProspectDomainService] Stats calculated", {
        tenantId,
        stats,
      });

      return stats;
    } catch (error: unknown) {
      logger.error("[ProspectDomainService] Failed to get stats", {
        tenantId,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      throw error;
    }
  }
}
