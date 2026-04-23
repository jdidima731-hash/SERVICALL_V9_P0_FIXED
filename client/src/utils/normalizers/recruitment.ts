import { Interview } from "../../../../shared/types/recruitment";
import { interviewSchema } from "../../../../shared/validation/recruitment";

/**
 * Normalise un objet Interview pour garantir qu'il respecte la structure attendue par l'UI.
 * ✅ Bloc 3: Normalisation des données
 */
export function normalizeInterview(i: any): Interview {
  const result = interviewSchema.safeParse(i);
  
  if (!result.success) {
    console.warn("[Normalizer] Interview validation failed", result.error);
    
    return {
      id: i?.id ?? 0,
      tenantId: i?.tenantId ?? 0,
      candidateName: i?.candidateName ?? "Inconnu",
      candidateEmail: i?.candidateEmail ?? null,
      candidatePhone: i?.candidatePhone ?? "",
      jobPosition: i?.jobPosition ?? "",
      status: i?.status ?? "pending",
      scheduledAt: i?.scheduledAt ?? null,
      startedAt: i?.startedAt ?? null,
      completedAt: i?.completedAt ?? null,
      duration: i?.duration ?? null,
      recordingUrl: i?.recordingUrl ?? null,
      transcription: i?.transcription ?? null,
      summary: i?.summary ?? null,
      notesJson: i?.notesJson ?? null,
      recommendation: i?.recommendation ?? null,
      employerDecision: i?.employerDecision ?? null,
      employerNotes: i?.employerNotes ?? null,
      businessType: i?.businessType ?? null,
      createdAt: i?.createdAt ?? null,
      updatedAt: i?.updatedAt ?? null,
    } as Interview;
  }

  
  return result.data as Interview;
}

/**
 * Normalise une liste d'entretiens.
 */
export function normalizeInterviews(interviews: any[]): Interview[] {
  if (!Array.isArray(interviews)) return [];
  return interviews.map(normalizeInterview);
}