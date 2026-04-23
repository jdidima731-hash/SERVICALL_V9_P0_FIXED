/**
 * @deprecated Ce fichier a été éclaté en fichiers domaine.
 * Toutes les tables sont désormais dans :
 *   schema-tenant.ts     — tenantIndustryConfig, tenantAiKeys, workflowTemplates, usageMetrics
 *   schema-ai.ts         — auditAiUsage, aiSuggestions, aiMemories, predictiveScores
 *   schema-calls.ts      — recordings, callScoring, simulatedCalls, agentSwitchHistory, blacklistedNumbers, callExecutionMetrics
 *   schema-compliance.ts — securityAuditLogs, complianceLogs, complianceAlerts, rgpdConsents, user2FA
 *   schema-billing.ts    — orders, orderItems, customerInvoices, stripeEvents
 *   schema-messaging.ts  — messageTemplates
 *   schema-coaching.ts   — coachingFeedback, agentPerformance
 *   schema-tasks.ts      — tasks, appointments, appointmentReminders, documents, processedEvents, failedJobs, commandValidations
 *
 * N'importez plus depuis ce fichier — utilisez "@/drizzle/schema" ou le fichier domaine direct.
 */

// Re-exports de compatibilité (évite les erreurs d'import résiduels)
export * from "./schema-tenant";
export * from "./schema-ai";
export * from "./schema-calls";
export * from "./schema-compliance";
export * from "./schema-billing";
export * from "./schema-messaging";
export * from "./schema-coaching";
export * from "./schema-tasks";

export * from "./schema-missing";
