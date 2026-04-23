/**
 * DRIZZLE RELATIONS — Servicall V8
 * Définit les relations entre tables pour activer db.query.X.findMany({ with: {} })
 * Basé sur les foreign keys réelles des fichiers schema-*.ts
 */
import { relations } from "drizzle-orm";
import {
  tenants, users, tenantUsers,
  prospects, calls, campaigns, campaignProspects,
  workflows, workflowExecutions,
} from "./schema";
import { appointments, appointmentReminders, tasks, documents } from "./schema-tasks";
import { deals } from "./schema-deals";
import { recordings, scheduledCallbacks, agentSwitchHistory, callScoring, callExecutionMetrics, simulatedCalls } from "./schema-calls";
import { aiSuggestions } from "./schema-ai";
import { coachingFeedback } from "./schema-coaching";
import { socialPosts } from "./schema-social";
import { orders, orderItems, customerInvoices } from "./schema-billing";
import { leads } from "./schema-byok-services";
import { messages, invoices, subscriptions, auditLogs, jobs } from "./schema-missing";
import { user2FA } from "./schema-compliance";
import { bookings, interventions, legalCases, medicalAppointments, restaurantOrders, shipments } from "./schema-industries";
import { candidateInterviews } from "./schema-recruitment";

// ─── TENANTS ─────────────────────────────────────────────────────────────────
export const tenantsRelations = relations(tenants, ({ many }) => ({
  users:              many(tenantUsers),
  prospects:          many(prospects),
  calls:              many(calls),
  campaigns:          many(campaigns),
  workflows:          many(workflows),
  appointments:       many(appointments),
  tasks:              many(tasks),
  deals:              many(deals),
  documents:          many(documents),
  messages:           many(messages),
  invoices:           many(invoices),
  subscriptions:      many(subscriptions),
  leads:              many(leads),
}));

// ─── USERS ───────────────────────────────────────────────────────────────────
export const usersRelations = relations(users, ({ many, one }) => ({
  tenants:            many(tenantUsers),
  assignedProspects:  many(prospects),
  calls:              many(calls),
  deals:              many(deals),
  auditLogs:          many(auditLogs),
  socialPosts:        many(socialPosts),
  simulatedCalls:     many(simulatedCalls),
  scheduledCallbacks: many(scheduledCallbacks),
  twoFA:              one(user2FA, { fields: [users.id], references: [user2FA.userId] }),
  workflows:          many(workflows),
}));

// ─── TENANT USERS (pivot) ────────────────────────────────────────────────────
export const tenantUsersRelations = relations(tenantUsers, ({ one }) => ({
  tenant: one(tenants, { fields: [tenantUsers.tenantId], references: [tenants.id] }),
  user:   one(users,   { fields: [tenantUsers.userId],   references: [users.id] }),
}));

// ─── PROSPECTS ───────────────────────────────────────────────────────────────
export const prospectsRelations = relations(prospects, ({ one, many }) => ({
  tenant:        one(tenants, { fields: [prospects.tenantId],    references: [tenants.id] }),
  assignedUser:  one(users,   { fields: [prospects.assignedTo],  references: [users.id] }),
  calls:         many(calls),
  appointments:  many(appointments),
  tasks:         many(tasks),
  deals:         many(deals),
  documents:     many(documents),
  messages:      many(messages),
  aiSuggestions: many(aiSuggestions),
  invoices:      many(customerInvoices),
  orders:        many(orders),
}));

// ─── CALLS ───────────────────────────────────────────────────────────────────
export const callsRelations = relations(calls, ({ one, many }) => ({
  tenant:    one(tenants,   { fields: [calls.tenantId],   references: [tenants.id] }),
  prospect:  one(prospects, { fields: [calls.prospectId], references: [prospects.id] }),
  agent:     one(users,     { fields: [calls.agentId],    references: [users.id] }),
  campaign:  one(campaigns, { fields: [calls.campaignId], references: [campaigns.id] }),
  scoring:   many(callScoring),
  metrics:   many(callExecutionMetrics),
}));

// ─── CAMPAIGNS ───────────────────────────────────────────────────────────────
export const campaignsRelations = relations(campaigns, ({ one, many }) => ({
  tenant:    one(tenants, { fields: [campaigns.tenantId], references: [tenants.id] }),
  prospects: many(campaignProspects),
  calls:     many(calls),
  messages:  many(messages),
}));

export const campaignProspectsRelations = relations(campaignProspects, ({ one }) => ({
  campaign:  one(campaigns, { fields: [campaignProspects.campaignId], references: [campaigns.id] }),
  prospect:  one(prospects, { fields: [campaignProspects.prospectId], references: [prospects.id] }),
}));

// ─── WORKFLOWS ───────────────────────────────────────────────────────────────
export const workflowsRelations = relations(workflows, ({ one, many }) => ({
  tenant:     one(tenants, { fields: [workflows.tenantId],   references: [tenants.id] }),
  createdBy:  one(users,   { fields: [workflows.createdBy],  references: [users.id] }),
  executions: many(workflowExecutions),
  jobs:       many(jobs),
}));

export const workflowExecutionsRelations = relations(workflowExecutions, ({ one }) => ({
  workflow: one(workflows, { fields: [workflowExecutions.workflowId], references: [workflows.id] }),
  tenant:   one(tenants,  { fields: [workflowExecutions.tenantId],   references: [tenants.id] }),
}));

// ─── APPOINTMENTS ─────────────────────────────────────────────────────────────
export const appointmentsRelations = relations(appointments, ({ one, many }) => ({
  tenant:    one(tenants,   { fields: [appointments.tenantId],   references: [tenants.id] }),
  prospect:  one(prospects, { fields: [appointments.prospectId], references: [prospects.id] }),
  agent:     one(users,     { fields: [appointments.userId],     references: [users.id] }),
  reminders: many(appointmentReminders),
}));

export const appointmentRemindersRelations = relations(appointmentReminders, ({ one }) => ({
  appointment: one(appointments, { fields: [appointmentReminders.appointmentId], references: [appointments.id] }),
  tenant:      one(tenants,      { fields: [appointmentReminders.tenantId],      references: [tenants.id] }),
}));

// ─── TASKS ───────────────────────────────────────────────────────────────────
export const tasksRelations = relations(tasks, ({ one }) => ({
  tenant:   one(tenants,   { fields: [tasks.tenantId],    references: [tenants.id] }),
  prospect: one(prospects, { fields: [tasks.prospectId],  references: [prospects.id] }),
}));

// ─── DEALS ───────────────────────────────────────────────────────────────────
export const dealsRelations = relations(deals, ({ one }) => ({
  tenant:       one(tenants,   { fields: [deals.tenantId],    references: [tenants.id] }),
  prospect:     one(prospects, { fields: [deals.prospectId],  references: [prospects.id] }),
  assignedUser: one(users,     { fields: [deals.assignedTo],  references: [users.id] }),
}));

// ─── DOCUMENTS ───────────────────────────────────────────────────────────────
export const documentsRelations = relations(documents, ({ one }) => ({
  tenant:   one(tenants,   { fields: [documents.tenantId],   references: [tenants.id] }),
  prospect: one(prospects, { fields: [documents.prospectId], references: [prospects.id] }),
}));

// ─── MESSAGES ────────────────────────────────────────────────────────────────
export const messagesRelations = relations(messages, ({ one }) => ({
  tenant:   one(tenants,   { fields: [messages.tenantId],   references: [tenants.id] }),
  prospect: one(prospects, { fields: [messages.prospectId], references: [prospects.id] }),
  campaign: one(campaigns, { fields: [messages.campaignId], references: [campaigns.id] }),
}));

// ─── BILLING ─────────────────────────────────────────────────────────────────
export const invoicesRelations = relations(invoices, ({ one }) => ({
  tenant:       one(tenants,       { fields: [invoices.tenantId],       references: [tenants.id] }),
  subscription: one(subscriptions, { fields: [invoices.subscriptionId], references: [subscriptions.id] }),
}));

export const customerInvoicesRelations = relations(customerInvoices, ({ one }) => ({
  tenant:   one(tenants,   { fields: [customerInvoices.tenantId],   references: [tenants.id] }),
  prospect: one(prospects, { fields: [customerInvoices.prospectId], references: [prospects.id] }),
}));

export const subscriptionsRelations = relations(subscriptions, ({ one, many }) => ({
  tenant:   one(tenants, { fields: [subscriptions.tenantId], references: [tenants.id] }),
  invoices: many(invoices),
}));

// ─── ORDERS ──────────────────────────────────────────────────────────────────
export const ordersRelations = relations(orders, ({ one, many }) => ({
  tenant:   one(tenants,   { fields: [orders.tenantId],   references: [tenants.id] }),
  prospect: one(prospects, { fields: [orders.prospectId], references: [prospects.id] }),
  items:    many(orderItems),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, { fields: [orderItems.orderId], references: [orders.id] }),
}));

// ─── AUDIT & SECURITY ────────────────────────────────────────────────────────
export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  tenant: one(tenants, { fields: [auditLogs.tenantId], references: [tenants.id] }),
  user:   one(users,   { fields: [auditLogs.userId],   references: [users.id] }),
}));

export const user2FARelations = relations(user2FA, ({ one }) => ({
  user: one(users, { fields: [user2FA.userId], references: [users.id] }),
}));

// ─── SOCIAL ──────────────────────────────────────────────────────────────────
export const socialPostsRelations = relations(socialPosts, ({ one }) => ({
  tenant: one(tenants, { fields: [socialPosts.tenantId], references: [tenants.id] }),
  user:   one(users,   { fields: [socialPosts.userId],   references: [users.id] }),
}));

// ─── SCHEDULING & CALLBACKS ──────────────────────────────────────────────────
export const scheduledCallbacksRelations = relations(scheduledCallbacks, ({ one }) => ({
  tenant:       one(tenants, { fields: [scheduledCallbacks.tenantId],       references: [tenants.id] }),
  assignedUser: one(users,   { fields: [scheduledCallbacks.assignedUserId], references: [users.id] }),
}));

// ─── CALL METRICS ────────────────────────────────────────────────────────────
export const callScoringRelations = relations(callScoring, ({ one }) => ({
  tenant: one(tenants, { fields: [callScoring.tenantId], references: [tenants.id] }),
  call:   one(calls,   { fields: [callScoring.callId],   references: [calls.id] }),
}));

export const agentSwitchHistoryRelations = relations(agentSwitchHistory, ({ one }) => ({
  tenant: one(tenants, { fields: [agentSwitchHistory.tenantId], references: [tenants.id] }),
  user:   one(users,   { fields: [agentSwitchHistory.userId],   references: [users.id] }),
}));

export const aiSuggestionsRelations = relations(aiSuggestions, ({ one }) => ({
  tenant:   one(tenants,   { fields: [aiSuggestions.tenantId],   references: [tenants.id] }),
  prospect: one(prospects, { fields: [aiSuggestions.prospectId], references: [prospects.id] }),
}));

// ─── RECRUITMENT ─────────────────────────────────────────────────────────────
export const candidateInterviewsRelations = relations(candidateInterviews, ({ one }) => ({
  tenant: one(tenants, { fields: [candidateInterviews.tenantId], references: [tenants.id] }),
}));


// ─── JOBS (BullMQ) ───────────────────────────────────────────────────────────
export const jobsRelations = relations(jobs, ({ one }) => ({
  tenant:   one(tenants,   { fields: [jobs.tenantId],   references: [tenants.id] }),
  workflow: one(workflows, { fields: [jobs.workflowId], references: [workflows.id] }),
}));

// ─── LEADS ───────────────────────────────────────────────────────────────────
export const leadsRelations = relations(leads, ({ one }) => ({
  tenant: one(tenants, { fields: [leads.tenantId], references: [tenants.id] }),
}));

// ─── INDUSTRY SPECIFIC ───────────────────────────────────────────────────────
export const bookingsRelations = relations(bookings, ({ one }) => ({
  tenant:   one(tenants,   { fields: [bookings.tenantId],   references: [tenants.id] }),
  prospect: one(prospects, { fields: [bookings.prospectId], references: [prospects.id] }),
}));

export const medicalAppointmentsRelations = relations(medicalAppointments, ({ one }) => ({
  tenant:   one(tenants,   { fields: [medicalAppointments.tenantId],   references: [tenants.id] }),
  prospect: one(prospects, { fields: [medicalAppointments.prospectId], references: [prospects.id] }),
  doctor:   one(users,     { fields: [medicalAppointments.doctorId],   references: [users.id] }),
}));

export const restaurantOrdersRelations = relations(restaurantOrders, ({ one }) => ({
  tenant:   one(tenants,   { fields: [restaurantOrders.tenantId],   references: [tenants.id] }),
  prospect: one(prospects, { fields: [restaurantOrders.prospectId], references: [prospects.id] }),
}));

export const legalCasesRelations = relations(legalCases, ({ one }) => ({
  tenant:   one(tenants,   { fields: [legalCases.tenantId],   references: [tenants.id] }),
  prospect: one(prospects, { fields: [legalCases.prospectId], references: [prospects.id] }),
}));

export const interventionsRelations = relations(interventions, ({ one }) => ({
  tenant:   one(tenants,   { fields: [interventions.tenantId],   references: [tenants.id] }),
  prospect: one(prospects, { fields: [interventions.prospectId], references: [prospects.id] }),
}));

export const shipmentsRelations = relations(shipments, ({ one }) => ({
  tenant:   one(tenants,   { fields: [shipments.tenantId],   references: [tenants.id] }),
  prospect: one(prospects, { fields: [shipments.prospectId], references: [prospects.id] }),
}));

