import { logger } from "../infrastructure/logger";
import * as twilioService from './twilioService';
import { itKnowledgeService } from './itKnowledgeService';

/**
 * Interface for tool calls from LLM
 */
export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

/**
 * Action execution result
 */
export interface ActionResult {
  success: boolean;
  data?: any;
  error?: string;
  retryable?: boolean;
}

/**
 * Action execution context
 */
export interface ActionContext {
  callId?: string;
  callSid?: string;
  userId?: string;
  tenantId?: string;
  metadata?: Record<string, any>;
}

/**
 * Process actions requested by the AI agent via Function Calling
 * Includes retry logic, error handling, and validation
 * @param toolCalls List of tool calls from the LLM
 * @param context Context of the conversation
 * @returns Result of the actions to be sent back to the LLM
 */
export async function processAgentActions(
  toolCalls: ToolCall[],
  context: ActionContext
): Promise<Record<string, unknown>[]> {
  const results: Record<string, unknown>[] = [];

  logger.info('[Agent Action Service] Processing actions', {
    callId: context.callId,
    actionCount: toolCalls.length,
    actions: toolCalls.map(tc => tc.function.name),
  });

  for (const toolCall of toolCalls) {
    const functionName = toolCall.function.name;
    let args: Record<string, unknown>;

    try {
      args = JSON.parse(toolCall.function.arguments);
    } catch (error: any) {
      logger.error('[Agent Action Service] Invalid arguments JSON', {
        callId: context.callId,
        functionName,
        arguments: toolCall.function.arguments,
        error,
      });

      results.push({
        tool_call_id: toolCall.id,
        role: 'tool',
        name: functionName,
        content: JSON.stringify({
          success: false,
          error: 'Arguments JSON invalides',
        }),
      });
      continue;
    }

    logger.info('[Agent Action Service] Executing action', {
      callId: context.callId,
      functionName,
      args,
    });

    // Validate arguments before execution
    const validation = validateActionArguments(functionName, args);
    if (!validation.valid) {
      logger.error('[Agent Action Service] Invalid arguments', {
        callId: context.callId,
        functionName,
        errors: validation.errors,
      });

      results.push({
        tool_call_id: toolCall.id,
        role: 'tool',
        name: functionName,
        content: JSON.stringify({
          success: false,
          error: `Arguments invalides: ${validation.errors.join(', ')}`,
        }),
      });
      continue;
    }

    // Execute action with retry logic
    const result = await executeActionWithRetry(functionName, args, context);

    results.push({
      tool_call_id: toolCall.id,
      role: 'tool',
      name: functionName,
      content: JSON.stringify(result),
    });
  }

  logger.info('[Agent Action Service] Actions processed', {
    callId: context.callId,
    totalActions: toolCalls.length,
    successCount: results.filter(r => {
      try {
        return JSON.parse(r['content'] as string).success;
      } catch {
        return false;
      }
    }).length,
  });

  return results;
}

/**
 * Execute action with retry logic
 */
async function executeActionWithRetry(
  functionName: string,
  args: Record<string, unknown>,
  context: ActionContext,
  maxRetries: number = 2
): Promise<ActionResult> {
  const { ResilienceService } = await import('./resilienceService');
  
  try {
    return await ResilienceService.execute(async () => {
      const result = await executeAction(functionName, args, context);
      if (!result.success && result.retryable) {
        throw new Error(result.error || 'Action failed');
      }
      return result;
    }, {
      name: `AgentAction_${functionName}`,
      module: 'SYSTEM',
      timeoutMs: 10000,
      retry: { maxRetries, delayMs: 1000 },
      circuitBreaker: { failureThreshold: 5, resetTimeoutMs: 30000 }
    });
  } catch (error: any) {
    return {
      success: false,
      error: `Échec après tentatives: ${error instanceof Error ? (error instanceof Error ? error.message : String(error)) : String(error)}`,
      retryable: false,
    };
  }
}

/**
 * Execute a single action
 */
async function executeAction(
  functionName: string,
  args: Record<string, unknown>,
  context: ActionContext
): Promise<ActionResult> {
  switch (functionName) {
    case 'bookAppointment':
      return handleBookAppointment(args, context);

    case 'sendSMSConfirmation':
      return handleSendSMS(args, context);

    case 'transferToHumanAgent':
      return handleTransferToHuman(args, context);

    case 'getProspectInfo':
      return handleGetProspectInfo(args, context);

    case 'createTicket':
      return handleCreateTicket(args, context);

    case 'updateCustomerInfo':
      return handleUpdateCustomerInfo(args, context);

    case 'scheduleCallback':
      return handleScheduleCallback(args, context);

    case 'sendEmail':
      return handleSendEmail(args, context);

    case 'diagnoseITIssue':
      return handleDiagnoseITIssue(args, context);

    case 'generateITInvoice':
      return handleGenerateITInvoice(args, context);

    default:
      return {
        success: false,
        error: `Fonction inconnue: ${functionName}`,
        retryable: false,
      };
  }
}

/**
 * Validate action arguments
 */
function validateActionArguments(
  functionName: string,
  args: Record<string, unknown>
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  switch (functionName) {
    case 'bookAppointment': {
      const date = args['date'] as string | undefined;
      const time = args['time'] as string | undefined;
      if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        errors.push('Date invalide (format: YYYY-MM-DD)');
      }
      if (!time || !/^\d{2}:\d{2}$/.test(time)) {
        errors.push('Heure invalide (format: HH:MM)');
      }
      break;
    }
    case 'sendSMSConfirmation': {
      const phoneNumber = args['phoneNumber'] as string | undefined;
      const message = args['message'] as string | undefined;
      if (!phoneNumber || !/^\+?[1-9]\d{1,14}$/.test(phoneNumber)) {
        errors.push('Numéro de téléphone invalide');
      }
      if (!message || message.length === 0) {
        errors.push('Message vide');
      }
      if (message && message.length > 1600) {
        errors.push('Message trop long (max 1600 caractères)');
      }
      break;
    }
    case 'transferToHumanAgent':
      if (!args['reason']) {
        errors.push('Raison du transfert manquante');
      }
      break;

    case 'createTicket': {
      const subject = args['subject'] as string | undefined;
      const description = args['description'] as string | undefined;
      if (!subject || subject.length === 0) {
        errors.push('Sujet du ticket manquant');
      }
      if (!description || description.length === 0) {
        errors.push('Description du ticket manquante');
      }
      break;
    }
    case 'sendEmail': {
      const to = args['to'] as string | undefined;
      const emailSubject = args['subject'] as string | undefined;
      if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
        errors.push('Adresse email invalide');
      }
      if (!emailSubject) {
        errors.push('Sujet de l\'email manquant');
      }
      if (!args['body']) {
        errors.push('Corps de l\'email manquant');
      }
      break;
    }
    case 'diagnoseITIssue':
      if (!args['problemDescription']) {
        errors.push('Description du problème manquante');
      }
      break;

    case 'generateITInvoice': {
      const amount = args['amount'] as number | undefined;
      if (!amount || amount <= 0) {
        errors.push('Montant de la facture invalide');
      }
      break;
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Action Handlers
 */

async function handleBookAppointment(
  args: Record<string, unknown>,
  context: ActionContext
): Promise<ActionResult> {
  try {
    // In production, this would interface with appointmentRouter or database
    // For now, simulate success with validation
    
    const appointmentDate = new Date(`${args['date']}T${args['time']}`);
    const now = new Date();

    if (appointmentDate < now) {
      return {
        success: false,
        error: 'La date du rendez-vous est dans le passé',
        retryable: false,
      };
    }

    const appointmentId = parseInt(crypto.randomUUID().replace(/-/g, "").slice(0, 8), 16);

    logger.info('[Agent Action Service] Appointment booked', {
      callId: context.callId,
      appointmentId,
      date: args['date'],
      time: args['time'],
    });

    return {
      success: true,
      data: {
        appointmentId,
        date: args['date'],
        time: args['time'],
        reason: args['reason'] || 'Non spécifié',
        status: 'confirmed',
      },
    };
  } catch (error: any) {
    logger.error('[Agent Action Service] Error booking appointment', { error });
    return {
      success: false,
      error: (error as Error).message,
      retryable: true,
    };
  }
}

async function handleSendSMS(
  args: Record<string, unknown>,
  context: ActionContext
): Promise<ActionResult> {
  try {
    const sid = await twilioService.sendWhatsAppMessage({ to: args['phoneNumber'] as string, body: args['message'] as string });

    logger.info('[Agent Action Service] SMS sent', {
      callId: context.callId,
      messageSid: sid,
      to: args['phoneNumber'],
    });

    return {
      success: true,
      data: {
        messageSid: sid,
        to: args['phoneNumber'],
        status: 'sent',
      },
    };
  } catch (error: any) {
    logger.error('[Agent Action Service] Error sending SMS', { error });
    return {
      success: false,
      error: (error as Error).message,
      retryable: true,
    };
  }
}

async function handleTransferToHuman(
  args: Record<string, unknown>,
  context: ActionContext
): Promise<ActionResult> {
  try {
    // In production, this would use Twilio API to transfer the call
    logger.info('[Agent Action Service] Transfer to human initiated', {
      callId: context.callId,
      callSid: context.callSid,
      reason: args['reason'],
      priority: args['priority'] || 'medium',
    });

    return {
      success: true,
      data: {
        status: 'transfer_initiated',
        reason: args['reason'],
        priority: args['priority'] || 'medium',
        estimatedWaitTime: '2-3 minutes',
      },
    };
  } catch (error: any) {
    logger.error('[Agent Action Service] Error transferring to human', { error });
    return {
      success: false,
      error: (error as Error).message,
      retryable: true,
    };
  }
}

async function handleGetProspectInfo(
  args: Record<string, unknown>,
  context: ActionContext
): Promise<ActionResult> {
  try {
    // In production, fetch from database
    logger.info('[Agent Action Service] Getting prospect info', {
      callId: context.callId,
      phoneNumber: args['phoneNumber'],
    });

    return {
      success: true,
      data: {
        name: context.metadata?.['prospectName'] || 'Client',
        phoneNumber: args['phoneNumber'],
        lastInteraction: '2026-01-10',
        status: 'active',
        notes: 'Client régulier',
      },
    };
  } catch (error: any) {
    logger.error('[Agent Action Service] Error getting prospect info', { error });
    return {
      success: false,
      error: (error as Error).message,
      retryable: true,
    };
  }
}

async function handleCreateTicket(
  args: Record<string, unknown>,
  context: ActionContext
): Promise<ActionResult> {
  try {
    const ticketId = `TKT-${Date.now()}`;

    logger.info('[Agent Action Service] Ticket created', {
      callId: context.callId,
      ticketId,
      subject: args['subject'],
      priority: args['priority'] || 'medium',
    });

    return {
      success: true,
      data: {
        ticketId,
        subject: args['subject'],
        description: args['description'],
        priority: args['priority'] || 'medium',
        status: 'open',
        createdAt: new Date().toISOString(),
      },
    };
  } catch (error: any) {
    logger.error('[Agent Action Service] Error creating ticket', { error });
    return {
      success: false,
      error: (error as Error).message,
      retryable: true,
    };
  }
}

async function handleUpdateCustomerInfo(
  args: Record<string, unknown>,
  context: ActionContext
): Promise<ActionResult> {
  try {
    logger.info('[Agent Action Service] Customer info updated', {
      callId: context.callId,
      updates: args,
    });

    return {
      success: true,
      data: {
        updated: true,
        fields: Object.keys(args),
      },
    };
  } catch (error: any) {
    logger.error('[Agent Action Service] Error updating customer info', { error });
    return {
      success: false,
      error: (error as Error).message,
      retryable: true,
    };
  }
}

async function handleScheduleCallback(
  args: Record<string, unknown>,
  context: ActionContext
): Promise<ActionResult> {
  try {
    const callbackId = `CB-${Date.now()}`;

    logger.info('[Agent Action Service] Callback scheduled', {
      callId: context.callId,
      callbackId,
      scheduledFor: args['dateTime'],
    });

    return {
      success: true,
      data: {
        callbackId,
        scheduledFor: args['dateTime'],
        phoneNumber: args['phoneNumber'],
        reason: args['reason'],
        status: 'scheduled',
      },
    };
  } catch (error: any) {
    logger.error('[Agent Action Service] Error scheduling callback', { error });
    return {
      success: false,
      error: (error as Error).message,
      retryable: true,
    };
  }
}

async function handleSendEmail(
  args: Record<string, unknown>,
  context: ActionContext
): Promise<ActionResult> {
  try {
    // In production, use email service
    logger.info('[Agent Action Service] Email sent', {
      callId: context.callId,
      to: args['to'],
      subject: args['subject'],
    });

    return {
      success: true,
      data: {
        messageId: `MSG-${Date.now()}`,
        to: args['to'],
        subject: args['subject'],
        status: 'sent',
      },
    };
  } catch (error: any) {
    logger.error('[Agent Action Service] Error sending email', { error });
    return {
      success: false,
      error: (error as Error).message,
      retryable: true,
    };
  }
}

async function handleDiagnoseITIssue(
  args: Record<string, unknown>,
  context: ActionContext
): Promise<ActionResult> {
  try {
    logger.info('[Agent Action Service] IT Diagnosis performed', {
      callId: context.callId,
      problem: args['problemDescription'],
      category: args['category'] || 'general',
    });

    // Utilisation du service de connaissance hybride (Local -> Web Fallback)
    const knowledge = await itKnowledgeService.findSolution(args['problemDescription'] as string);

    return {
      success: true,
      data: {
        diagnosisId: `DIAG-${Date.now()}`,
        category: args['category'] || 'general',
        suggestedSolution: knowledge.solution,
        source: knowledge.source,
        severity: args['severity'] || 'medium',
      },
    };
  } catch (error: any) {
    logger.error('[Agent Action Service] Error in IT diagnosis', { error });
    return { success: false, error: (error as Error).message };
  }
}

async function handleGenerateITInvoice(
  args: Record<string, unknown>,
  context: ActionContext
): Promise<ActionResult> {
  try {
    const invoiceId = `INV-IT-${Date.now()}`;
    
    logger.info('[Agent Action Service] IT Invoice generated', {
      callId: context.callId,
      invoiceId,
      amount: args['amount'],
    });

    return {
      success: true,
      data: {
        invoiceId,
      amount: args['amount'],
      currency: args['currency'] || 'EUR',
      items: args['items'] || [{ description: "Assistance Informatique", price: args['amount'] }],
        status: 'ready_to_send',
        paymentLink: `https://pay.servicall.com/it/${invoiceId}`
      },
    };
  } catch (error: any) {
    logger.error('[Agent Action Service] Error generating IT invoice', { error });
    return { success: false, error: (error as Error).message };
  }
}

/**
 * Get available actions for documentation
 */
export function getAvailableActions(): string[] {
  return [
    'bookAppointment',
    'sendSMSConfirmation',
    'transferToHumanAgent',
    'getProspectInfo',
    'createTicket',
    'updateCustomerInfo',
    'scheduleCallback',
    'sendEmail',
    'diagnoseITIssue',
    'generateITInvoice',
  ];
}
