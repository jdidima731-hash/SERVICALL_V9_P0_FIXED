/**
 * REALTIME WORKFLOW SERVICE
 * Exécution de workflows temps réel avec séquencement strict
 */

import { logger } from "../infrastructure/logger";
import { businessKnowledgeService } from "./BusinessKnowledgeService";
import { 
  type WorkflowAction, 
  type WorkflowContext, 
  type WorkflowExecutionResult, 
  type WorkflowStepLog 
} from "./types";

export class RealtimeWorkflowService {
  private static readonly DEFAULT_TIMEOUT = 30000;
  private static readonly DEFAULT_MAX_RETRIES = 3;
  private static readonly DEFAULT_RETRY_DELAY = 1000;

  static async executeWorkflow(
    actions: WorkflowAction[],
    context: WorkflowContext
  ): Promise<{
    success: boolean;
    results: WorkflowExecutionResult[];
    logs: WorkflowStepLog[];
    totalDuration: number;
  }> {
    const startTime = Date.now();
    const results: WorkflowExecutionResult[] = [];
    const logs: WorkflowStepLog[] = [];

    logger.info("[RealtimeWorkflow] Starting workflow execution", {
      tenantId: context.tenantId,
      callId: context.callId,
      actionCount: actions.length,
    });

    try {
      for (const action of actions) {
        const stepLog: WorkflowStepLog = {
          id: `${action.id}-${Date.now()}`,
          stepId: action.id,
          action: action.type,
          status: "pending",
          startTime: new Date().toISOString(),
        };

        logs.push(stepLog);

        try {
          stepLog.status = "running";
          const result = await this.executeActionWithRetry(action, context);
          
          stepLog.status = "success";
          stepLog.output = result.output;
          stepLog.endTime = new Date().toISOString();
          stepLog.duration = result.duration;

          results.push(result);

          if (result.output && typeof result.output === "object") {
            context.variables = {
              ...context.variables,
              [`${action.id}_result`]: result.output,
            };
          }
        } catch (error: any) {
          const errorMessage = error instanceof Error ? (error instanceof Error ? error.message : String(error)) : String(error);
          stepLog.status = "error";
          stepLog.error = errorMessage;
          stepLog.endTime = new Date().toISOString();

          if (action.config['continueOnError'] !== true) {
            throw error;
          }
        }
      }

      return {
        success: true,
        results,
        logs,
        totalDuration: Date.now() - startTime,
      };
    } catch (error: any) {
      return {
        success: false,
        results,
        logs,
        totalDuration: Date.now() - startTime,
      };
    }
  }

  private static async executeActionWithRetry(
    action: WorkflowAction,
    context: WorkflowContext
  ): Promise<WorkflowExecutionResult> {
    const maxRetries = action.retryPolicy?.maxRetries ?? this.DEFAULT_MAX_RETRIES;
    const retryDelay = action.retryPolicy?.delayMs ?? this.DEFAULT_RETRY_DELAY;
    const timeout = action.timeout ?? this.DEFAULT_TIMEOUT;

    let lastError: any = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
        }
        return await this.executeActionWithTimeout(action, context, timeout);
      } catch (error: any) {
        lastError = error;
      }
    }

    throw lastError || new Error("Action failed after all retries");
  }

  private static async executeActionWithTimeout(
    action: WorkflowAction,
    context: WorkflowContext,
    timeoutMs: number
  ): Promise<WorkflowExecutionResult> {
    const startTime = Date.now();

    const executionPromise = this.executeAction(action, context);
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Action timeout after ${timeoutMs}ms`)), timeoutMs)
    );

    const result = await Promise.race([executionPromise, timeoutPromise]);
    
    return {
      ...result,
      duration: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    };
  }

  private static async executeAction(
    action: WorkflowAction,
    context: WorkflowContext
  ): Promise<Omit<WorkflowExecutionResult, "duration" | "timestamp">> {
    const { type, config } = action;
    const resolvedConfig = this.resolveVariables(config, context.variables);

    switch (type) {
      case "query_business_entities":
        return await this.queryBusinessEntities(resolvedConfig, context);
      case "speak_to_caller":
        return await this.speakToCaller(resolvedConfig, context);
      case "listen_and_understand":
        return await this.listenAndUnderstand(resolvedConfig, context);
      case "send_sms":
        return await this.sendSms(resolvedConfig, context);
      case "send_email":
        return await this.sendEmail(resolvedConfig, context);
      case "create_appointment":
        return await this.createAppointment(resolvedConfig, context);
      case "update_crm":
        return await this.updateCrm(resolvedConfig, context);
      case "webhook":
        return await this.callWebhook(resolvedConfig, context);
      default:
        throw new Error(`Unknown action type: ${type}`);
    }
  }

  private static async queryBusinessEntities(config: Record<string, unknown>, context: WorkflowContext) {
    const query = String(config['query'] || "");
    const type = config['type'] ? String(config['type']) : undefined;
    const entities = await businessKnowledgeService.searchEntities(context.tenantId, query, type);
    return { success: true, actionId: "query_business_entities", output: { entities, count: entities.length } };
  }

  private static async speakToCaller(config: Record<string, unknown>, _context: WorkflowContext) {
    logger.info("[RealtimeWorkflow] Speaking to caller", { text: config['text'] });
    return { success: true, actionId: "speak_to_caller", output: { status: "spoken" } };
  }

  private static async listenAndUnderstand(config: Record<string, unknown>, _context: WorkflowContext) {
    logger.info("[RealtimeWorkflow] Listening to caller", { timeout: config['timeout'] });
    return { success: true, actionId: "listen_and_understand", output: { transcript: "Simulated transcript", intent: "Simulated intent" } };
  }

  private static async sendSms(config: Record<string, unknown>, _context: WorkflowContext) {
    logger.info("[RealtimeWorkflow] Sending SMS", { to: config['to'] });
    return { success: true, actionId: "send_sms", output: { sent: true, messageId: "sim_msg_123" } };
  }

  private static async sendEmail(config: Record<string, unknown>, _context: WorkflowContext) {
    logger.info("[RealtimeWorkflow] Sending Email", { to: config['to'] });
    return { success: true, actionId: "send_email", output: { sent: true, emailId: "sim_eml_123" } };
  }

  private static async createAppointment(config: Record<string, unknown>, _context: WorkflowContext) {
    logger.info("[RealtimeWorkflow] Creating appointment", { title: config['title'] });
    return { success: true, actionId: "create_appointment", output: { appointmentId: 999, status: "confirmed" } };
  }

  private static async updateCrm(config: Record<string, unknown>, _context: WorkflowContext) {
    logger.info("[RealtimeWorkflow] Updating CRM", { data: config['data'] });
    return { success: true, actionId: "update_crm", output: { updated: true } };
  }

  private static async callWebhook(config: Record<string, unknown>, _context: WorkflowContext) {
    logger.info("[RealtimeWorkflow] Calling webhook", { url: config['url'] });
    return { success: true, actionId: "webhook", output: { statusCode: 200, body: {} } };
  }

  private static resolveVariables(config: Record<string, unknown>, variables: Record<string, unknown>): Record<string, unknown> {
    const configStr = JSON.stringify(config);
    const resolvedStr = configStr.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
      const value = this.getNestedValue(variables, path.trim());
      return value !== undefined ? String(value) : match;
    });
    return JSON.parse(resolvedStr);
  }

  private static getNestedValue(obj: Record<string, unknown>, path: string): any {
    return path.split('.').reduce((prev: any, curr) => prev && prev[curr], obj);
  }
}
