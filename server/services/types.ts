/**
 * CENTRALIZED SERVICE TYPES
 * Définition des interfaces et types partagés pour les services
 */


// ============================================
// COMMON TYPES
// ============================================

export interface PaginationParams {
  limit?: number;
  offset?: number;
}

export interface SearchParams extends PaginationParams {
  query?: string;
}

// ============================================
// WORKFLOW TYPES
// ============================================

export type WorkflowActionType =
  | "query_business_entities"
  | "speak_to_caller"
  | "listen_and_understand"
  | "send_sms"
  | "send_email"
  | "create_appointment"
  | "update_crm"
  | "webhook";

export interface WorkflowAction {
  id: string;
  type: WorkflowActionType;
  config: Record<string, unknown>;
  retryPolicy?: {
    maxRetries: number;
    delayMs: number;
  };
  timeout?: number;
}

export interface WorkflowContext {
  tenantId: number;
  callId?: number;
  prospectId?: number;
  userId?: number;
  variables: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface WorkflowExecutionResult {
  success: boolean;
  actionId: string;
  output?: any;
  error?: string;
  duration: number;
  timestamp: string;
}

export interface WorkflowStepLog {
  id: string;
  stepId: string;
  action: WorkflowActionType;
  status: "pending" | "running" | "success" | "error" | "timeout";
  from?: string;
  to?: string;
  input?: any;
  output?: any;
  error?: string;
  startTime: string;
  endTime?: string;
  duration?: number;
}

// ============================================
// BUSINESS KNOWLEDGE TYPES
// ============================================

export interface BusinessEntityFilter {
  type?: string;
  isActive?: boolean;
  searchTerm?: string;
}

export interface BusinessEntityCreate {
  tenantId: number;
  type: string;
  title: string;
  description?: string;
  price?: number;
  vatRate?: number;
  availabilityJson?: Record<string, unknown>;
  metadataJson?: Record<string, unknown>;
  isActive?: boolean;
}

export interface BusinessEntityUpdate {
  type?: string;
  title?: string;
  description?: string;
  price?: number;
  vatRate?: number;
  availabilityJson?: Record<string, unknown>;
  metadataJson?: Record<string, unknown>;
  isActive?: boolean;
}

// ============================================
// LOGGING & MONITORING TYPES
// ============================================

export interface LogContext {
  id?: string;
  severity?: "low" | "medium" | "high" | "critical";
  correlationId?: string;
  tenantId?: number | null;
  userId?: number | null;
  module?: "API" | "DB" | "AUTH" | "WORKFLOW" | "TWILIO" | "IA" | "SYSTEM" | "AUDIT";
  [key: string]: any;
}
