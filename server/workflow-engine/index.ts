/**
 * WORKFLOW ENGINE - MAIN EXPORT
 * Point d'entrée principal du moteur de workflows
 */

// Core Engine
export { WorkflowEngine } from './core/WorkflowEngine';
export { WorkflowExecutor } from './core/WorkflowExecutor';

// Types
export type {
  Channel,
  EventType,
  AnalysisType,
  Industry,
  IncomingEvent,
  ExecutionContext,
  ActionResult,
  ActionHandler
} from './types';

// Actions
export * from './actions';

// Templates
export type { WorkflowTemplate, WorkflowStep } from './templates/industryTemplates';
export { ALL_TEMPLATES, getTemplatesByIndustry, getTemplate } from './templates/industryTemplates';

// Utils
export { Logger } from './utils/Logger';
export { ConditionEvaluator } from './utils/ConditionEvaluator';
