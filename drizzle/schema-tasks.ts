/**
 * SCHEMA — Domaine Tâches & Planification
 * Tables : tasks, appointments, appointmentReminders, documents,
 *          processedEvents, failedJobs, commandValidations
 */
import { pgTable, varchar, integer, timestamp, text, boolean, json, index, uniqueIndex } from "drizzle-orm/pg-core";
import { tenants, prospects, users } from "./schema";

// ============================================
// TASKS TABLE
// ============================================
export const tasks = pgTable("tasks", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  assignedTo: integer("assigned_to").references(() => tenants.id, { onDelete: "set null" }),
  prospectId: integer("prospect_id").references(() => prospects.id, { onDelete: "set null" }),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  status: varchar("status", { length: 50 }).default("pending"),
  priority: varchar("priority", { length: 50 }).default("medium"),
  dueDate: timestamp("due_date"),
  completedAt: timestamp("completed_at"),
  metadata: json("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  tenantIdIdx: index("idx_tasks_tenant_id_idx").on(table.tenantId),
  assignedToIdx: index("idx_tasks_assigned_to_idx").on(table.assignedTo),
  prospectIdIdx: index("idx_tasks_prospect_id_idx").on(table.prospectId),
  statusIdx: index("idx_tasks_status_idx").on(table.status),
  priorityIdx: index("idx_tasks_priority_idx").on(table.priority),
}));

export type Task = typeof tasks.$inferSelect;
export type InsertTask = typeof tasks.$inferInsert;

// ============================================
// APPOINTMENTS TABLE
// ============================================
export const appointments = pgTable("appointments", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  prospectId: integer("prospect_id").references(() => prospects.id, { onDelete: "set null" }),
  userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time").notNull(),
  status: varchar("status", { length: 50 }).default("scheduled"),
  type: varchar("type", { length: 50 }).default("call"),
  location: text("location"),
  meetingUrl: text("meeting_url"),
  notes: text("notes"),
  metadata: json("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  tenantIdIdx: index("idx_appointments_tenant_id_idx").on(table.tenantId),
  prospectIdIdx: index("idx_appointments_prospect_id_idx").on(table.prospectId),
  userIdIdx: index("idx_appointments_user_id_idx").on(table.userId),
  startTimeIdx: index("idx_appointments_start_time_idx").on(table.startTime),
  statusIdx: index("idx_appointments_status_idx").on(table.status),
}));

export type Appointment = typeof appointments.$inferSelect;
export type InsertAppointment = typeof appointments.$inferInsert;

// ============================================
// APPOINTMENT_REMINDERS TABLE
// ============================================
export const appointmentReminders = pgTable("appointment_reminders", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  appointmentId: integer("appointment_id").notNull().references(() => appointments.id, { onDelete: "cascade" }),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  reminderType: varchar("reminder_type", { length: 50 }).notNull(), // 'email', 'sms', 'push'
  scheduledAt: timestamp("scheduled_at").notNull(),
  sentAt: timestamp("sent_at"),
  status: varchar("status", { length: 50 }).default("pending"),
  metadata: json("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  appointmentIdIdx: index("idx_appointment_reminders_appointment_id_idx").on(table.appointmentId),
  tenantIdIdx: index("idx_appointment_reminders_tenant_id_idx").on(table.tenantId),
  scheduledAtIdx: index("idx_appointment_reminders_scheduled_at_idx").on(table.scheduledAt),
}));

export type AppointmentReminder = typeof appointmentReminders.$inferSelect;
export type InsertAppointmentReminder = typeof appointmentReminders.$inferInsert;

// ============================================
// DOCUMENTS TABLE
// ============================================
export const documents = pgTable("documents", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  ocrData: json("ocr_data"),
  prospectId: integer("prospect_id").references(() => prospects.id, { onDelete: "set null" }),
  name: varchar("name", { length: 255 }).notNull(),
  type: varchar("type", { length: 100 }),
  mimeType: varchar("mime_type", { length: 100 }),
  size: integer("size"),
  url: text("url"),
  storageKey: text("storage_key"),
  isPublic: boolean("is_public").default(false),
  metadata: json("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  tenantIdIdx: index("idx_documents_tenant_id_idx").on(table.tenantId),
  prospectIdIdx: index("idx_documents_prospect_id_idx").on(table.prospectId),
  typeIdx: index("idx_documents_type_idx").on(table.type),
}));

export type Document = typeof documents.$inferSelect;
export type InsertDocument = typeof documents.$inferInsert;

// ============================================
// PROCESSED_EVENTS TABLE (Idempotency)
// ============================================
export const processedEvents = pgTable("processed_events", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  source: varchar("source", { length: 255 }).notNull(),
  eventId: varchar("event_id", { length: 255 }).notNull(),
  processedAt: timestamp("processed_at").defaultNow(),
}, (table) => ({
  uniqueEvent: uniqueIndex("unique_processed_event_idx").on(table.source, table.eventId),
  sourceIdx: index("idx_processed_events_source_idx").on(table.source),
  processedAtIdx: index("idx_processed_events_processed_at_idx").on(table.processedAt),
}));

export type ProcessedEvent = typeof processedEvents.$inferSelect;
export type InsertProcessedEvent = typeof processedEvents.$inferInsert;

// ============================================
// FAILED_JOBS TABLE
// ============================================
export const failedJobs = pgTable("failed_jobs", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  queue: varchar("queue", { length: 255 }).notNull(),
  payload: json("payload").notNull(),
  exception: text("exception"),
  failedAt: timestamp("failed_at").defaultNow(),
  attempts: integer("attempts").default(1),
  maxAttempts: integer("max_attempts").default(3),
  status: varchar("status", { length: 50 }).default("failed"),
  metadata: json("metadata"),
}, (table) => ({
  queueIdx: index("idx_failed_jobs_queue_idx").on(table.queue),
  statusIdx: index("idx_failed_jobs_status_idx").on(table.status),
  failedAtIdx: index("idx_failed_jobs_failed_at_idx").on(table.failedAt),
}));

export type FailedJob = typeof failedJobs.$inferSelect;
export type InsertFailedJob = typeof failedJobs.$inferInsert;

// ============================================
// COMMAND_VALIDATIONS TABLE
// ============================================
export const commandValidations = pgTable("command_validations", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  commandType: varchar("command_type", { length: 100 }).notNull(),
  commandId: varchar("command_id", { length: 255 }).notNull(),
  status: varchar("status", { length: 50 }).default("pending"),
  validatedBy: integer("validated_by"),
  validatedAt: timestamp("validated_at"),
  rejectedBy: integer("rejected_by"),
  rejectedAt: timestamp("rejected_at"),
  rejectionReason: text("rejection_reason"),
  payload: json("payload"),
  metadata: json("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  tenantIdIdx: index("idx_command_validations_tenant_id_idx").on(table.tenantId),
  commandTypeIdx: index("idx_command_validations_command_type_idx").on(table.commandType),
  statusIdx: index("idx_command_validations_status_idx").on(table.status),
  commandIdIdx: uniqueIndex("idx_command_validations_command_id_unique").on(table.commandId),
}));

export type CommandValidation = typeof commandValidations.$inferSelect;
export type InsertCommandValidation = typeof commandValidations.$inferInsert;

// ============================================
// WORKFLOW_DEAD_LETTERS TABLE — Jobs échoués (Axe 2)
// ============================================
export const workflowDeadLetters = pgTable("workflow_dead_letters", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  workflowId: integer("workflow_id"),
  jobId: varchar("job_id", { length: 255 }).notNull(),
  queueName: varchar("queue_name", { length: 100 }).notNull(),
  payload: json("payload").notNull(),
  error: text("error"),
  stack: text("stack"),
  attempts: integer("attempts").default(0),
  status: varchar("status", { length: 50 }).default("failed"), // 'failed', 'retrying', 'resolved'
  resolvedAt: timestamp("resolved_at"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  tenantIdIdx: index("idx_workflow_dead_letters_tenant_id_idx").on(table.tenantId),
  jobIdIdx: index("idx_workflow_dead_letters_job_id_idx").on(table.jobId),
  statusIdx: index("idx_workflow_dead_letters_status_idx").on(table.status),
}));

export type WorkflowDeadLetter = typeof workflowDeadLetters.$inferSelect;
export type InsertWorkflowDeadLetter = typeof workflowDeadLetters.$inferInsert;
