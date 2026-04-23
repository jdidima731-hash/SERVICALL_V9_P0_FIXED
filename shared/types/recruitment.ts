export type InterviewStatus =
  | "pending"
  | "scheduled"
  | "in_progress"
  | "completed"
  | "reviewed"
  | "shortlisted"
  | "rejected"
  | "cancelled";

export interface Interview {
  id: number;
  tenantId: number;
  candidateName?: string | null;
  candidateEmail?: string | null;
  candidatePhone?: string | null;
  jobPosition: string;
  businessType?: string | null;
  status: InterviewStatus;
  scheduledAt?: string | Date | null;
  startedAt?: string | Date | null;
  completedAt?: string | Date | null;
  duration?: number | null;
  recordingUrl?: string | null;
  transcription?: string | null;
  summary?: string | null;
  notesJson?: unknown | null;
  recommendation?: string | null;
  employerDecision?: string | null;
  employerNotes?: string | null;
  createdAt?: string | Date | null;
  updatedAt?: string | Date | null;
}

export interface InterviewStats {
  total: number;
  pending: number;
  scheduled: number;
  in_progress: number;
  completed: number;
  reviewed: number;
  shortlisted: number;
  rejected: number;
  cancelled: number;
  averageScore?: number;
}
