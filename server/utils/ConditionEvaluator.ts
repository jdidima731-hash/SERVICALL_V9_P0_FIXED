/**
 * CONDITION EVALUATOR — PONT D'IMPORT
 * Re-export depuis workflow-engine/utils/ConditionEvaluator
 * pour résoudre les imports "../../utils/ConditionEvaluator"
 * depuis server/workflow-engine/actions/*.ts
 */
export type { Rule, ConditionGroup } from "../workflow-engine/utils/ConditionEvaluator";
export { ConditionEvaluator } from "../workflow-engine/utils/ConditionEvaluator";
