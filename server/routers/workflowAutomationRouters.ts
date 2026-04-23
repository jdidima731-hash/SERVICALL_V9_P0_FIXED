/**
 * Workflow Automation Routers (Groupe 1)
 * Contient tous les routers liés aux workflows et à l'exécution d'automatisations
 * Scission de aiAutomationRouters pour réduire la profondeur d'inférence tRPC
 */

import { router } from "../_core/trpc";
import { workflowRouter } from "./workflowRouter";
import { workflowEngineRouter } from "./workflowEngineRouter";
import { realtimeWorkflowRouter } from "./realtimeWorkflowRouter";
import { workflowBuilderRouter } from "./workflowBuilderRouter";

export const workflowAutomationRouter = router({
  workflow: workflowRouter,
  workflows: workflowRouter, // alias compatibilité client
  workflowEngine: workflowEngineRouter,
  realtimeWorkflow: realtimeWorkflowRouter,
  workflowBuilder: workflowBuilderRouter,
});
