/**
 * Call Simulator Service - Simulation d'appels pour formation des agents
 * Permet aux agents de s'entraîner sur différents scénarios avec IA
 */

import { getDbInstance } from '../db';
import { simulatedCalls } from '../../drizzle/schema';
import { eq, and } from 'drizzle-orm';
import { logger as loggingService } from "../infrastructure/logger";
import * as aiService from './aiService';

interface SimulationScenario {
  id: string;
  name: string;
  description: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  customerProfile: {
    name: string;
    personality: string;
    mood: 'positive' | 'neutral' | 'negative' | 'hostile';
    objections: string[];
    buyingIntent: number; // 0-100
  };
  objectives: string[];
  successCriteria: {
    minDuration: number;
    requiredPoints: string[];
    maxObjectionsNotHandled: number;
  };
  script?: string;
}

interface SimulatedCall {
  id: string;
  scenarioId: string;
  agentId: number;
  tenantId: number;
  status: 'in_progress' | 'completed' | 'abandoned';
  transcript: Array<{
    timestamp: number;
    speaker: 'agent' | 'customer';
    text: string;
    sentiment?: number;
  }>;
  duration: number;
  score: number;
  feedback: {
    strengths: string[];
    weaknesses: string[];
    recommendations: string[];
  };
  objectivesAchieved: string[];
  startedAt: Date;
  completedAt?: Date;
}

type AgentAnalysis = {
  responseType: 'opening' | 'positive' | 'neutral' | 'objection' | 'closing';
  quality: number;
  handledObjection: boolean;
};

class CallSimulatorService {

  async listScenarios(tenantId: number): Promise<SimulationScenario[]> {
    // For now, return default scenarios. In a real app, this would fetch from DB.
    return this.DEFAULT_SCENARIOS;
  }

  async getAgentSimulationHistory(
    agentId: number,
    tenantId: number,
    limit: number
  ): Promise<SimulatedCall[]> {
    const db = getDbInstance();
    if (!db) {
      throw new Error('Database not available');
    }
    
    return db.query.simulatedCalls.findMany({
      where: and(eq(simulatedCalls.agentId, agentId), eq(simulatedCalls.tenantId, tenantId)),
      orderBy: simulatedCalls.startedAt,
      limit,
    });
  }
  private readonly DEFAULT_SCENARIOS: SimulationScenario[] = [
    {
      id: 'scenario-1',
      name: 'Client Intéressé - Niveau Débutant',
      description: 'Client ouvert et intéressé par votre offre',
      difficulty: 'beginner',
      customerProfile: {
        name: 'Marie Dubois',
        personality: 'Amicale et curieuse',
        mood: 'positive',
        objections: ['Prix un peu élevé'],
        buyingIntent: 80
      },
      objectives: [
        'Présenter l\'offre clairement',
        'Répondre aux questions',
        'Obtenir un engagement'
      ],
      successCriteria: {
        minDuration: 120,
        requiredPoints: ['présentation produit', 'réponse objection', 'closing'],
        maxObjectionsNotHandled: 0
      }
    },
    {
      id: 'scenario-2',
      name: 'Client Sceptique - Niveau Intermédiaire',
      description: 'Client avec plusieurs objections et doutes',
      difficulty: 'intermediate',
      customerProfile: {
        name: 'Jean Martin',
        personality: 'Analytique et méfiant',
        mood: 'neutral',
        objections: [
          'Trop cher',
          'Déjà un fournisseur',
          'Besoin de comparer',
          'Pas convaincu de la valeur'
        ],
        buyingIntent: 40
      },
      objectives: [
        'Établir la confiance',
        'Gérer les objections',
        'Démontrer la valeur',
        'Obtenir un rendez-vous'
      ],
      successCriteria: {
        minDuration: 180,
        requiredPoints: [
          'établissement confiance',
          'gestion objections',
          'démonstration valeur'
        ],
        maxObjectionsNotHandled: 1
      }
    },
    {
      id: 'scenario-3',
      name: 'Client Difficile - Niveau Avancé',
      description: 'Client pressé, irritable avec objections multiples',
      difficulty: 'advanced',
      customerProfile: {
        name: 'Pierre Rousseau',
        personality: 'Impatient et exigeant',
        mood: 'negative',
        objections: [
          'Pas le temps',
          'Pas intéressé',
          'Trop cher',
          'Mauvaise expérience passée',
          'Besoin de parler au manager'
        ],
        buyingIntent: 20
      },
      objectives: [
        'Calmer le client',
        'Identifier le vrai besoin',
        'Gérer les objections difficiles',
        'Sauver la relation'
      ],
      successCriteria: {
        minDuration: 150,
        requiredPoints: ['gestion émotion', 'identification besoin', 'gestion objections'],
        maxObjectionsNotHandled: 2
      }
    },
    {
      id: 'scenario-4',
      name: 'Transfert IA ↔ Humain - Niveau Expert',
      description: 'Simulation de prise en charge après escalade IA',
      difficulty: 'expert',
      customerProfile: {
        name: 'Sophie Lefebvre',
        personality: 'Frustrée par l\'IA',
        mood: 'negative',
        objections: [
          'L\'IA ne comprend pas',
          'Besoin d\'un humain',
          'Problème complexe',
          'Perte de temps'
        ],
        buyingIntent: 60
      },
      objectives: [
        'Récupérer le contexte IA',
        'Rassurer le client',
        'Résoudre le problème',
        'Transformer l\'expérience négative'
      ],
      successCriteria: {
        minDuration: 200,
        requiredPoints: [
          'récupération contexte',
          'empathie',
          'résolution',
          'satisfaction client'
        ],
        maxObjectionsNotHandled: 0
      }
    }
  ];

  /**
   * Démarre une simulation d'appel
   */
  async startSimulation(
    agentId: number,
    tenantId: number,
    scenarioId: string
  ): Promise<SimulatedCall> {
    try {
      const db = getDbInstance();
      if (!db) {
        throw new Error('Database not available');
      }

      // ✅ CORRECTION BUG COACHING: Normaliser l'ID avant de chercher le scénario
      const normalizedScenarioId = this.normalizeScenarioId(scenarioId);

      // Récupérer le scénario
      const scenario = await this.getScenario(normalizedScenarioId);

      if (!scenario) {
        throw new Error(`Scénario non trouvé: ${scenarioId} (normalisé: ${normalizedScenarioId})`);
      }

      // Créer l'appel simulé
      const callId = crypto.randomUUID();
      const simulatedCall: SimulatedCall = {
        id: callId,
        scenarioId: normalizedScenarioId,
        agentId,
        tenantId,
        status: 'in_progress',
        transcript: [],
        duration: 0,
        score: 0,
        feedback: {
          strengths: [],
          weaknesses: [],
          recommendations: []
        },
        objectivesAchieved: [],
        startedAt: new Date()
      };

      // Sauvegarder dans la base de données
      // ✅ FIX: Utiliser normalizedScenarioId et ajouter scenarioName
      await db.insert(simulatedCalls).values({
        id: callId,
        tenantId,
        agentId,
        scenarioId: normalizedScenarioId,
        scenarioName: scenario.name,
        status: 'in_progress',
        // Champs JSON typés correctement selon le schéma Drizzle
        transcript: [] as Array<{ timestamp: number; speaker: string; text: string; sentiment?: number }>,
        duration: 0,
        score: 0,
        feedback: {
          strengths: [] as string[],
          weaknesses: [] as string[],
          recommendations: [] as string[],
        },
        objectivesAchieved: [] as string[],
        startedAt: new Date()
      });

      // Générer le message d'ouverture du client simulé
      const openingMessage = await this.generateCustomerResponse(
        scenario,
        [],
        'opening'
      );

      simulatedCall.transcript.push({
        timestamp: 0,
        speaker: 'customer',
        text: openingMessage,
        sentiment: this.moodToSentiment(scenario.customerProfile.mood)
      });

      loggingService.info('Simulator: Simulation démarrée', {
        tenantId,
        agentId,
        scenarioId,
        callId
      });

      return simulatedCall;
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      loggingService.error('Simulator: Erreur lors du démarrage de la simulation', {
        error: msg,
        tenantId,
        agentId,
        scenarioId
      });
      throw new Error('Impossible de démarrer la simulation');
    }
  }

  /**
   * Traite une réponse de l'agent et génère la réponse du client simulé
   */
  async processAgentResponse(
    callId: string,
    agentId: number,
    tenantId: number,
    agentMessage: string
  ): Promise<{
    customerResponse: string;
    sentiment: number;
    callStatus: 'in_progress' | 'completed';
  }> {
    try {
      const db = getDbInstance();
      if (!db) {
        throw new Error('Database not available');
      }

      // Récupérer l'appel simulé
      // ✅ FIX CTO: id est un UUID (string), pas un entier. On garde callId tel quel.
      const callResults = await db.query.simulatedCalls.findFirst({
        where: and(
          eq(simulatedCalls.id, callId),
          eq(simulatedCalls.agentId, agentId),
          eq(simulatedCalls.tenantId, tenantId)
        )
      });

      if (!callResults) {
        throw new Error('Appel simulé non trouvé');
      }

      const call = callResults as unknown;

      // Récupérer le scénario
      const scenario = await this.getScenario(call.scenarioId);

      if (!scenario) {
        throw new Error('Scénario non trouvé');
      }

      // Ajouter le message de l'agent au transcript
      const transcript = (call.transcript as unknown[]) || [];
      const timestamp = transcript.length > 0 
        ? transcript[transcript.length - 1].timestamp + 10 
        : 0;

      transcript.push({
        timestamp,
        speaker: 'agent',
        text: agentMessage
      });

      // Analyser la réponse de l'agent
      const agentAnalysis: AgentAnalysis = await this.analyzeAgentResponse(
        agentMessage,
        scenario,
        transcript
      );

      // Générer la réponse du client avec IA
      const customerResponse = await this.generateCustomerResponse(
        scenario,
        transcript,
        agentAnalysis.responseType
      );

      const sentiment = this.calculateSentiment(
        scenario,
        transcript,
        agentAnalysis
      );

      // Ajouter la réponse du client au transcript
      transcript.push({
        timestamp: timestamp + 5,
        speaker: 'customer',
        text: customerResponse,
        sentiment
      });

      // Déterminer si l'appel doit se terminer
      const shouldEnd = await this.shouldEndCall(scenario, transcript, agentAnalysis);

      const callStatus: 'in_progress' | 'completed' = shouldEnd ? 'completed' : 'in_progress';

      // Mettre à jour l'appel
      // ✅ FIX: id est maintenant varchar (UUID), pas parseInt
      await db
        .update(simulatedCalls)
        .set({
          transcript: transcript as unknown,
          status: callStatus,
          duration: timestamp + 5,
          completedAt: shouldEnd ? new Date() : undefined,
          updatedAt: new Date()
        })
        .where(eq(simulatedCalls.id, callId));

      // Si l'appel est terminé, générer le score et feedback
      if (shouldEnd) {
        await this.finalizeSimulation(callId, tenantId);
      }

      loggingService.debug('Simulator: Réponse traitée', {
        tenantId,
        callId,
        callStatus,
        sentiment
      });

      return {
        customerResponse,
        sentiment,
        callStatus
      };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      loggingService.error('Simulator: Erreur lors du traitement de la réponse', {
        error: msg,
        tenantId,
        callId
      });
      throw new Error('Impossible de traiter la réponse de l\'agent');
    }
  }

  /**
   * Génère une réponse du client simulé avec IA
   */
  private async generateCustomerResponse(
    scenario: SimulationScenario,
    transcript: Array<{ speaker: string; text: string }>,
    responseType: 'opening' | 'positive' | 'neutral' | 'objection' | 'closing'
  ): Promise<string> {
    try {
      const conversationHistory = transcript
        .map((t: any) => `${t.speaker === 'agent' ? 'Agent' : 'Client'}: ${t.text}`)
        .join('\n');

      const prompt = `
Tu es ${scenario.customerProfile.name}, un client avec le profil suivant:
- Personnalité: ${scenario.customerProfile.personality}
- Humeur: ${scenario.customerProfile.mood}
- Intention d'achat: ${scenario.customerProfile.buyingIntent}/100
- Objections possibles: ${scenario.customerProfile.objections.join(', ')}

Conversation jusqu'à présent:
${conversationHistory || 'Début de l\'appel'}

Type de réponse attendu: ${responseType}

${responseType === 'opening' ? 'L\'agent vient de t\'appeler. Réponds de manière naturelle selon ton humeur.' : ''}
${responseType === 'objection' ? 'Soulève une objection de manière naturelle.' : ''}
${responseType === 'closing' ? 'L\'agent essaie de conclure. Réponds selon ton intention d\'achat.' : ''}

Génère une réponse courte et naturelle (1-3 phrases maximum) qui correspond à ta personnalité et ton humeur.
Ne mentionne pas ton profil, parle naturellement comme un vrai client.
`;

      const response = await aiService.generateCompletion({
        prompt,
        systemPrompt: 'Tu es un client réaliste dans une simulation d\'appel commercial.',
        temperature: 0.8,
      });

      return response.trim();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      loggingService.error('Simulator: Erreur lors de la génération de réponse client', {
        error: msg
      });
      // Fallback
      return 'Oui, je vous écoute...';
    }
  }

  /**
   * Analyse la réponse de l'agent
   */
  private async analyzeAgentResponse(
    message: string,
    scenario: SimulationScenario,
    transcript: Array<any>
  ): Promise<AgentAnalysis> {
    const messageLower = message.toLowerCase();

    // Détecter le type de réponse
    let responseType: 'opening' | 'positive' | 'neutral' | 'objection' | 'closing' = 'neutral';

    if (transcript.length <= 2) {
      responseType = 'opening';
    } else if (
      messageLower.includes('rendez-vous') ||
      messageLower.includes('commande') ||
      messageLower.includes('signer')
    ) {
      responseType = 'closing';
    } else if (
      messageLower.includes('comprend') ||
      messageLower.includes('effectivement') ||
      messageLower.includes('raison')
    ) {
      responseType = 'objection';
    } else if (messageLower.includes('parfait') || messageLower.includes('excellent')) {
      responseType = 'positive';
    }

    // Évaluer la qualité (simplifié)
    const quality = Math.min(100, message.length / 2 + 50);

    // Vérifier si une objection a été gérée
    const handledObjection = scenario.customerProfile.objections.some(obj => {
      const firstWord = obj.toLowerCase().split(' ')[0];
      return firstWord ? messageLower.includes(firstWord) : false;
    });

    return {
      responseType,
      quality,
      handledObjection
    };
  }

  /**
   * Calcule le sentiment du client
   */
  private calculateSentiment(
    scenario: SimulationScenario,
    _transcript: Array<unknown>,
    agentAnalysis: AgentAnalysis): number {
    let baseSentiment = this.moodToSentiment(scenario.customerProfile.mood);

    // Ajuster selon la qualité des réponses de l'agent
    if (agentAnalysis.quality > 70) {
      baseSentiment += 10;
    } else if (agentAnalysis.quality < 40) {
      baseSentiment -= 10;
    }

    // Ajuster selon la gestion des objections
    if (agentAnalysis.handledObjection) {
      baseSentiment += 15;
    }

    return Math.min(100, Math.max(0, baseSentiment));
  }

  /**
   * Détermine si l'appel doit se terminer
   */
  private async shouldEndCall(
    _scenario: SimulationScenario,
    transcript: Array<unknown>,
    agentAnalysis: AgentAnalysis): Promise<boolean> {
    // Terminer si closing détecté
    if (agentAnalysis.responseType === 'closing') {
      return true;
    }

    // Terminer si trop long
    const duration = transcript.length * 10;
    if (duration > 600) {
      // 10 minutes
      return true;
    }

    // Terminer si le client raccroche (à implémenter)
    return false;
  }

  /**
   * Finalise la simulation et génère le score
   */
  private async finalizeSimulation(callId: string, tenantId: number): Promise<void> {
    try {
      const db = getDbInstance();
      if (!db) return;

      // ✅ FIX: id est varchar (UUID), pas parseInt
      const callResults = await db.query.simulatedCalls.findFirst({
        where: and(eq(simulatedCalls.id, callId), eq(simulatedCalls.tenantId, tenantId))
      });

      if (!callResults) return;

      const call = callResults as unknown;
      const scenario = await this.getScenario(call.scenarioId);
      if (!scenario) return;

      // Calculer le score
      const score = await this.calculateSimulationScore(call, scenario);

      // Générer le feedback
      const feedback = await this.generateSimulationFeedback(call, scenario, score);

      // Mettre à jour l'appel
      // ✅ FIX: id est varchar (UUID), pas parseInt
      await db
        .update(simulatedCalls)
        .set({
          score,
          feedback: feedback as unknown,
          updatedAt: new Date()
        })
        .where(eq(simulatedCalls.id, callId));

      loggingService.info('Simulator: Simulation finalisée', {
        tenantId,
        callId,
        score
      });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      loggingService.error('Simulator: Erreur lors de la finalisation', {
        error: msg,
        callId
      });
    }
  }

  /**
   * Calcule le score de la simulation
   */
  private async calculateSimulationScore(
    call: any,
    scenario: SimulationScenario
  ): Promise<number> {
    let score = 0;

    // Durée (20 points)
    if (call.duration >= scenario.successCriteria.minDuration) {
      score += 20;
    } else {
      score += (call.duration / scenario.successCriteria.minDuration) * 20;
    }

    // Objectifs atteints (40 points)
    const objectivesScore = ((call.objectivesAchieved?.length ?? 0) / scenario.objectives.length) * 40;
    score += objectivesScore;

    // Sentiment final (20 points)
    const finalSentiment =
      call.transcript && call.transcript.length > 0
        ? call.transcript[call.transcript.length - 1].sentiment ?? 50
        : 50;
    score += (finalSentiment / 100) * 20;

    // Gestion des objections (20 points)
    score += 15; // Temporaire

    return Math.round(Math.min(100, score));
  }

  /**
   * Génère le feedback de la simulation
   */
  private async generateSimulationFeedback(
    call: any,
    scenario: SimulationScenario,
    score: number
  ): Promise<{ strengths: string[]; weaknesses: string[]; recommendations: string[] }> {
    const strengths: string[] = [];
    const weaknesses: string[] = [];
    const recommendations: string[] = [];

    if (score >= 80) {
      strengths.push('Excellente performance globale');
    }

    if (call.duration >= scenario.successCriteria.minDuration) {
      strengths.push('Durée d\'appel appropriée');
    } else {
      weaknesses.push('Appel trop court');
      recommendations.push('Prendre plus de temps pour établir la relation');
    }

    return { strengths, weaknesses, recommendations };
  }

  /**
   * Normalise un scenarioId pour gérer le mismatch frontend/backend
   * ✅ CORRECTION BUG COACHING: Le frontend peut envoyer "1" ou "scenario-1"
   * Le backend attend "scenario-1"
   */
  private normalizeScenarioId(scenarioId: string): string {
    // Si l'ID est un nombre pur (ex: "1", "2"), préfixer avec "scenario-"
    if (/^\d+$/.test(scenarioId)) {
      return `scenario-${scenarioId}`;
    }
    return scenarioId;
  }

  /**
   * Récupère un scénario
   * ✅ CORRECTION BUG COACHING: Normalisation de l'ID avant recherche
   */
  private async getScenario(scenarioId: string, _tenantId?: number): Promise<SimulationScenario | null> {
    const scenario = this.DEFAULT_SCENARIOS.find(s => s.id === scenarioId);
    return scenario || null;
  }

  /**
   * Convertit un mood en sentiment numérique
   */
  private moodToSentiment(mood: string): number {
    switch (mood) {
      case 'positive': return 80;
      case 'neutral': return 50;
      case 'negative': return 30;
      case 'hostile': return 10;
      default: return 50;
    }
  }
}

export const callSimulatorService = new CallSimulatorService();