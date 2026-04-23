import { logger } from '../infrastructure/logger';
import { invokeLLM } from "../_core/llm";
import { AI_MODEL } from "../_core/aiModels";

/**
 * IT KNOWLEDGE SERVICE
 * Gère la recherche de solutions techniques avec une approche hybride :
 * 1. Recherche dans la base de connaissances locale (RAG)
 * 2. Fallback sur une recherche Web (si nécessaire)
 */

export interface KnowledgeResult {
  solution: string;
  source: 'local' | 'web';
  confidence: number;
}

export class ITKnowledgeService {
  /**
   * Recherche une solution pour un problème donné
   */
  // ✅ BLOC 1 FIX (TS2554) : tenantId requis par invokeLLM(tenantId, params)
  async findSolution(problemDescription: string, tenantId: number = 1): Promise<KnowledgeResult> {
    logger.info('[IT Knowledge] Searching for solution', { problemDescription });

    // 1. TENTATIVE : Recherche Locale (Simulation de RAG/Base de données)
    const localSolution = await this.searchLocalBase(problemDescription);
    
    if (localSolution && localSolution.confidence > 0.8) {
      logger.info('[IT Knowledge] Local solution found', { confidence: localSolution.confidence });
      return localSolution;
    }

    // 2. FALLBACK : Recherche Web (Simulation d'appel API type Perplexity/Tavily)
    logger.warn('[IT Knowledge] Local solution insufficient, falling back to Web search');
    const webSolution = await this.searchWeb(problemDescription, tenantId);
    
    // 3. AUTO-ENRICHISSEMENT : On pourrait ici sauvegarder la solution web en local pour la prochaine fois
    if (webSolution.confidence > 0.5) {
      await this.saveToLocalBase(problemDescription, webSolution.solution);
    }

    return webSolution;
  }

  /**
   * Simule une recherche dans une base de données vectorielle locale
   */
  private async searchLocalBase(query: string): Promise<KnowledgeResult | null> {
    // En production, ceci ferait une recherche vectorielle (Embeddings + Vector DB)
    // Pour l'exemple, on simule une réponse si certains mots clés sont présents
    const q = query.toLowerCase();
    if (q.includes('wifi') || q.includes('internet') || q.includes('connexion')) {
      return {
        solution: "Vérifiez que le routeur est allumé. Redémarrez la box en débranchant la prise pendant 30 secondes. Si le voyant reste rouge, contactez l'opérateur.",
        source: 'local',
        confidence: 0.9
      };
    }
    return null;
  }

  /**
   * Simule une recherche Web via LLM avec accès internet
   */
  private async searchWeb(query: string, tenantId: number = 1): Promise<KnowledgeResult> {
    try {
      // En production, on utiliserait un outil comme Tavily ou Perplexity API
      // Ici on simule l'appel LLM qui ferait la recherche
      // ✅ BLOC 1 FIX (TS2554) : invokeLLM requiert (tenantId: number, params: InvokeParams)
      const response = await invokeLLM(tenantId, {
        model: AI_MODEL.DEFAULT,
        messages: [
          { role: 'system', content: 'Tu es un expert IT avec accès à internet. Trouve une solution précise à ce problème technique.' },
          { role: 'user', content: query }
        ]
      });

      return {
        solution: (typeof response.choices[0]!.message.content === "string" ? response.choices[0]!.message.content : null) || "Désolé, aucune solution trouvée sur le web.",
        source: 'web',
        confidence: 0.7
      };
    } catch (error: any) {
      logger.error('[IT Knowledge] Web search failed', error);
      return {
        solution: "Erreur lors de la recherche en ligne.",
        source: 'web',
        confidence: 0
      };
    }
  }

  /**
   * Sauvegarde une nouvelle solution en local pour enrichir la base
   */
  private async saveToLocalBase(_problem: string, _solution: string) {
    logger.info('[IT Knowledge] Auto-enriching local base with new solution');
    // Logique de sauvegarde en DB ici
  }
}

export const itKnowledgeService = new ITKnowledgeService();
