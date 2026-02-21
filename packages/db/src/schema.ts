import {
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
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

// ─── Agencies ───────────────────────────────────────────────────────────────

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

// ─── Estate Agents ──────────────────────────────────────────────────────────

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

// ─── Agency Required Fields ─────────────────────────────────────────────────

export const agencyRequiredFields = pgTable("agency_required_fields", {
  id: uuid("id").primaryKey().defaultRandom(),
  agencyId: uuid("agency_id")
    .notNull()
    .references(() => agencies.id, { onDelete: "cascade" }),
  fieldKey: text("field_key").notNull(),
  fieldLabel: text("field_label").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  unique: ["agency_id", "field_key"],
});

// ─── Email Conversations ────────────────────────────────────────────────────

export const emailConversations = pgTable("email_conversations", {
  id: uuid("id").primaryKey().defaultRandom(),
  agencyId: uuid("agency_id")
    .notNull()
    .references(() => agencies.id, { onDelete: "cascade" }),
  leadId: uuid("lead_id").references(() => leads.id, { onDelete: "set null" }),
  tenantEmail: text("tenant_email").notNull(),
  threadMessageIds: jsonb("thread_message_ids").notNull().defaultTo([]),
  collectedFields: jsonb("collected_fields").notNull().defaultTo({}),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  unique: ["agency_id", "tenant_email"],
});

// ─── Viewing Requests ───────────────────────────────────────────────────────

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
  status: statusEnum("status").notNull().default("PENDING_REVIEW"),
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

// ─── Availability Windows ───────────────────────────────────────────────────

export const availabilityWindows = pgTable("availability_windows", {
  id: uuid("id").primaryKey().defaultRandom(),
  agencyId: uuid("agency_id")
    .notNull()
    .references(() => agencies.id, { onDelete: "cascade" }),
  estateAgentId: uuid("estate_agent_id").references(() => estateAgents.id, {
    onDelete: "set null",
  }),
  dayOfWeek: integer("day_of_week").notNull(),
  startTime: text("start_time").notNull(),
  endTime: text("end_time").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ─── Viewings Update ────────────────────────────────────────────────────────

export const viewingsUpdate = pgTable("viewings", {
  viewingRequestId: uuid("viewing_request_id").references(
    () => viewingRequests.id,
    { onDelete: "set null" },
  ),
  assignedAgentId: uuid("assigned_agent_id").references(() => estateAgents.id, {
    onDelete: "set null",
  }),
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
