import { AppError } from "../../../shared/_core/errors";
import { parseWorkflowSteps, type WorkflowStepDefinition } from "../../../shared/workflow/contracts";
import { actionRegistry } from "../../workflow-engine/actionRegistry";
import type { Workflow } from "../../workflow-engine/types";

export interface SimulationLog {
  stepName: string;
  stepType: string;
  status: "pending" | "running" | "completed" | "failed" | "skipped";
  message: string;
  timestamp: string;
  data?: Record<string, unknown>;
}

export interface SimulationResult {
  success: boolean;
  logs: SimulationLog[];
  finalVariables: Record<string, unknown>;
  duration: number;
}

const deterministicSimulationResults: Partial<Record<WorkflowStepDefinition["type"], Record<string, unknown>>> = {
  ai_sentiment_analysis: { sentiment: "positif", score: 0.85, detected_intent: "demande_info" },
  ai_summary: {
    summary: "Le client souhaite obtenir des informations sur les tarifs et les disponibilités pour la semaine prochaine.",
  },
  ai_score: { lead_score: 75, hot_lead: true },
  create_task: { taskId: "task_simulated_0001", status: "created" },
  send_sms: { sms_sent: true, sent_to: "+33000000000" },
  send_email: { email_sent: true, template: "default" },
};

export class WorkflowSimulator {
  async simulate(workflow: Workflow, mockData: Record<string, unknown> = {}): Promise<SimulationResult> {
    const startTime = Date.now();
    const logs: SimulationLog[] = [];
    const variables: Record<string, unknown> = { ...mockData };
    const steps = parseWorkflowSteps(workflow.steps, `workflow:${workflow.id}.steps`);

    const addLog = (
      stepName: string,
      stepType: string,
      status: SimulationLog["status"],
      message: string,
      data?: Record<string, unknown>,
    ): void => {
      logs.push({
        stepName,
        stepType,
        status,
        message,
        timestamp: new Date().toISOString(),
        data,
      });
    };

    addLog("System", "start", "completed", `Démarrage de la simulation pour le workflow: ${workflow.name}`);

    try {
      for (const [index, step] of steps.entries()) {
        const stepName = step.name ?? step.label ?? `Étape ${index + 1}`;
        addLog(stepName, step.type, "running", `Simulation de l'étape: ${stepName}`);

        if (!actionRegistry.has(step.type)) {
          throw new AppError("UNKNOWN_ACTION", `Unknown action type: ${step.type}`, {
            details: { workflowId: workflow.id, stepId: step.id },
          });
        }

        const simulatedPayload = deterministicSimulationResults[step.type] ?? {
          simulated_action: step.type,
          step_id: String(step.id),
        };

        Object.assign(variables, simulatedPayload);
        addLog(stepName, step.type, "completed", `Action ${step.type} simulée avec succès.`, simulatedPayload);
      }
    } catch (error) {
      const appError = AppError.fromUnknown("INTERNAL_ERROR", "Workflow simulation failed", error, {
        workflowId: workflow.id,
      });
      addLog("System", "error", "failed", appError.message, appError.details);
      return {
        success: false,
        logs,
        finalVariables: variables,
        duration: Date.now() - startTime,
      };
    }

    addLog("System", "end", "completed", "Simulation terminée avec succès.");

    return {
      success: true,
      logs,
      finalVariables: variables,
      duration: Date.now() - startTime,
    };
  }
}
