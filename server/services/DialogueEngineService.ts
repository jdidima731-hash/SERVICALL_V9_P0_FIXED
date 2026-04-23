import OpenAI from 'openai';
import { AI_MODEL } from '../_core/aiModels';
import { getOpenAIClient } from "../_core/openaiClient";
import { DialogueScenario, DialogueInput, DialogueOutput, ConversationContext, Action } from "../../shared/types/dialogue";
import { getDbInstance } from "../db";
import { prospects, campaigns } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import Redis from "ioredis";
import { ENV } from "../_core/env";
import * as fs from 'fs';
import * as path from 'path';
import { CallCenterScriptLoader } from './CallCenterScriptLoader';
import { logger } from '../infrastructure/logger';

/**
 * DIALOGUE ENGINE SERVICE — SERVICALL V8
 * ✅ Moteur de dialogue IA durci
 * ✅ Support Redis Failover & In-memory Fallback
 */
export class DialogueEngineService {
  private openai: OpenAI;
  private redisClient: Redis | undefined;
  private conversationHistoryPrefix = "conv:";
  private stateHistoryPrefix = "state:";
  private stateStackPrefix = "stack:";
  private auditLogs: Array<{ timestamp: Date; callId: string; action: string; details: unknown }> = [];
  private rateLimitMap: Map<string, number> = new Map();
  
  // In-memory fallback maps when Redis is disabled
  private conversationHistory: Map<string, ConversationContext> = new Map();
  private stateHistory: Map<string, string> = new Map();
  private stateStack: Map<string, string[]> = new Map();

  constructor() {
    this.openai = getOpenAIClient();

    if (!ENV.disableRedis) {
      try {
        this.redisClient = new Redis({
          host: ENV.redisHost ?? "localhost",
          port: ENV.redisPort ?? 6379,
          password: ENV.redisPassword,
          retryStrategy: (times) => Math.min(times * 50, 2000),
        });

        this.redisClient.on("error", (err) => {
          logger.error("[DialogueEngine] Redis Client Error", err);
        });
      } catch (err) {
        logger.error("[DialogueEngine] Failed to initialize Redis", err);
      }
    }
  }

  private logAudit(callId: string, action: string, details: unknown) {
    const entry = { timestamp: new Date(), callId, action, details };
    this.auditLogs.push(entry);
    logger.info(`[AUDIT] [${callId}] ${action}:`, { details });
  }

  private checkRateLimit(callId: string): boolean {
    const now = Date.now();
    const lastCall = this.rateLimitMap.get(callId) || 0;
    if (now - lastCall < 500) return false; // 2 req/sec limit
    this.rateLimitMap.set(callId, now);
    return true;
  }

  async initializeConversation(
    callId: string,
    scenario: DialogueScenario,
    tenantId: number,
    prospectId: number
  ): Promise<DialogueOutput> {
    this.logAudit(callId, 'INIT', { scenarioId: scenario.id, tenantId });
    
    const context: ConversationContext = scenario.context || {};
    context.history = [scenario.initialState];

    const db = getDbInstance();
    if (db) {
      // Charger les informations du prospect
      const prospectData = await db.select().from(prospects).where(eq(prospects.id, prospectId)).limit(1);
      if (prospectData.length > 0) {
        context.prospect = prospectData[0];
      }

      // Charger les informations de la campagne
      const campaignData = await db.select().from(campaigns).where(eq(campaigns.id, parseInt(scenario.id) || 0)).limit(1);
      if (campaignData.length > 0) {
        context.campaign = campaignData[0];
      }
    }

    // Charger le script Call Center si nécessaire
    if (['prospection', 'juridique', 'logistique', 'commerce'].includes(scenario.industry)) {
      const scriptLoader = CallCenterScriptLoader.getInstance();
      const script = scriptLoader.getScript((context.activity_type as string) || scenario.industry);
      if (script) {
        Object.assign(context, script);
      }
    }

    if (this.redisClient) {
      await this.redisClient.set(`${this.conversationHistoryPrefix}${callId}`, JSON.stringify(context), "EX", 3600);
      await this.redisClient.set(`${this.stateHistoryPrefix}${callId}`, scenario.initialState, "EX", 3600);
      await this.redisClient.set(`${this.stateStackPrefix}${callId}`, JSON.stringify([scenario.initialState]), "EX", 3600);
    } else {
      this.conversationHistory.set(callId, context);
      this.stateHistory.set(callId, scenario.initialState);
      this.stateStack.set(callId, [scenario.initialState]);
    }

    const initialState = scenario.states.find((s) => s.id === scenario.initialState);
    if (!initialState) throw new Error(`Initial state ${scenario.initialState} not found`);
    
    const actionsExecuted = await this.executeActions(initialState.onEnter, context, tenantId, prospectId, callId);
    const response = await this.generateResponse(initialState.onEnter, context);

    return { response, nextState: initialState.id, actionsExecuted, context };
  }

  async processInput(
    callId: string,
    input: DialogueInput,
    scenario: DialogueScenario
  ): Promise<DialogueOutput> {
    if (!this.checkRateLimit(callId)) {
      throw new Error("Rate limit exceeded for call " + callId);
    }

    let context: ConversationContext | undefined;
    let currentStateId: string | undefined;
    let stack: string[] = [];

    if (this.redisClient) {
      const [contextStr, currentStateIdStr, stackStr] = await Promise.all([
        this.redisClient.get(`${this.conversationHistoryPrefix}${callId}`),
        this.redisClient.get(`${this.stateHistoryPrefix}${callId}`),
        this.redisClient.get(`${this.stateStackPrefix}${callId}`)
      ]);

      if (contextStr) context = JSON.parse(contextStr);
      if (currentStateIdStr) currentStateId = currentStateIdStr;
      if (stackStr) stack = JSON.parse(stackStr);
    } else {
      context = this.conversationHistory.get(callId);
      currentStateId = this.stateHistory.get(callId);
      stack = this.stateStack.get(callId) || [];
    }

    if (!context || !currentStateId) throw new Error(`Conversation ${callId} not found`);

    const analysis = await this.analyzeInput(input.text, scenario.industry, context);
    const intent = (analysis.intent as string) || 'unknown';
    const entities = (analysis.entities as Record<string, any>) || {};
    
    this.logAudit(callId, 'INPUT', { text: input.text, intent, entities });

    // Fallback transfert humain si trop d'incompréhensions
    const unknownCount = (context.unknown_count as number || 0);
    if (intent === 'unknown' && unknownCount > 3) {
      this.logAudit(callId, 'HUMAN_TRANSFER', { reason: 'Too many unknown intents' });
      return { 
        response: "Je vous mets en relation avec un conseiller.", 
        nextState: 'human_transfer', 
        actionsExecuted: [{ type: 'transfer_human' }], 
        context 
      };
    }

    // Mise à jour contexte
    Object.assign(context, entities);
    context.lastIntent = intent;
    context.unknown_count = intent === 'unknown' ? unknownCount + 1 : 0;

    let nextStateId: string | null = null;
    const currentState = scenario.states.find(s => s.id === currentStateId);
    if (currentState) {
      for (const transition of currentState.transitions) {
        if (this.evaluateCondition(transition.condition, context, { intent, entities })) {
          nextStateId = transition.targetState;
          break;
        }
      }
    }

    if (!nextStateId) nextStateId = scenario.fallbackState || currentStateId;

    const nextState = scenario.states.find(s => s.id === nextStateId);
    if (!nextState) throw new Error(`Next state ${nextStateId} not found`);

    if (nextStateId !== currentStateId) {
      stack.push(nextStateId);
    }

    const actionsExecuted = await this.executeActions(nextState.onEnter, context, input.tenantId, input.prospectId, callId);
    const response = await this.generateResponse(nextState.onEnter, context);

    if (this.redisClient) {
      await Promise.all([
        this.redisClient.set(`${this.stateHistoryPrefix}${callId}`, nextStateId, "EX", 3600),
        this.redisClient.set(`${this.conversationHistoryPrefix}${callId}`, JSON.stringify(context), "EX", 3600),
        this.redisClient.set(`${this.stateStackPrefix}${callId}`, JSON.stringify(stack), "EX", 3600)
      ]);
    } else {
      this.stateHistory.set(callId, nextStateId);
      this.conversationHistory.set(callId, context);
      this.stateStack.set(callId, stack);
      context.history = [...stack];
    }

    return { response, nextState: nextStateId, actionsExecuted, context };
  }

  private async analyzeInput(text: string, industry: string, context: ConversationContext): Promise<Record<string, unknown>> {
    const promptPath = path.join(__dirname, '../ai/prompts/callcenter.system.txt');
    let systemPrompt = "You are a helpful assistant.";
    
    if (fs.existsSync(promptPath)) {
      systemPrompt = fs.readFileSync(promptPath, 'utf8')
        .replace('{{activity_type}}', (context.activity_type as string) || industry)
        .replace('{{objectives}}', JSON.stringify(context.objectives || []))
        .replace('{{pitch}}', (context.pitch as string) || "")
        .replace('{{bénéfices}}', JSON.stringify(context.bénéfices || []))
        .replace('{{questions_qualification}}', JSON.stringify(context.questions_qualification || []))
        .replace('{{objections}}', JSON.stringify(context.objections || []))
        .replace('{{regles_metier}}', JSON.stringify(context.regles_metier || []))
        .replace('{{actions_finales}}', JSON.stringify(context.actions_finales || []));
    }

    const response = await this.openai.chat.completions.create({
      model: AI_MODEL.DEFAULT,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: text },
      ],
      temperature: 0.1,
      response_format: { type: "json_object" }
    });

    return JSON.parse(response.choices[0]!.message.content || "{}");
  }

  private async generateResponse(actions: Action[], context: ConversationContext): Promise<string> {
    const speakAction = actions.find(a => a.type === 'speak_to_caller');
    if (!speakAction) return "Je vous écoute.";
    return this.interpolateText((speakAction.config.text as string) || "Je vous écoute.", context);
  }

  private evaluateCondition(condition: string, context: ConversationContext, analysis: Record<string, unknown>): boolean {
    try {
      const mergedContext = { ...context, ...analysis };
      return this.evaluateStringCondition(condition, mergedContext);
    } catch (error: any) {
      logger.error('[DialogueEngine] Condition evaluation error', { condition, error });
      return false;
    }
  }

  private evaluateStringCondition(condition: string, context: ConversationContext): boolean {
    if (!condition || typeof condition !== 'string') return false;
    const trimmed = condition.trim();
    if (trimmed === 'true') return true;
    if (trimmed === 'false') return false;

    // Évaluation sécurisée simplifiée pour les intents
    if (trimmed.includes("intent === '")) {
      const expectedIntent = trimmed.split("'")[1];
      return context.lastIntent === expectedIntent;
    }

    return false;
  }

  private async executeActions(actions: Action[], context: ConversationContext, tenantId: number, prospectId: number, callId: string): Promise<any[]> {
    const results = [];
    for (const action of actions) {
      if (action.type === 'speak_to_caller') continue;
      
      this.logAudit(callId, 'EXECUTE_ACTION', { type: action.type, config: action.config });
      // Logique d'exécution d'action (CRM, SMS, etc.) à implémenter ou déléguer au WorkflowEngine
      results.push({ type: action.type, status: 'executed' });
    }
    return results;
  }

  private interpolateText(text: string, context: ConversationContext): string {
    return text.replace(/{{(.*?)}}/g, (_, key) => {
      const value = key.trim().split('.').reduce((obj: any, k: string) => obj?.[k], context);
      return value !== undefined ? String(value) : `{{${key}}}`;
    });
  }
}
