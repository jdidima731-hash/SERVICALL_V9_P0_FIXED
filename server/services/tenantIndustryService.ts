/**
 * TENANT INDUSTRY SERVICE
 * Gestion de la configuration métier par tenant
 * Sélection du métier, activation des capacités et workflows
 */

import { logger } from "../infrastructure/logger";
import * as db from '../db-industry';
import INDUSTRIES_CATALOG from '../config/INDUSTRIES_CATALOG.json';

// ─── Typed catalog ────────────────────────────────────────────────────────────

interface IndustryEntry {
  id: string;
  name: string;
  category: string;
  description: string;
  icon: string;
  capabilities: string[];
  systemPrompt: string;
  workflows?: string[];
  [key: string]: any;
}

interface IndustriesCatalog {
  industries: Record<string, IndustryEntry>;
  capabilities: Record<string, string>;
}

const catalog = INDUSTRIES_CATALOG as IndustriesCatalog;

export interface IndustryConfig {
  industryId: string;
  enabledCapabilities: string[];
  enabledWorkflows: string[];
  aiSystemPrompt: string;
}

/**
 * Récupère le catalogue complet des métiers
 */
export function getIndustriesCatalog() {
  return catalog.industries || {};
}

/**
 * Récupère les détails d'un métier spécifique
 */
export function getIndustryDetails(industryId: string) {
  // ✅ BLOC 3: Validation stricte du catalogue
  if (!INDUSTRIES_CATALOG || typeof INDUSTRIES_CATALOG !== 'object') {
    throw new Error('INDUSTRIES_CATALOG is not properly loaded');
  }
  
  const industries = catalog.industries;
  if (!industries || typeof industries !== 'object') {
    throw new Error('INDUSTRIES_CATALOG.industries is not properly structured');
  }
  
  const industry = industries[industryId];
  
  if (!industry) {
    throw new Error(`Industry ${industryId} not found in catalog`);
  }

  return industry;
}

/**
 * Récupère la configuration métier d'un tenant
 */
export async function getTenantIndustryConfig(tenantId: number): Promise<IndustryConfig | null> {
  try {
    const config = await db.getTenantIndustryConfig(tenantId);
    
    if (!config) {
      return null;
    }

    return {
      industryId: config.industryId,
      
      enabledCapabilities: config.enabledCapabilities || [],
      
      enabledWorkflows: config.enabledWorkflows || [],
      aiSystemPrompt: config.aiSystemPrompt ?? '',
    };
  } catch (error: any) {
    logger.error('[TenantIndustryService] Failed to get industry config', error, { tenantId });
    throw error;
  }
}

/**
 * Définit la configuration métier d'un tenant
 */
export async function setTenantIndustryConfig(
  tenantId: number,
  industryId: string,
  enabledCapabilities: string[] = [],
  enabledWorkflows: string[] = []
): Promise<IndustryConfig> {
  try {
    // Validation du métier
    const industry = getIndustryDetails(industryId);

    // ✅ BLOC 3: Validation stricte avant opérateur 'in' (prévention TypeError)
    const catalogCapabilities = catalog.capabilities;
    const industryCapabilities = Array.isArray(industry.capabilities) ? industry.capabilities : [];
    
    const validCapabilities = enabledCapabilities.filter(cap => {
      // Vérification défensive : catalogCapabilities doit être un objet non-null
      const isInCatalog = catalogCapabilities && typeof catalogCapabilities === 'object' && cap in catalogCapabilities;
      const isInIndustry = industryCapabilities.includes(cap);
      return isInCatalog || isInIndustry;
    });

    // ✅ BLOC 3: Validation stricte des workflows
    const industryWorkflows = Array.isArray(industry.workflows) ? industry.workflows : [];
    const validWorkflows = enabledWorkflows.filter(wf => {
      if (typeof wf !== 'string') return false;
      // Vérifier si le workflow existe directement ou via son ID
      return industryWorkflows.includes(wf) || 
             industryWorkflows.some((w: any) => {
               if (typeof w === 'string') return w === wf;
               if (w && typeof w === 'object' && 'id' in w) return w.id === wf;
               return false;
             });
    });

    // Récupération du prompt système
    const aiSystemPrompt = (industry.aiSystemPrompt || industry.systemPrompt) ?? '';

    // Sauvegarde en base
    await db.saveTenantIndustryConfig(tenantId, {
      industryId,
      enabledCapabilities: validCapabilities,
      enabledWorkflows: validWorkflows,
      aiSystemPrompt,
    });

    logger.info('[TenantIndustryService] Industry config updated', {
      tenantId,
      industryId,
      capabilitiesCount: validCapabilities.length,
      workflowsCount: validWorkflows.length,
    });

    return {
      industryId,
      enabledCapabilities: validCapabilities,
      enabledWorkflows: validWorkflows,
      aiSystemPrompt,
    };
  } catch (error: any) {
    logger.error('[TenantIndustryService] Failed to set industry config', { 
      message: error instanceof Error ? (error instanceof Error ? error.message : String(error)) : String(error),
      tenantId, 
      industryId 
    });
    throw error;
  }
}

/**
 * Récupère les workflows standards d'un métier
 * ✅ FIX P0: Utilisation du BlueprintCatalogService canonique.
 */
export async function getIndustryWorkflows(industryId: string) {
  try {
    const { BlueprintCatalogService } = await import("./blueprintCatalogService");
    
    // Récupérer les IDs de workflows recommandés depuis le catalogue
    const industryConfig = catalog.industries[industryId];
    const recommendedIds: string[] = industryConfig?.workflows || [];
    
    // Stratégie : On délègue le filtrage au service de catalogue
    // qui est la source de vérité unique (JSON).
    const allBlueprints = await BlueprintCatalogService.list({ limit: 1000, offset: 0 });
    
    // 1. Priorité aux IDs recommandés (si présents et valides)
    if (recommendedIds.length > 0) {
      const recommended = allBlueprints.filter((bp: any) => recommendedIds.includes(bp.id));
      if (recommended.length > 0) return recommended;
    }
    
    // 2. Fallback : Filtrage par catégorie/industrie dans le catalogue
    return allBlueprints.filter((bp: any) => 
      bp.industry === industryId || 
      bp.industry?.toLowerCase().replace(/[-_]/g, '') === industryId?.toLowerCase().replace(/[-_]/g, '')
    );
  } catch (error: any) {
    logger.error('[TenantIndustryService] Failed to load industry workflows', error, { industryId });
    return [];
  }
}

/**
 * Récupère les capacités recommandées pour un métier
 */
export function getIndustryCapabilities(industryId: string) {
  const industry = getIndustryDetails(industryId);
  return industry.capabilities || [];
}

/**
 * Génère le prompt système complet pour un tenant basé sur son métier
 */
export async function generateTenantSystemPrompt(tenantId: number, tenantName: string): Promise<string> {
  try {
    const config = await getTenantIndustryConfig(tenantId);
    
    if (!config) {
      return `Tu es un assistant IA professionnel pour ${tenantName}. Réponds en français de manière courtoise et efficace.`;
    }

    const industry = getIndustryDetails(config.industryId);
    const industryWorkflows = industry.workflows || [];
    
    // Construire le prompt avec les workflows activés
    const enabledWorkflowsInfo = config.enabledWorkflows
      .map(wfId => {
        const wf = industryWorkflows.find((w: any) => (w.id === wfId || w === wfId));
        const name = wf ? (typeof wf === 'object' ? (wf as unknown).name : String(wf)) : null;
        return name ? `- ${name}` : null;
      })
      .filter(Boolean)
      .join('\n');

    const systemPrompt = `${(industry.aiSystemPrompt || industry.systemPrompt) ?? ''}

CONTEXTE ENTREPRISE:
- Nom: ${tenantName}
- Métier: ${industry.name}
- Workflows activés:
${enabledWorkflowsInfo}

RÈGLES ABSOLUES:
1. Respecte strictement le rôle du métier
2. Ne fais jamais de promesses contractuelles sans validation
3. Escalade immédiatement les urgences ou situations hors de tes compétences
4. Sois courtois, professionnel et efficace
5. Réponds toujours en français`;

    return systemPrompt;
  } catch (error: any) {
    logger.error('[TenantIndustryService] Failed to generate system prompt', error, { tenantId });
    return `Tu es un assistant IA professionnel pour ${tenantName}. Réponds en français de manière courtoise et efficace.`;
  }
}

/**
 * Récupère tous les métiers disponibles (pour la page de configuration)
 */
export function getAllIndustries() {
  const industries = catalog.industries || {};
  
  return Object.values(industries).map(( industry: IndustryEntry) => ({
    id: industry.id,
    name: industry.name,
    category: industry.category ?? 'Autres',
    description: industry.description ?? '',
    icon: industry.icon ?? '',
    capabilities: industry.capabilities || [],
    workflowCount: Array.isArray(industry.workflows) ? industry.workflows.length : 0,
  }));
}

/**
 * Récupère les métiers par catégorie
 */
export function getIndustriesByCategory() {
  const industries = catalog.industries || {};
  const categorized: Record<string, any[]> = {};

  Object.values(industries).forEach(( industry: IndustryEntry) => {
    const category = industry.category ?? 'Autres';
    if (!categorized[category]) {
      categorized[category] = [];
    }
    categorized[category].push({
      id: industry.id,
      name: industry.name,
      description: industry.description ?? '',
      icon: industry.icon ?? '',
      capabilities: industry.capabilities || [],
    });
  });

  return categorized;
}