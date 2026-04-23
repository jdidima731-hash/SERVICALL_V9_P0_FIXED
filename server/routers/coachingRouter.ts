/**
 * Coaching Router - Endpoints pour le coaching et la formation des agents
 */

import { z } from 'zod';
import { tenantProcedure, router } from '../procedures';
import { TRPCError } from '@trpc/server';
import { agentCoachingService } from '../services/agentCoachingService';
import { callSimulatorService } from '../services/callSimulatorService';
import { logger as loggingService } from "../infrastructure/logger";
import { db } from "../db";
import { calls, users, simulatedCalls } from "../../drizzle/schema";
import { sql, and, gte, lte, eq } from "drizzle-orm";

export const coachingRouter = router({
  /**
   * Génère un feedback de coaching pour un appel
   */
  generateFeedback: tenantProcedure
    .input(
      z.object({
        callId: z.number(),
      })
    )
    .mutation(async ({ input, ctx }: any) => {
      try {
        const feedback = await agentCoachingService.analyzeCallAndGenerateFeedback(
          input.callId,
          ctx.tenantId!
        );

        return {
          success: true,
          feedback,
        };
      } catch (error: any) {
        loggingService.error('Coaching Router: Erreur génération feedback', {
          error,
          callId: input.callId,
        });
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Impossible de générer le feedback',
        });
      }
    }),

  /**
   * Récupère le feedback d'un appel
   */
  getCallFeedback: tenantProcedure
    .input(
      z.object({
        callId: z.number(),
      })
    )
    .query(async ({ input, ctx }: any) => {
      try {
        const feedback = await agentCoachingService.getCallFeedback(
          input.callId,
          ctx.tenantId!
        );

        return {
          success: true,
          feedback,
        };
      } catch (error: any) {
        loggingService.error('Coaching Router: Erreur récupération feedback', {
          error,
          callId: input.callId,
        });
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Impossible de récupérer le feedback',
        });
      }
    }),

  /**
   * Récupère les métriques de performance d'un agent
   * ✅ BLOC 5: Cache Redis avec TTL 60s
   */
  getAgentPerformance: tenantProcedure
    .input(
      z.object({
        agentId: z.number(),
        startDate: z.string(),
        endDate: z.string(),
      })
    )
    .query(async ({ input, ctx }: any) => {
      try {
        // Import du cache service
        const cacheService = await import('../services/cacheService');
        
        // Clé de cache unique par agent et période
        const cacheKey = `agent:${input.agentId}:performance:${input.startDate}:${input.endDate}`;
        
        // Utiliser le pattern cache-aside avec TTL 60s
        const metrics = await cacheService.getOrSet(
          cacheKey,
          async () => {
            return await agentCoachingService.getAgentPerformanceMetrics(
              input.agentId,
              ctx.tenantId!,
              new Date(input.startDate),
              new Date(input.endDate)
            );
          },
          
          60 // TTL: 60 secondes
        );

        return {
          success: true,
          metrics: {
            totalCalls: metrics.metrics.totalCalls,
            averageScore: metrics.metrics.averageScore,
            conversionRate: metrics.metrics.conversionRate,
            trend: metrics.trend,
            topStrengths: metrics.topStrengths,
            areasForImprovement: metrics.areasForImprovement,
          },
        };
      } catch (error: any) {
        loggingService.error('Coaching Router: Erreur récupération métriques', {
          error,
          agentId: input.agentId,
        });
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Impossible de récupérer les métriques de performance',
        });
      }
    }),

  /**
   * Liste tous les scénarios disponibles avec fallback si vide
   */
  listSimulationScenarios: tenantProcedure.query(async ({ ctx }) => {
    try {
      const scenarios = await callSimulatorService.listScenarios(ctx.tenantId!);

      if (!scenarios || scenarios.length === 0) {
        return {
          success: true,
          scenarios: [],
          message: "Aucun scénario disponible pour le moment."
        };
      }

      return {
        success: true,
        scenarios: scenarios.map((s) => ({
          id: s.id,
          name: s.name,
          description: s.description,
          difficulty: s.difficulty,
          customerProfile: s.customerProfile,
          objectives: s.objectives,
        })),
      };
    } catch (error: any) {
      loggingService.error('Coaching Router: Erreur liste scénarios', { error });
      return {
        success: false,
        scenarios: [],
        error: "Impossible de récupérer les scénarios"
      };
    }
  }),

  /**
   * Démarre une simulation d'appel
   */
  startSimulation: tenantProcedure
    .input(
      z.object({
        scenarioId: z.string(),
      })
    )
    .mutation(async ({ input, ctx }: any) => {
      try {
        const simulation = await callSimulatorService.startSimulation(
          ctx.user!.id,
          ctx.tenantId!,
          input.scenarioId
        );

        return {
          success: true,
          simulation: {
            id: simulation.id,
            scenarioId: simulation.scenarioId,
            status: simulation.status,
            transcript: simulation.transcript,
            startedAt: simulation.startedAt,
            completedAt: simulation.completedAt,
          },
        };
      } catch (error: any) {
        loggingService.error('Coaching Router: Erreur démarrage simulation', {
          error,
          scenarioId: input.scenarioId,
        });
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Impossible de démarrer la simulation',
        });
      }
    }),

  /**
   * Envoie une réponse de l'agent dans une simulation
   */
  sendAgentResponse: tenantProcedure
    .input(
      z.object({
        callId: z.string(),
        message: z.string(),
      })
    )
    .mutation(async ({ input, ctx }: any) => {
      try {
        const result = await callSimulatorService.processAgentResponse(
          input.callId,
          ctx.user!.id,
          ctx.tenantId!,
          input.message
        );

        return {
          success: true,
          customerResponse: result.customerResponse,
          sentiment: result.sentiment,
          callStatus: result.callStatus,
        };
      } catch (error: any) {
        loggingService.error('Coaching Router: Erreur traitement réponse', {
          error,
          callId: input.callId,
        });
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Impossible de traiter la réponse',
        });
      }
    }),

  /**
   * Récupère l'historique des simulations d'un agent avec gestion d'état vide
   */
  getSimulationHistory: tenantProcedure
    .input(
      z.object({
        agentId: z.number().optional(),
        limit: z.number().optional().default(10),
      })
    )
    .query(async ({ input, ctx }: any) => {
      try {
        const agentId = input.agentId || ctx.user!.id;
        const history = await callSimulatorService.getAgentSimulationHistory(
          agentId,
          ctx.tenantId!,
          input.limit
        );

        if (!history || history.length === 0) {
          return {
            success: true,
            history: [],
            message: "Aucun historique de simulation trouvé."
          };
        }

        return {
          success: true,
          history: history.map((call) => ({
            id: call.id,
            scenarioId: call.scenarioId,
            status: call.status,
            score: call.score,
            startedAt: call.startedAt,
            completedAt: call.completedAt,
          })),
        };
      } catch (error: any) {
        loggingService.error('Coaching Router: Erreur récupération historique', {
          error,
          agentId: input.agentId,
        });
        return {
          success: false,
          history: [],
          error: "Impossible de récupérer l'historique"
        };
      }
    }),

  /**
   * Récupère le dashboard de performance de l'équipe
   * ✅ BLOC 2: Implémentation de l'agrégation des performances avec Drizzle
   */
  getTeamPerformanceDashboard: tenantProcedure
    .input(
      z.object({
        startDate: z.string(),
        endDate: z.string(),
      })
    )
    .query(async ({ input, ctx }: any) => {
      try {
        const tenantId = ctx.tenantId!;
        const startDate = new Date(input.startDate);
        const endDate = new Date(input.endDate);

        // 1. Agrégation des appels réels par agent via Drizzle ORM
        const callStats = await db.select({
          agentId: calls.agentId,
          agentName: users.name,
          totalCalls: sql<number>`count(${calls.id})::int`,
          avgDuration: sql<number>`avg(${calls.duration})::float`,
          successfulCalls: sql<number>`count(case when ${calls.outcome} = 'success' then 1 end)::int`,
        })
        .from(calls)
        .leftJoin(users, eq(calls.agentId, users.id))
        .where(and(
          eq(calls.tenantId, tenantId),
          gte(calls.createdAt, startDate),
          lte(calls.createdAt, endDate),
          sql`${calls.agentId} is not null`
        ))
        .groupBy(calls.agentId, users.name);

        // 2. Agrégation des simulations par agent via Drizzle ORM
        const simulationStats = await db.select({
          agentId: simulatedCalls.agentId,
          avgScore: sql<number>`avg(${simulatedCalls.score})::float`,
          totalSimulations: sql<number>`count(${simulatedCalls.id})::int`,
        })
        .from(simulatedCalls)
        .where(and(
          eq(simulatedCalls.tenantId, tenantId),
          gte(simulatedCalls.createdAt, startDate),
          lte(simulatedCalls.createdAt, endDate)
        ))
        .groupBy(simulatedCalls.agentId);

        // 3. Combiner les statistiques
        const agentPerformance = callStats.map((callStat) => {
          const simStat = simulationStats.find((s) => s.agentId === callStat.agentId);
          const totalCalls = callStat.totalCalls ?? 0;
          const successfulCalls = callStat.successfulCalls ?? 0;
          const conversionRate = totalCalls > 0 
            ? (successfulCalls / totalCalls) * 100 
            : 0;

          return {
            agentId: callStat.agentId,
            agentName: callStat.agentName || 'Agent inconnu',
            totalCalls: totalCalls,
            conversionRate: Math.round(conversionRate * 10) / 10,
            avgScore: simStat?.avgScore ? Math.round(simStat.avgScore) : 0,
            avgDuration: callStat.avgDuration ? Math.round(callStat.avgDuration) : 0,
          };
        });

        // 4. Calculer les métriques globales
        const totalAgents = agentPerformance.length;
        const totalCalls = agentPerformance.reduce((sum, agent) => sum + agent.totalCalls, 0);
        const averageScore = totalAgents > 0
          ? agentPerformance.reduce((sum, agent) => sum + agent.avgScore, 0) / totalAgents
          : 0;
        const averageConversionRate = totalAgents > 0
          ? agentPerformance.reduce((sum, agent) => sum + agent.conversionRate, 0) / totalAgents
          : 0;

        // 5. Identifier les top performers et ceux nécessitant amélioration
        const sortedByScore = [...agentPerformance].sort((a, b) => b.avgScore - a.avgScore);
        const topPerformers = sortedByScore.slice(0, 3);
        const needsImprovement = sortedByScore.slice(-3).reverse();

        loggingService.info('Coaching Router: Dashboard équipe calculé', {
          tenantId,
          totalAgents,
          totalCalls,
          period: { start: input.startDate, end: input.endDate },
        });

        return {
          success: true,
          dashboard: {
            period: { start: input.startDate, end: input.endDate },
            teamMetrics: {
              totalAgents,
              averageScore: Math.round(averageScore * 10) / 10,
              totalCalls,
              improvementRate: Math.round(averageConversionRate * 10) / 10,
            },
            topPerformers: topPerformers.map((agent) => ({
              agentId: agent.agentId,
              agentName: agent.agentName,
              score: agent.avgScore,
              calls: agent.totalCalls,
              conversionRate: agent.conversionRate,
            })),
            needsImprovement: needsImprovement.map((agent) => ({
              agentId: agent.agentId,
              agentName: agent.agentName,
              score: agent.avgScore,
              calls: agent.totalCalls,
              conversionRate: agent.conversionRate,
            })),
          },
        };
      } catch (error: any) {
        loggingService.error('Coaching Router: Erreur dashboard équipe', { error });
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Impossible de récupérer le dashboard de l\'équipe',
        });
      }
    }),
});