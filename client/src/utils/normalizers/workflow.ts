import { Workflow, WorkflowStep } from "../../../../shared/types/workflow";
import { workflowSchema } from "../../../../shared/validation/workflow";

/**
 * Normalise un objet Workflow pour garantir qu'il respecte la structure attendue par l'UI.
 * ✅ Bloc 3: Normalisation des données
 */
export function normalizeWorkflow(w: any): Workflow {
  // Validation runtime avec Zod
  const result = workflowSchema.safeParse(w);
  
  if (!result.success) {
    console.warn("[Normalizer] Workflow validation failed", result.error);
    // Fallback avec des valeurs par défaut sécurisées
    return {
      id: w?.id ?? 0,
      tenantId: w?.tenantId ?? 0,
      name: w?.name ?? "Sans nom",
      description: w?.description ?? null,
      triggerType: w?.triggerType ?? "manual",
      triggerConfig: w?.triggerConfig ?? {},
      actions: Array.isArray(w?.actions) ? w.actions : [],
      isActive: w?.isActive ?? false,
      createdAt: w?.createdAt ?? null,
      updatedAt: w?.updatedAt ?? null,
    };
  }

  const data = result.data;
  return {
    ...data,
    actions: data.actions ?? [],
  } as Workflow;
}

/**
 * Normalise une liste de workflows.
 */
export function normalizeWorkflows(workflows: any[]): Workflow[] {
  if (!Array.isArray(workflows)) return [];
  return workflows.map(normalizeWorkflow);
}
