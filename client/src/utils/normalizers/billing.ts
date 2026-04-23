import { Subscription, Invoice } from "../../../../shared/types/billing";
import { subscriptionSchema, invoiceSchema } from "../../../../shared/validation/billing";

/**
 * Normalise un objet Subscription.
 * ✅ Bloc 3: Normalisation des données
 */
export function normalizeSubscription(s: any): Subscription {
  const result = subscriptionSchema.safeParse(s);
  
  if (!result.success) {
    console.warn("[Normalizer] Subscription validation failed", result.error);
    return {
      id: s?.id ?? 0,
      tenantId: s?.tenantId ?? 0,
      plan: s?.plan ?? "free",
      status: s?.status ?? "inactive",
      currentPeriodStart: s?.currentPeriodStart ?? null,
      currentPeriodEnd: s?.currentPeriodEnd ?? null,
      stripeSubscriptionId: s?.stripeSubscriptionId ?? null,
      stripeCustomerId: s?.stripeCustomerId ?? null,
      callsIncluded: s?.callsIncluded ?? 0,
      agentSeats: s?.agentSeats ?? 0,
      createdAt: s?.createdAt ?? null,
      updatedAt: s?.updatedAt ?? null,
    } as Subscription;
  }

  
  return result.data as Subscription;
}

/**
 * Normalise un objet Invoice.
 */
export function normalizeInvoice(i: any): Invoice {
  const result = invoiceSchema.safeParse(i);
  
  if (!result.success) {
    console.warn("[Normalizer] Invoice validation failed", result.error);
    
    return {
      id: i?.id ?? 0,
      tenantId: i?.tenantId ?? 0,
      subscriptionId: i?.subscriptionId ?? null,
      invoiceNumber: i?.invoiceNumber ?? "INV-000",
      amount: i?.amount ?? 0,
      currency: i?.currency ?? "EUR",
      status: i?.status ?? "pending",
      stripeInvoiceId: i?.stripeInvoiceId ?? null,
      pdfUrl: i?.pdfUrl ?? null,
      dueDate: i?.dueDate ?? null,
      paidAt: i?.paidAt ?? null,
      createdAt: i?.createdAt ?? null,
      updatedAt: i?.updatedAt ?? null,
    } as Invoice;
  }

  
  return result.data as Invoice;
}

/**
 * Normalise une liste de factures.
 */
export function normalizeInvoices(invoices: any[]): Invoice[] {
  if (!Array.isArray(invoices)) return [];
  return invoices.map(normalizeInvoice);
}