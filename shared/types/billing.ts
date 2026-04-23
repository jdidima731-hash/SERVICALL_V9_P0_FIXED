export interface Subscription {
  id: number;
  tenantId: number;
  plan: string;
  status: string;
  currentPeriodStart?: string | Date | null;
  currentPeriodEnd?: string | Date | null;
  stripeSubscriptionId?: string | null;
  stripeCustomerId?: string | null;
  callsIncluded?: number;
  agentSeats?: number;
  createdAt?: string | Date | null;
  updatedAt?: string | Date | null;
}

export interface Invoice {
  id: number;
  tenantId: number;
  subscriptionId?: number | null;
  invoiceNumber: string;
  amount: number;
  currency: string;
  status: string;
  stripeInvoiceId?: string | null;
  pdfUrl?: string | null;
  dueDate?: string | Date | null;
  paidAt?: string | Date | null;
  createdAt?: string | Date | null;
  updatedAt?: string | Date | null;
}

export interface BillingStats {
  totalRevenue: number;
  totalInvoices: number;
  paidInvoices: number;
  pendingInvoices: number;
  averageInvoiceAmount: number;
}

export interface UsageStats {
  totalCalls: number;
  callsInPeriod: number;
  totalDuration: number;
  averageDuration: number;
  plan: string;
  callsIncluded: number;
  callsRemaining: number;
  usagePercentage: number;
}

export interface Plan {
  id: string;
  name: string;
  price: number;
  currency: string;
  callsIncluded: number;
  agentSeats: number;
  features: string[];
}
