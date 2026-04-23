/**
 * SCHEMA — Dialer Campaigns
 * Tables : campaignProspects (liste des prospects pour les campagnes predictive/power dialer)
 * Enums  : campaignStatusEnum, campaignTypeEnum, prospectStatusEnum
 *
 * NB: La table "campaigns" est définie dans schema.ts (source de vérité CRM).
 *     Ce fichier importe campaigns depuis schema.ts pour les FK de campaignProspects.
 */

import {
  pgTable, pgEnum, integer, varchar, text, timestamp, json, index, uniqueIndex
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { tenants, prospects } from "./schema";

// ── Enums ────────────────────────────────────────────────────────────────────
export const campaignStatusEnum = pgEnum("campaign_status", [
  "draft", "active", "paused", "completed", "archived"
]);

export const campaignTypeEnum = pgEnum("campaign_type", [
  "outbound_predictive_dialer",
  "outbound_power_dialer",
  "inbound_ivr",
  "sms_blast",
  "email_sequence"
]);

export const prospectStatusEnum = pgEnum("prospect_status", [
  "pending", "dialing", "completed", "failed", "scheduled"
]);

// ── Campaign Prospects (join table: campaigns ↔ prospects for dialer) ─────────
// La FK campagneId référence la table "campaigns" définie dans schema.ts
export const campaignProspects = pgTable(
  "campaign_prospects",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    // FK vers campaigns (défini dans schema.ts) — référencé par nom SQL direct
    tenantId: integer("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    campaignId: integer("campaign_id").notNull(),
    prospectId: integer("prospect_id").references(() => prospects.id, { onDelete: "cascade" }),
    phoneNumber: varchar("phone_number", { length: 50 }).notNull(),
    name: varchar("name", { length: 255 }),
    status: prospectStatusEnum("status").default("pending"),
    callAttempts: integer("call_attempts").default(0),
    lastAttemptAt: timestamp("last_attempt_at"),
    scheduledAt: timestamp("scheduled_at"),
    completedAt: timestamp("completed_at"),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => ({
    tenantIdIdx: index("campaign_prospects_tenant_id_idx").on(table.tenantId),
  campaignIdIdx: index("campaign_prospects_campaign_id_idx").on(table.campaignId),
    prospectIdIdx: index("campaign_prospects_prospect_id_idx").on(table.prospectId),
    statusIdx: index("campaign_prospects_status_idx").on(table.status),
    phoneNumberIdx: index("campaign_prospects_phone_idx").on(table.phoneNumber),
    uniqueCampaignProspect: uniqueIndex("campaign_prospects_unique_idx").on(
      table.campaignId,
      table.phoneNumber
    ),
  })
);

export type CampaignProspect = typeof campaignProspects.$inferSelect;
export type InsertCampaignProspect = typeof campaignProspects.$inferInsert;

// ── Relations ─────────────────────────────────────────────────────────────────
export const campaignProspectsRelations = relations(campaignProspects, ({ one }) => ({
  prospect: one(prospects, {
    fields: [campaignProspects.prospectId],
    references: [prospects.id],
  }),
  tenant: one(tenants, {
    fields: [campaignProspects.tenantId],
    references: [tenants.id],
  }),
}));
