import { AppError } from "@shared/_core/errors";
import { ACTION_TYPES, type ActionType } from "@shared/workflow/action-types";
import type { ActionConfig, ActionHandler } from "./types";
import { CreateLeadAction } from "./actions/crm/CreateLeadAction";
import { UpdateLeadAction } from "./actions/crm/UpdateLeadAction";
import { CreateAppointmentAction } from "./actions/crm/CreateAppointmentAction";
import { CreateReservationAction } from "./actions/crm/CreateReservationAction";
import { CreateTaskAction } from "./actions/crm/CreateTaskAction";
import { AddNoteAction } from "./actions/crm/AddNoteAction";
import { ChangeStatusAction } from "./actions/crm/ChangeStatusAction";
import { AddTagAction } from "./actions/crm/AddTagAction";
import { AssignAgentAction } from "./actions/crm/AssignAgentAction";
import { ExportDataAction } from "./actions/crm/ExportDataAction";
import { ReceiveCallAction } from "./actions/telephony/ReceiveCallAction";
import { InitiateCallAction } from "./actions/telephony/InitiateCallAction";
import { RecordCallAction } from "./actions/telephony/RecordCallAction";
import { TranscribeCallAction } from "./actions/telephony/TranscribeCallAction";
import { SendSMSAction } from "./actions/messaging/SendSMSAction";
import { SendWhatsAppAction } from "./actions/messaging/SendWhatsAppAction";
import { SendEmailAction } from "./actions/messaging/SendEmailAction";
import { NotifyAgentAction } from "./actions/messaging/NotifyAgentAction";
import { SpeakToCallerAction } from "./actions/dialogue/SpeakToCallerAction";
import { ListenAndUnderstandAction } from "./actions/dialogue/ListenAndUnderstandAction";
import { QueryBusinessEntitiesAction } from "./actions/dialogue/QueryBusinessEntitiesAction";
import { AIScoreAction } from "./actions/ai/AIScoreAction";
import { AISentimentAction } from "./actions/ai/AISentimentAction";
import { AISummaryAction } from "./actions/ai/AISummaryAction";
import { AIIntentAction } from "./actions/ai/AIIntentAction";
import { AICVDetectAction } from "./actions/ai/AICVDetectAction";
import { AICVExtractAction } from "./actions/ai/AICVExtractAction";
import { AICVClassifyAction } from "./actions/ai/AICVClassifyAction";
import { AICalculateAction } from "./actions/ai/AICalculateAction";
import { RequestPaymentAction } from "./actions/payment/RequestPaymentAction";
import { CreateOrderAction } from "./actions/payment/CreateOrderAction";
import { CreateDonationAction } from "./actions/payment/CreateDonationAction";
import { IfElseAction } from "./actions/logic/IfElseAction";
import { WebhookAction } from "./actions/technical/WebhookAction";
import { DriveAction } from "./actions/technical/DriveAction";

export type RegisteredActionHandler = ActionHandler<ActionConfig, unknown, unknown>;
export type ActionHandlerRegistry = Record<ActionType, RegisteredActionHandler>;

const registry: ActionHandlerRegistry = {
  create_lead: new CreateLeadAction(),
  update_lead: new UpdateLeadAction(),
  create_appointment: new CreateAppointmentAction(),
  create_reservation: new CreateReservationAction(),
  create_task: new CreateTaskAction(),
  add_note: new AddNoteAction(),
  crm_change_status: new ChangeStatusAction(),
  add_tag: new AddTagAction(),
  assign_agent: new AssignAgentAction(),
  export_data: new ExportDataAction(),
  receive_call: new ReceiveCallAction(),
  initiate_call: new InitiateCallAction(),
  record_call: new RecordCallAction(),
  transcribe_call: new TranscribeCallAction(),
  send_sms: new SendSMSAction(),
  send_whatsapp: new SendWhatsAppAction(),
  send_email: new SendEmailAction(),
  notify_agent: new NotifyAgentAction(),
  speak_to_caller: new SpeakToCallerAction(),
  listen_and_understand: new ListenAndUnderstandAction(),
  query_business_entities: new QueryBusinessEntitiesAction(),
  ai_score: new AIScoreAction(),
  ai_sentiment_analysis: new AISentimentAction(),
  ai_summary: new AISummaryAction(),
  ai_intent: new AIIntentAction(),
  ai_cv_detect: new AICVDetectAction(),
  ai_cv_extract: new AICVExtractAction(),
  ai_cv_classify: new AICVClassifyAction(),
  ai_calculate: new AICalculateAction(),
  request_payment: new RequestPaymentAction(),
  create_order: new CreateOrderAction(),
  create_donation: new CreateDonationAction(),
  logic_if_else: new IfElseAction(),
  tech_webhook: new WebhookAction(),
  drive_action: new DriveAction(),
};

function assertRegistryCompleteness(handlerRegistry: ActionHandlerRegistry): void {
  const registeredTypes = new Set(Object.keys(handlerRegistry));
  const missingTypes = ACTION_TYPES.filter((actionType) => !registeredTypes.has(actionType));

  if (missingTypes.length > 0) {
    throw new AppError("INVALID_WORKFLOW_DEFINITION", "Action registry is incomplete", {
      details: { missingTypes },
    });
  }
}

assertRegistryCompleteness(registry);

export class ActionRegistry {
  has(name: string): name is ActionType {
    return name in registry;
  }

  getHandler(name: string): RegisteredActionHandler {
    if (!this.has(name)) {
      throw new AppError("UNKNOWN_ACTION", `Unknown action type: ${name}`, {
        details: { availableTypes: ACTION_TYPES },
      });
    }

    return registry[name];
  }

  getAllHandlers(): RegisteredActionHandler[] {
    return ACTION_TYPES.map((actionType) => registry[actionType]);
  }

  listTypes(): ActionType[] {
    return [...ACTION_TYPES];
  }

  getRegistry(): ActionHandlerRegistry {
    return { ...registry };
  }
}

export const actionRegistry = new ActionRegistry();
