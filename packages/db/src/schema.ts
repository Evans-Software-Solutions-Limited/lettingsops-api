import type { AnyPgColumn } from "drizzle-orm/pg-core";
import {
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

// ─── Enums ────────────────────────────────────────────────────────────────────

export const leadStatusEnum = pgEnum("lead_status", [
  "NEW",
  "CONTACTED",
  "QUALIFYING",
  "QUALIFIED",
  "VIEWING_BOOKED",
  "OFFER_STAGE",
  "CONVERTED",
  "ARCHIVED",
]);

export const leadSourceEnum = pgEnum("lead_source", [
  "email",
  "phone",
  "portal",
  "manual",
]);

export const scoreCategoryEnum = pgEnum("score_category", [
  "LOW",
  "MEDIUM",
  "STRONG",
]);

export const viewingRequestStatusEnum = pgEnum("viewing_request_status", [
  "PENDING_REVIEW",
  "ACCEPTED",
  "REJECTED",
  "CONFIRMED",
]);

export const conversationTypeEnum = pgEnum("conversation_type", [
  "VIEWING_ENQUIRY",
  "MAINTENANCE_REQUEST",
  "GENERAL_ENQUIRY",
  "OTHER",
]);

// ─── Leads ────────────────────────────────────────────────────────────────────

export const leads = pgTable("leads", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  propertyRef: text("property_ref"),
  propertyRent: integer("property_rent"),
  message: text("message"),
  source: leadSourceEnum("source").notNull(),
  status: leadStatusEnum("status").notNull().default("NEW"),
  score: integer("score"),
  scoreCategory: scoreCategoryEnum("score_category"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ─── Qualifications ───────────────────────────────────────────────────────────

export const qualifications = pgTable("qualifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  leadId: uuid("lead_id")
    .notNull()
    .references(() => leads.id, { onDelete: "cascade" }),
  answers: jsonb("answers").notNull().$type<Record<string, unknown>>(),
  score: integer("score").notNull(),
  category: scoreCategoryEnum("category").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ─── Viewings ─────────────────────────────────────────────────────────────────

export const viewings = pgTable("viewings", {
  id: uuid("id").primaryKey().defaultRandom(),
  leadId: uuid("lead_id")
    .notNull()
    .references(() => leads.id, { onDelete: "cascade" }),
  propertyRef: text("property_ref").notNull(),
  slotId: text("slot_id").notNull(),
  calendarEventId: text("calendar_event_id"),
  confirmedAt: timestamp("confirmed_at", { withTimezone: true }).notNull(),
  cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  viewingRequestId: uuid("viewing_request_id").references(
    (): AnyPgColumn => viewingRequests.id,
    { onDelete: "set null" },
  ),
  assignedAgentId: uuid("assigned_agent_id").references(
    (): AnyPgColumn => estateAgents.id,
    { onDelete: "set null" },
  ),
});

// ─── Communication Logs ───────────────────────────────────────────────────────

export const communicationLogs = pgTable("communication_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  leadId: uuid("lead_id")
    .notNull()
    .references(() => leads.id, { onDelete: "cascade" }),
  source: text("source").notNull(), // "email" | "phone" | "portal"
  messageId: text("message_id"),
  subject: text("subject"),
  body: text("body"),
  receivedAt: timestamp("received_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ─── Audit Logs ───────────────────────────────────────────────────────────────

export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  entityType: text("entity_type").notNull(), // "lead" | "qualification" | "viewing"
  entityId: uuid("entity_id").notNull(),
  action: text("action").notNull(), // "created" | "status_changed" | "scored" | "cancelled"
  payload: jsonb("payload").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ─── Agencies ─────────────────────────────────────────────────────────────────

export const agencies = pgTable("agencies", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  inboundEmail: text("inbound_email").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ─── Estate Agents ────────────────────────────────────────────────────────────

export const estateAgents = pgTable("estate_agents", {
  id: uuid("id").primaryKey().defaultRandom(),
  agencyId: uuid("agency_id")
    .notNull()
    .references(() => agencies.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  email: text("email").notNull(),
  calendarId: text("calendar_id"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ─── API Keys ─────────────────────────────────────────────────────────────────

export const apiKeys = pgTable("api_keys", {
  id: uuid("id").primaryKey().defaultRandom(),
  agencyId: uuid("agency_id")
    .notNull()
    .references(() => agencies.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  keyHash: text("key_hash").notNull().unique(),
  prefix: text("prefix").notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ─── Agency Required Fields ───────────────────────────────────────────────────

export const agencyRequiredFields = pgTable(
  "agency_required_fields",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    agencyId: uuid("agency_id")
      .notNull()
      .references(() => agencies.id, { onDelete: "cascade" }),
    fieldKey: text("field_key").notNull(),
    fieldLabel: text("field_label").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("agency_required_fields_agency_id_field_key_idx").on(
      t.agencyId,
      t.fieldKey,
    ),
  ],
);

// ─── Email Conversations ──────────────────────────────────────────────────────

export const emailConversations = pgTable(
  "email_conversations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    agencyId: uuid("agency_id")
      .notNull()
      .references(() => agencies.id, { onDelete: "cascade" }),
    leadId: uuid("lead_id").references(() => leads.id, {
      onDelete: "set null",
    }),
    tenantEmail: text("tenant_email").notNull(),
    conversationType: conversationTypeEnum("conversation_type")
      .notNull()
      .default("OTHER"),
    threadMessageIds: jsonb("thread_message_ids")
      .notNull()
      .$type<string[]>()
      .default([]),
    collectedFields: jsonb("collected_fields")
      .notNull()
      .$type<Record<string, string>>()
      .default({}),
    status: text("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("email_conversations_agency_id_tenant_email_idx").on(
      t.agencyId,
      t.tenantEmail,
    ),
  ],
);

// ─── Viewing Requests ─────────────────────────────────────────────────────────

export const viewingRequests = pgTable("viewing_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  leadId: uuid("lead_id")
    .notNull()
    .references(() => leads.id, { onDelete: "cascade" }),
  agencyId: uuid("agency_id")
    .notNull()
    .references(() => agencies.id, { onDelete: "cascade" }),
  conversationId: uuid("conversation_id").references(
    () => emailConversations.id,
    { onDelete: "set null" },
  ),
  status: viewingRequestStatusEnum("status")
    .notNull()
    .default("PENDING_REVIEW"),
  assignedAgentId: uuid("assigned_agent_id").references(() => estateAgents.id, {
    onDelete: "set null",
  }),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ─── Availability Windows ─────────────────────────────────────────────────────

export const availabilityWindows = pgTable("availability_windows", {
  id: uuid("id").primaryKey().defaultRandom(),
  agencyId: uuid("agency_id")
    .notNull()
    .references(() => agencies.id, { onDelete: "cascade" }),
  estateAgentId: uuid("estate_agent_id").references(() => estateAgents.id, {
    onDelete: "cascade",
  }),
  dayOfWeek: integer("day_of_week").notNull(),
  startTime: text("start_time").notNull(),
  endTime: text("end_time").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ─── Types (inferred from schema) ─────────────────────────────────────────────

export type LeadRow = typeof leads.$inferSelect;
export type NewLeadRow = typeof leads.$inferInsert;
export type QualificationRow = typeof qualifications.$inferSelect;
export type NewQualificationRow = typeof qualifications.$inferInsert;
export type ViewingRow = typeof viewings.$inferSelect;
export type NewViewingRow = typeof viewings.$inferInsert;
export type CommunicationLogRow = typeof communicationLogs.$inferSelect;
export type NewCommunicationLogRow = typeof communicationLogs.$inferInsert;
export type AuditLogRow = typeof auditLogs.$inferSelect;
export type NewAuditLogRow = typeof auditLogs.$inferInsert;
export type AgencyRow = typeof agencies.$inferSelect;
export type NewAgencyRow = typeof agencies.$inferInsert;
export type EstateAgentRow = typeof estateAgents.$inferSelect;
export type NewEstateAgentRow = typeof estateAgents.$inferInsert;
export type ApiKeyRow = typeof apiKeys.$inferSelect;
export type NewApiKeyRow = typeof apiKeys.$inferInsert;
export type AgencyRequiredFieldRow = typeof agencyRequiredFields.$inferSelect;
export type NewAgencyRequiredFieldRow =
  typeof agencyRequiredFields.$inferInsert;
export type EmailConversationRow = typeof emailConversations.$inferSelect;
export type NewEmailConversationRow = typeof emailConversations.$inferInsert;
export type ViewingRequestRow = typeof viewingRequests.$inferSelect;
export type NewViewingRequestRow = typeof viewingRequests.$inferInsert;
export type AvailabilityWindowRow = typeof availabilityWindows.$inferSelect;
export type NewAvailabilityWindowRow = typeof availabilityWindows.$inferInsert;
export type ConversationTypeEnum =
  (typeof conversationTypeEnum.enumValues)[number];
