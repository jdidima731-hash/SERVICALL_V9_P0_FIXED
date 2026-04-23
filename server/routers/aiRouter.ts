import { AI_MODEL } from '../_core/aiModels';
/**
 * AI Router - Endpoints pour l'interaction avec l'IA conversationnelle
 * et la gestion des rôles IA (listModels, getModel, createModel, updateModel, deleteModel)
 * ✅ BLOC 2: Persistance en base de données (aiRoles table)
 */

import { z } from 'zod';
import { tenantProcedure, router } from '../procedures';
import { generateAIResponse, generateCompletion } from '../services/aiService';
import { logger } from "../infrastructure/logger";
import { TRPCError } from '@trpc/server';
import { eq, and, desc } from 'drizzle-orm';
import * as schema from "../../drizzle/schema";

// Schéma commun pour un rôle IA
const aiRoleSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  prompt: z.string().min(1),
  model: z.string().default("gpt-4"),
  temperature: z.number().min(0).max(1).default(0.7),
  isActive: z.boolean().default(true),
  // Voix & audio
  ttsVoice: z.enum(['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer']).default('alloy'),
  ttsSpeed: z.number().min(0.25).max(4.0).default(1.0),
  ttsPitch: z.number().min(0.5).max(2.0).default(1.0),
  ttsLanguage: z.enum(['fr', 'en', 'es', 'de', 'ar']).default('fr'),
  // Messages personnalisés
  greetingMessage: z.string().optional(),
  farewellMessage: z.string().optional(),
  holdMessage: z.string().optional(),
  transferMessage: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const aiRouter = router({
  /**
   * Liste tous les rôles IA d'un tenant
   */
  listModels: tenantProcedure
    .query(async ({ ctx }) => {
      const db = (await import("../db")).getDbInstance();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      const roles = await db.select()
        .from(schema.aiRoles)
        .where(eq(schema.aiRoles.tenantId, ctx.tenantId!))
        .orderBy(desc(schema.aiRoles.createdAt));

      return { roles, total: roles.length };
    }),

  /**
   * Récupère un rôle IA par ID
   */
  getModel: tenantProcedure
    .input(z.object({ modelId: z.number() }))
    .query(async ({ input, ctx }: any) => {
      const db = (await import("../db")).getDbInstance();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      const roles = await db.select()
        .from(schema.aiRoles)
        .where(and(
          eq(schema.aiRoles.id, input.modelId),
          eq(schema.aiRoles.tenantId, ctx.tenantId!)
        ))
        .limit(1);

      const role = roles[0];
      if (!role) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Rôle IA introuvable' });
      }
      return role;
    }),

  /**
   * Crée un nouveau rôle IA
   */
  createModel: tenantProcedure
    .input(aiRoleSchema)
    .mutation(async ({ input, ctx }: any) => {
      const db = (await import("../db")).getDbInstance();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      const [role] = await db.insert(schema.aiRoles).values({
        tenantId: ctx.tenantId!,
        name: input.name,
        description: input.description,
        prompt: input.prompt,
        model: input.model,
        temperature: input.temperature.toString(),
        isActive: input.isActive,
        ttsVoice: input.ttsVoice ?? 'alloy',
        ttsSpeed: (input.ttsSpeed ?? 1.0).toString(),
        ttsPitch: (input.ttsPitch ?? 1.0).toString(),
        ttsLanguage: input.ttsLanguage ?? 'fr',
        greetingMessage: input.greetingMessage,
        farewellMessage: input.farewellMessage,
        holdMessage: input.holdMessage,
        transferMessage: input.transferMessage,
        metadata: input.metadata || {},
      }).returning();

      logger.info('[AI Router] Rôle IA créé', { id: role.id, tenantId: ctx.tenantId! });
      return { success: true, role };
    }),

  /**
   * Met à jour un rôle IA existant
   */
  updateModel: tenantProcedure
    .input(aiRoleSchema.partial().extend({ modelId: z.number() }))
    .mutation(async ({ input, ctx }: any) => {
      const db = (await import("../db")).getDbInstance();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      const { modelId, ...updateData } = input;

      // Vérifier l'existence et l'appartenance
      const existing = await db.select()
        .from(schema.aiRoles)
        .where(and(
          eq(schema.aiRoles.id, modelId),
          eq(schema.aiRoles.tenantId, ctx.tenantId!)
        ))
        .limit(1);

      if (existing.length === 0) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Rôle IA introuvable' });
      }

      const [updated] = await db.update(schema.aiRoles)
        .set({
          ...(updateData.name !== undefined && { name: updateData.name }),
          ...(updateData.description !== undefined && { description: updateData.description }),
          ...(updateData.prompt !== undefined && { prompt: updateData.prompt }),
          ...(updateData.model !== undefined && { model: updateData.model }),
          ...(updateData.temperature !== undefined && { temperature: updateData.temperature.toString() }),
          ...(updateData.isActive !== undefined && { isActive: updateData.isActive }),
          ...(updateData.ttsVoice !== undefined && { ttsVoice: updateData.ttsVoice }),
          ...(updateData.ttsSpeed !== undefined && { ttsSpeed: updateData.ttsSpeed.toString() }),
          ...(updateData.ttsPitch !== undefined && { ttsPitch: updateData.ttsPitch.toString() }),
          ...(updateData.ttsLanguage !== undefined && { ttsLanguage: updateData.ttsLanguage }),
          ...(updateData.greetingMessage !== undefined && { greetingMessage: updateData.greetingMessage }),
          ...(updateData.farewellMessage !== undefined && { farewellMessage: updateData.farewellMessage }),
          ...(updateData.holdMessage !== undefined && { holdMessage: updateData.holdMessage }),
          ...(updateData.transferMessage !== undefined && { transferMessage: updateData.transferMessage }),
          ...(updateData.metadata !== undefined && { metadata: updateData.metadata }),
          updatedAt: new Date(),
        })
        .where(eq(schema.aiRoles.id, modelId))
        .returning();

      logger.info('[AI Router] Rôle IA mis à jour', { id: modelId });
      return { success: true, role: updated };
    }),

  /**
   * Supprime un rôle IA
   */
  deleteModel: tenantProcedure
    .input(z.object({ modelId: z.number() }))
    .mutation(async ({ input, ctx }: any) => {
      const db = (await import("../db")).getDbInstance();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      const result = await db.delete(schema.aiRoles)
        .where(and(
          eq(schema.aiRoles.id, input.modelId),
          eq(schema.aiRoles.tenantId, ctx.tenantId!)
        ))
        .returning();

      if (result.length === 0) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Rôle IA introuvable' });
      }

      logger.info('[AI Router] Rôle IA supprimé', { id: input.modelId });
      return { success: true };
    }),

  /**
   * Chat avec l'IA - Génère une réponse contextuelle
   */
  chat: tenantProcedure
    .input(
      z.object({
        message: z.string().min(1, 'Le message ne peut pas être vide'),
        context: z
          .object({
            prospectName: z.string().optional(),
            callReason: z.string().optional(),
            conversationHistory: z.array(z.object({
              role: z.enum(['user', 'assistant']),
              content: z.string(),
            })).optional(),
          })
          .optional(),
        model: z.enum(['gpt-4o-mini', 'gpt-4o', 'gemini-1.5-flash']).optional().default(AI_MODEL.DEFAULT as unknown),
        temperature: z.number().min(0).max(2).optional(),
        maxTokens: z.number().optional(),
      })
    )
    .mutation(async ({ input, ctx }: any) => {
      const tenantId = ctx.tenantId!;

      try {
        logger.info('[AI Router] Chat request received', {
          userId: ctx.user!.id,
          tenantId: tenantId,
          messageLength: input.message.length,
          model: input.model,
        });

        let response: string;

        // Si un contexte spécifique est fourni, utiliser generateAIResponse
        if (input.context?.prospectName || input.context?.callReason) {
          response = await generateAIResponse(input.message, {
            tenantId: tenantId,
            prospectName: input.context.prospectName ?? 'Client',
            callReason: input.context.callReason || 'Demande générale',
            tenantName: ctx.user!.name ?? 'Servicall',
          });
        } else {
          // Sinon, utiliser generateCompletion pour une conversation générique
          const conversationHistory = input.context?.conversationHistory || [];
          
          // Smart-Prompting: Récupérer le prompt système depuis le blueprint si disponible
          let systemPrompt = `Tu es un assistant IA professionnel pour un centre d'appels. Réponds de manière courtoise, concise et professionnelle en français.`;
          
          const db = (await import("../db")).getDbInstance();
          if (db) {
            const tenant = await db.select().from(schema.tenants).where(eq(schema.tenants.id, tenantId)).limit(1);
            
            if (tenant[0]?.industry) {
              const blueprints = await import("../../shared/blueprints.json").then(m => m.default);
              
              const blueprint = blueprints.find((b: any) => b.industry === tenant[0].industry);
              if (blueprint?.systemPrompt) {
                systemPrompt = blueprint.systemPrompt;
                
                logger.info('[AI Router] Smart-Prompting applied', { industry: tenant[0].industry });
              }
            }
          }
          
          // Construire le prompt avec l'historique
          let prompt = input.message;
          if (conversationHistory.length > 0) {
            const historyText = conversationHistory
              .map((msg) => `${msg.role === 'user' ? 'Utilisateur' : 'Assistant'}: ${msg.content}`)
              .join('\n');
            prompt = `${historyText}\nUtilisateur: ${input.message}`;
          }

          response = await generateCompletion({
            prompt,
            systemPrompt,
            temperature: input.temperature,
            maxTokens: input.maxTokens,
            model: input.model,
          });
        }

        logger.info('[AI Router] Chat response generated', {
          userId: ctx.user!.id,
          tenantId: tenantId,
          responseLength: response.length,
        });

        return {
          success: true,
          response,
          model: input.model,
          timestamp: new Date().toISOString(),
        };
      } catch (error: any) {
        logger.error('[AI Router] Error generating chat response', error, {
          userId: ctx.user!.id,
          tenantId: tenantId,
        });

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Impossible de générer une réponse IA',
          cause: error,
        });
      }
    }),

  /**
   * Retourne les profils de voix disponibles (OpenAI TTS)
   */
  getVoiceProfiles: tenantProcedure
    .query(() => {
      return [
        { id: 'alloy',   name: 'Alloy',   gender: 'neutre',   description: 'Voix équilibrée et polyvalente' },
        { id: 'echo',    name: 'Echo',    gender: 'masculin', description: 'Voix grave et posée' },
        { id: 'fable',   name: 'Fable',   gender: 'masculin', description: 'Voix expressive et narrative' },
        { id: 'onyx',    name: 'Onyx',    gender: 'masculin', description: 'Voix profonde et autoritaire' },
        { id: 'nova',    name: 'Nova',    gender: 'féminin',  description: 'Voix chaleureuse et amicale' },
        { id: 'shimmer', name: 'Shimmer', gender: 'féminin',  description: 'Voix douce et rassurante' },
      ];
    }),
});