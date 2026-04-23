/**
 * Dependency Injection Container
 * ✅ FIX P4.3: Centraliser la création des services
 * 
 * Avantages :
 * - Services découplés et testables
 * - Injection facile des dépendances
 * - Configuration centralisée
 */

import {}
from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type * as schema from "../../../drizzle/schema";
type Database = PostgresJsDatabase<typeof schema>;
import { ProspectRepository } from "../../repositories/ProspectRepository";
import { ProspectDomainService } from "../../domain/services/ProspectDomainService";
import { BillingRepository } from "../../repositories/BillingRepository";
import { logger } from "../logger";

export class DIContainer {
  private db: Database;
  private cache: Map<string, any> = new Map();

  constructor(db: Database) {
    this.db = db;
    logger.debug("[DIContainer] Container initialized");
  }

  /**
   * ✅ FIX P4.3: Créer ou récupérer un service (singleton)
   */
  private getOrCreate<T>(key: string, factory: () => T): T {
    if (this.cache.has(key)) {
      return this.cache.get(key);
    }

    const instance = factory();
    this.cache.set(key, instance);
    logger.debug("[DIContainer] Service created", { service: key });
    return instance;
  }

  /**
   * ✅ FIX P4.3: Factory pour ProspectRepository
   */
  prospectRepository(): ProspectRepository {
    return this.getOrCreate("prospectRepository", () => new ProspectRepository(this.db));
  }

  /**
   * ✅ FIX P4.3: Factory pour ProspectDomainService
   */
  prospectService(): ProspectDomainService {
    return this.getOrCreate("prospectService", () => {
      const repo = this.prospectRepository();
      return new ProspectDomainService(repo);
    });
  }

  /**
   * ✅ FIX P4.3: Factory pour BillingRepository
   */
  billingRepository(): BillingRepository {
    return this.getOrCreate("billingRepository", () => new BillingRepository(this.db));
  }

  /**
   * ✅ FIX P4.3: Réinitialiser le container (pour les tests)
   */
  reset(): void {
    this.cache.clear();
    logger.debug("[DIContainer] Container reset");
  }

  /**
   * ✅ FIX P4.3: Obtenir les statistiques du container
   */
  getStats(): Record<string, number> {
    return {
      cachedServices: this.cache.size,
    };
  }
}

// ✅ FIX P4.3: Instance singleton du container
let containerInstance: DIContainer | null = null;

export function initDIContainer(db: Database): DIContainer {
  containerInstance = new DIContainer(db);
  return containerInstance;
}

export function getDIContainer(): DIContainer {
  if (!containerInstance) {
    throw new Error("DIContainer not initialized. Call initDIContainer first.");
  }
  return containerInstance;
}

export function resetDIContainer(): void {
  if (containerInstance) {
    containerInstance.reset();
  }
}
