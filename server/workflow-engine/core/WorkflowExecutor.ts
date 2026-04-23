import { z } from "zod";
import { AppError } from "../../../shared/_core/errors";
import {
  JsonValueSchema,
  parseWorkflowSteps,
  type WorkflowStepDefinition,
} from "../../../shared/workflow/contracts";
import type {
  ActionConfig,
  ActionResult,
  FinalExecutionContext,
  WorkflowExecutionResult,
  WorkflowExecutionStatus,
  WorkflowVariables,
} from "../../workflow-engine/types";
import { actionRegistry } from "../../workflow-engine/actionRegistry";
import { Logger } from "../../workflow-engine/utils/Logger";
import { PlaceholderEngine } from "../../workflow-engine/utils/PlaceholderEngine";

const ActionConfigSchema = z.record(JsonValueSchema);
const LogicBranchResultSchema = z.object({
  branch: z.enum(["if", "else"]),
});

export class WorkflowExecutor {
  private readonly logger = new Logger("WorkflowExecutor");
  private readonly globalTimeoutMs = 30000;
  private readonly maxSteps = 50;
  private readonly maxVisitsPerNode = 10;

  async execute(context: FinalExecutionContext): Promise<WorkflowExecutionResult<WorkflowVariables>> {
    const startTime = Date.now();
    let executionStatus: WorkflowExecutionStatus = "SUCCESS";
    const steps = parseWorkflowSteps(context.workflow.steps, `workflow:${context.workflow.id}.steps`);
    const visitedNodes = new Map<string, number>();

    if (steps.length === 0) {
      return this.failResult(context, "FAILED_INVALID_DEFINITION", "No steps to execute");
    }

    let currentStepIndex = 0;
    let stepCount = 0;

    while (currentStepIndex < steps.length) {
      if (Date.now() - startTime > this.globalTimeoutMs) {
        return this.failResult(context, "FAILED", `Timeout after ${this.globalTimeoutMs}ms`);
      }

      stepCount += 1;
      if (stepCount > this.maxSteps) {
        return this.failResult(context, "FAILED", "Maximum step count exceeded");
      }

      const step = steps[currentStepIndex];
      const stepName = step.name ?? step.label ?? `step_${String(step.id)}`;
      const visitKey = String(step.id);
      const visitCount = (visitedNodes.get(visitKey) ?? 0) + 1;
      visitedNodes.set(visitKey, visitCount);

      if (visitCount > this.maxVisitsPerNode) {
        return this.failResult(context, "FAILED", `Node visit limit exceeded for ${stepName}`);
      }

      try {
        const handler = actionRegistry.getHandler(step.type);
        const resolvedConfig = this.resolveStepConfig(step, context);

        if (!handler.validate(resolvedConfig)) {
          throw new AppError("VALIDATION_ERROR", `Invalid configuration for ${step.type}`, {
            details: { stepName, stepType: step.type, resolvedConfig },
          });
        }

        const result = await this.executeWithRetry(handler, context, resolvedConfig, step, stepName);
        context.steps_results[stepName] = result;

        if (!result.success) {
          executionStatus = step.stop_on_failure === false ? "PARTIAL" : "FAILED";
          if (executionStatus === "FAILED") {
            break;
          }
        }

        if (result.success && result.data && typeof result.data === "object") {
          Object.assign(context.variables, result.data);
        }

        if (step.type === "logic_if_else") {
          const nextIndex = this.resolveBranchedStepIndex(step, steps, result.data);
          if (typeof nextIndex === "number") {
            currentStepIndex = nextIndex;
            continue;
          }
          if (nextIndex === null) {
            break;
          }
        }
      } catch (error) {
        const appError = AppError.fromUnknown(
          "INTERNAL_ERROR",
          `Critical error in step ${stepName}`,
          error,
          { stepName, stepType: step.type, workflowId: context.workflow.id },
        );

        this.logger.error(appError.message, appError, appError.details);
        context.steps_results[stepName] = {
          success: false,
          error: appError.message,
        };
        executionStatus = "FAILED";
        break;
      }

      currentStepIndex += 1;
    }

    if (executionStatus === "FAILED") {
      await this.pushToDLQ(context);
    }

    return {
      status: executionStatus,
      workflow_id: context.workflow.id,
      variables: context.variables,
      results: context.steps_results,
    };
  }

  private resolveStepConfig(step: WorkflowStepDefinition, context: FinalExecutionContext): ActionConfig {
    const resolved = PlaceholderEngine.resolve(step.config, context);
    if (!resolved || typeof resolved !== "object" || Array.isArray(resolved)) {
      throw new AppError("VALIDATION_ERROR", `Resolved config is not an object for ${step.type}`, {
        details: { stepId: step.id, stepType: step.type },
      });
    }

    return ActionConfigSchema.parse(resolved);
  }

  private async executeWithRetry(
    handler: ReturnType<typeof actionRegistry.getHandler>,
    context: FinalExecutionContext,
    config: ActionConfig,
    step: WorkflowStepDefinition,
    stepName: string,
  ): Promise<ActionResult<unknown>> {
    const maxAttempts = Math.min(step.retry?.maxAttempts ?? 1, 3);
    const backoffMs = step.retry?.backoffMs ?? 0;
    const backoffMultiplier = step.retry?.backoffMultiplier ?? 1;
    let lastErrorMessage = "Unknown error";

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        const result = await handler.execute(context, config);
        if (result.success) {
          return result;
        }
        lastErrorMessage = result.error ?? lastErrorMessage;
      } catch (error) {
        const appError = AppError.fromUnknown(
          "INTERNAL_ERROR",
          `Action execution failed for ${stepName}`,
          error,
          { stepName, attempt },
        );
        lastErrorMessage = appError.message;
      }

      if (attempt < maxAttempts && backoffMs > 0) {
        const delayMs = Math.round(backoffMs * backoffMultiplier ** (attempt - 1));
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }

    return {
      success: false,
      error: `Failed after ${maxAttempts} attempts: ${lastErrorMessage}`,
    };
  }

  private resolveBranchedStepIndex(
    step: WorkflowStepDefinition,
    steps: WorkflowStepDefinition[],
    resultData: unknown,
  ): number | null | undefined {
    const parsedBranch = LogicBranchResultSchema.safeParse(resultData);
    if (!parsedBranch.success) {
      return undefined;
    }

    const nextStepId = parsedBranch.data.branch === "if" ? step.on_true : step.on_false;
    if (!nextStepId) {
      return undefined;
    }
    if (nextStepId === "END") {
      return null;
    }

    const targetIndex = steps.findIndex((candidate) => candidate.id === nextStepId || candidate.name === nextStepId);
    if (targetIndex === -1) {
      throw new AppError("INVALID_WORKFLOW_DEFINITION", `Invalid transition target ${String(nextStepId)}`, {
        details: { stepId: step.id, nextStepId },
      });
    }

    return targetIndex;
  }

  private failResult(
    context: FinalExecutionContext,
    status: WorkflowExecutionStatus,
    error: string,
  ): WorkflowExecutionResult<WorkflowVariables> {
    context.steps_results.CRITICAL_FAILURE = { success: false, error };
    return {
      status,
      workflow_id: context.workflow.id,
      variables: context.variables,
      results: context.steps_results,
    };
  }

  private async pushToDLQ(context: FinalExecutionContext): Promise<void> {
    try {
      const { dlqService } = await import("../../workflow-engine/utils/DLQService");
      await dlqService.push({
        workflowId: context.workflow.id,
        tenantId: context.tenant.id,
        eventId: context.event.id,
        executionId: context.executionId,
        payload: context.event,
        errors: context.steps_results,
        failedAt: new Date(),
      });
    } catch (error) {
      const appError = AppError.fromUnknown("INTERNAL_ERROR", "FAILED_TO_PUSH_TO_DLQ", error);
      this.logger.error(appError.message, appError, appError.details);
    }
  }
}
