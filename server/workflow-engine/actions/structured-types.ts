/**
 * RE-EXPORT PROXY — structured-types
 * Les actions dans actions/crm/, actions/ai/, etc. importent '../structured-types'
 * qui résout vers ce fichier. Re-export depuis le vrai module.
 */
export type {
  ProspectData,
  CallData,
  AIData,
  WorkflowVariables,
  EventMetadata,
  StructuredIncomingEvent,
  FinalExecutionContext,
} from '../structured-types';
