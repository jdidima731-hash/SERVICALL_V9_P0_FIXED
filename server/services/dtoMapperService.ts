/**
 * BLOC 2 — DTO MAPPER SERVICE
 * ────────────────────────────────────────────────────────
 * Service centralisé pour transformer les modèles Drizzle en DTOs.
 * Point unique de transformation entre la couche données et l'API.
 */

import {
  mapToTenantDTO,
  mapToTenantSettingsDTO,
  mapToTenantIndustryConfigDTO,
  mapToTenantProfileDTO,
  type TenantDTO,
  type TenantSettingsDTO,
  type TenantIndustryConfigDTO,
  type TenantProfileDTO,
} from "@shared/dto/tenant.dto";
import {
  mapToUserPublicDTO,
  mapToUserProfileDTO,
  mapToUserAgentDTO,
  mapToTenantUserDTO,
  type UserPublicDTO,
  type UserProfileDTO,
  type UserAgentDTO,
  type TenantUserDTO,
} from "@shared/dto/user.dto";
import { logger } from "../infrastructure/logger";

export class DTOMapperService {
  // ============================================
  // TENANT MAPPERS
  // ============================================

  static mapTenant(raw: unknown): TenantDTO {
    try {
      return mapToTenantDTO(raw);
    } catch (error) {
      logger.error("DTO: Tenant mapping failed", { error, raw });
      throw error;
    }
  }

  static mapTenantSettings(raw: unknown): TenantSettingsDTO {
    try {
      return mapToTenantSettingsDTO(raw);
    } catch (error) {
      logger.error("DTO: Tenant Settings mapping failed", { error, raw });
      throw error;
    }
  }

  static mapTenantIndustryConfig(raw: unknown): TenantIndustryConfigDTO {
    try {
      return mapToTenantIndustryConfigDTO(raw);
    } catch (error) {
      logger.error("DTO: Tenant Industry Config mapping failed", { error, raw });
      throw error;
    }
  }

  static mapTenantProfile(
    tenant: unknown,
    settings?: unknown,
    industryConfig?: unknown
  ): TenantProfileDTO {
    try {
      return mapToTenantProfileDTO(tenant, settings, industryConfig);
    } catch (error) {
      logger.error("DTO: Tenant Profile mapping failed", { error });
      throw error;
    }
  }

  // ============================================
  // USER MAPPERS
  // ============================================

  static mapUserPublic(raw: unknown): UserPublicDTO {
    try {
      return mapToUserPublicDTO(raw);
    } catch (error) {
      logger.error("DTO: User Public mapping failed", { error, raw });
      throw error;
    }
  }

  static mapUserProfile(raw: unknown): UserProfileDTO {
    try {
      return mapToUserProfileDTO(raw);
    } catch (error) {
      logger.error("DTO: User Profile mapping failed", { error, raw });
      throw error;
    }
  }

  static mapUserAgent(raw: unknown): UserAgentDTO {
    try {
      return mapToUserAgentDTO(raw);
    } catch (error) {
      logger.error("DTO: User Agent mapping failed", { error, raw });
      throw error;
    }
  }

  static mapTenantUser(raw: unknown, user: unknown): TenantUserDTO {
    try {
      return mapToTenantUserDTO(raw, user);
    } catch (error) {
      logger.error("DTO: Tenant User mapping failed", { error, raw });
      throw error;
    }
  }

  // ============================================
  // BATCH MAPPERS
  // ============================================

  static mapTenants(items: unknown[]): TenantDTO[] {
    return items.map(item => this.mapTenant(item));
  }

  static mapUsers(items: unknown[]): UserPublicDTO[] {
    return items.map(item => this.mapUserPublic(item));
  }
}

export const dtoMapperService = new DTOMapperService();
