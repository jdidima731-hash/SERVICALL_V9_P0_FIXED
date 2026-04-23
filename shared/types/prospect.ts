// Import removed: prospects type not used in this file

export type ProspectStatus = "new" | "contacted" | "qualified" | "converted" | "lost";

export type Prospect = {
  id: number;
  tenantId: number;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  company: string | null;
  jobTitle: string | null;
  source: string | null;
  status: ProspectStatus | null;
  assignedTo: number | null;
  notes: string | null;
  priority: string | null;
  dueDate: string | null;
  metadata: any | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export interface CreateProspectInput {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  company?: string;
  jobTitle?: string;
  source?: string;
  status?: ProspectStatus;
  assignedTo?: number;
  notes?: string;
  priority?: string;
  metadata?: any;
}
