import { sql } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import {
  check,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * Transitional default for `agency_id` on the five tenant-owned tables
 * that got the column in Block E.0 (leads, qualifications, viewings,
 * communication_logs, audit_logs). Block E proper removes the DEFAULT
 * once every caller passes an explicit agencyId from the resolved auth
 * context — grep for `LEGACY_AGENCY_ID` to find every removal site.
 *
 * The same UUID is seeded as a row in `agencies` during the 0002
 * migration so the FK is satisfied. Operators can rename / delete it
 * after the cleanup.
 */
export const LEGACY_AGENCY_ID = "00000000-0000-0000-0000-000000000001";

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
  // Tenant scoping. Added in Block E.0; backfilled to the legacy agency.
  // The DEFAULT is a transitional safety net so writes that haven't yet
  // been migrated to constructor-injected agencyId still land somewhere
  // valid. Removed in Block E proper once every caller passes an
  // explicit agencyId — track via `LEGACY_AGENCY_ID` greps.
  agencyId: uuid("agency_id")
    .notNull()
    .default(LEGACY_AGENCY_ID)
    .references((): AnyPgColumn => agencies.id, { onDelete: "cascade" }),
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
  // Block E.0 — see note on `leads.agencyId`.
  agencyId: uuid("agency_id")
    .notNull()
    .default(LEGACY_AGENCY_ID)
    .references((): AnyPgColumn => agencies.id, { onDelete: "cascade" }),
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
  // Block E.0 — see note on `leads.agencyId`.
  agencyId: uuid("agency_id")
    .notNull()
    .default(LEGACY_AGENCY_ID)
    .references((): AnyPgColumn => agencies.id, { onDelete: "cascade" }),
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
  // Block E.0 — see note on `leads.agencyId`.
  agencyId: uuid("agency_id")
    .notNull()
    .default(LEGACY_AGENCY_ID)
    .references((): AnyPgColumn => agencies.id, { onDelete: "cascade" }),
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
  // Block E.0 — see note on `leads.agencyId`. Audit logs are tenant-owned
  // because the same `entityType + entityId` could collide across agencies
  // (e.g. lead UUIDs are random but action histories must stay scoped).
  agencyId: uuid("agency_id")
    .notNull()
    .default(LEGACY_AGENCY_ID)
    .references((): AnyPgColumn => agencies.id, { onDelete: "cascade" }),
  entityType: text("entity_type").notNull(), // "lead" | "qualification" | "viewing"
  entityId: uuid("entity_id").notNull(),
  action: text("action").notNull(), // "created" | "status_changed" | "scored" | "cancelled"
  payload: jsonb("payload").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ─── Agencies ─────────────────────────────────────────────────────────────────

export const agencies = pgTable(
  "agencies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    /**
     * Inbound address that routes mail to this agency. Stored canonical
     * (`lower(trim(...))`) — the table-level CHECK below enforces it,
     * and the unique index on `lower(...)` blocks case-variant
     * collisions even on legacy admin tooling that might bypass the
     * application path. Both added by migration 0004 after Inspector
     * Brad's HIGH finding on PR #41.
     */
    inboundEmail: text("inbound_email").notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // Canonical-storage CHECK: any future INSERT or UPDATE that doesn't
    // pre-canonicalise the value is rejected by the DB. Pairs with the
    // resolver's `.trim().toLowerCase()` on input.
    check(
      "agencies_inbound_email_canonical",
      sql`${table.inboundEmail} = lower(${table.inboundEmail})`,
    ),
    // Case-insensitive uniqueness — also makes the resolver's
    // `lower(inbound_email)` WHERE clause use an index instead of a
    // sequential scan over the agencies table.
    uniqueIndex("agencies_inbound_email_lower_idx").on(
      sql`lower(${table.inboundEmail})`,
    ),
  ],
);

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

// ─── Agent → Agency map ───────────────────────────────────────────────────────

/**
 * Maps an external "agent" identifier (today: ElevenLabs `agent_id` from
 * the phone-call webhook) to an internal `agency_id`. Lets webhook
 * handlers that receive an agent_id resolve the owning tenant without
 * the caller needing to supply it.
 *
 * This is a META-table — it spans tenants by design — so it intentionally
 * does NOT extend `TenantScopedRepository`. Security implication: read
 * access leaks the agent_id → agency_id mapping (i.e. enumerating which
 * ElevenLabs agents belong to which tenant). The mitigation is that
 * only server-side webhook code reads this table; it must never be
 * surfaced through the public API.
 *
 * `agent_id` is `text` (not `uuid`) because the upstream identifier
 * shape is provider-defined (e.g. ElevenLabs uses opaque short strings
 * like `agent_xyz`). Future providers can use the same table by
 * convention; if a second provider's ID space ever collides with
 * ElevenLabs' (vanishingly unlikely), we'll add a `provider` column
 * and bump the PK.
 *
 * Block I (`.kiro/specs/01-platform-hardening/tasks.md`) — added in
 * I-PR-A as the foundation for retiring the `ANY_AGENCY` sentinel from
 * `application/webhooks/elevenlabs/`. The wiring lands in I-PR-C.
 */
export const agentAgencyMap = pgTable("agent_agency_map", {
  agentId: text("agent_id").primaryKey(),
  agencyId: uuid("agency_id")
    .notNull()
    .references(() => agencies.id, { onDelete: "cascade" }),
  /** Optional operator-facing label, e.g. "Reapit demo agent". */
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
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

// ─── Agency Integrations (Phase 2 — CRM & Booking Adapters) ──────────────────

/**
 * One row per agency holding the configured adapter kinds and the SST
 * secret names that store each adapter's credentials. Safe defaults
 * (`noop` CRM + `mock` slot source) so a newly-onboarded agency keeps
 * working before configuration. Block C's registry reads this with a
 * 10-second TTL cache; Block F's services route through that registry.
 *
 * Spec: `.kiro/specs/02-crm-and-booking-adapters/design.md` §2.1.
 */
export const agencyIntegrations = pgTable("agency_integrations", {
  id: uuid("id").primaryKey().defaultRandom(),
  agencyId: uuid("agency_id")
    .notNull()
    .unique() // one-row-per-agency
    .references(() => agencies.id, { onDelete: "cascade" }),
  /** Matches `CrmAdapter.kind`. */
  crmAdapterKind: text("crm_adapter_kind").notNull().default("noop"),
  /** Name of the SST secret holding this adapter's credentials. Nullable for `noop`. */
  crmCredentialsSecret: text("crm_credentials_secret"),
  /** Matches `SlotSourceAdapter.kind`. */
  slotAdapterKind: text("slot_adapter_kind").notNull().default("mock"),
  slotCredentialsSecret: text("slot_credentials_secret"),
  /** Default slot length the calendar adapter slices availability into. */
  slotGranularityMinutes: integer("slot_granularity_minutes")
    .notNull()
    .default(30),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * Idempotency table for CRM lead pushes. The unique index on
 * `(lead_id, crm_kind)` lets `pushLead` upsert by lead+kind — a retry
 * after a transient failure must update the existing CRM row, not
 * create a duplicate.
 */
export const leadExternalRefs = pgTable(
  "lead_external_refs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    agencyId: uuid("agency_id")
      .notNull()
      .references(() => agencies.id, { onDelete: "cascade" }),
    leadId: uuid("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    /** Matches the originating `CrmAdapter.kind`. */
    crmKind: text("crm_kind").notNull(),
    /** Whatever the CRM returned as its own id for this lead. */
    externalId: text("external_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("lead_external_refs_lead_kind_idx").on(t.leadId, t.crmKind),
  ],
);

/** Mirror of `lead_external_refs` for viewings, keyed by `viewing_id`. */
export const viewingExternalRefs = pgTable(
  "viewing_external_refs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    agencyId: uuid("agency_id")
      .notNull()
      .references(() => agencies.id, { onDelete: "cascade" }),
    viewingId: uuid("viewing_id")
      .notNull()
      .references(() => viewings.id, { onDelete: "cascade" }),
    /** Matches the originating `CrmAdapter.kind`. */
    crmKind: text("crm_kind").notNull(),
    externalId: text("external_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("viewing_external_refs_viewing_kind_idx").on(
      t.viewingId,
      t.crmKind,
    ),
  ],
);

/**
 * Audit + retry-state log for every adapter call. The retry helper
 * (Block C) creates one row per logical operation and updates `status`
 * + `attempts` + `last_error` on each attempt. The dashboard
 * (Integrations page, spec §5) reads this for the per-agency
 * success/failure timeline. `status` is stored as text (not an enum)
 * so adding states later doesn't require a migration —
 * `IntegrationEventsRepository` is the single source of validation.
 */
export const integrationEvents = pgTable("integration_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  agencyId: uuid("agency_id")
    .notNull()
    .references(() => agencies.id, { onDelete: "cascade" }),
  /** Named operation, e.g. `crm.pushLead`, `slotSource.bookSlot`. */
  call: text("call").notNull(),
  /** Optional reference to the entity being acted on (leadId, viewingId, ...). */
  refId: text("ref_id"),
  /** "pending" | "succeeded" | "retrying" | "failed_permanent". */
  status: text("status").notNull(),
  attempts: integer("attempts").notNull().default(0),
  lastError: text("last_error"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
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
export type AgentAgencyMapRow = typeof agentAgencyMap.$inferSelect;
export type NewAgentAgencyMapRow = typeof agentAgencyMap.$inferInsert;
export type AgencyRequiredFieldRow = typeof agencyRequiredFields.$inferSelect;
export type NewAgencyRequiredFieldRow =
  typeof agencyRequiredFields.$inferInsert;
export type EmailConversationRow = typeof emailConversations.$inferSelect;
export type NewEmailConversationRow = typeof emailConversations.$inferInsert;
export type ViewingRequestRow = typeof viewingRequests.$inferSelect;
export type NewViewingRequestRow = typeof viewingRequests.$inferInsert;
export type AvailabilityWindowRow = typeof availabilityWindows.$inferSelect;
export type NewAvailabilityWindowRow = typeof availabilityWindows.$inferInsert;
// Phase 2 — CRM & Booking Adapters
export type AgencyIntegrationsRow = typeof agencyIntegrations.$inferSelect;
export type NewAgencyIntegrationsRow = typeof agencyIntegrations.$inferInsert;
export type LeadExternalRefRow = typeof leadExternalRefs.$inferSelect;
export type NewLeadExternalRefRow = typeof leadExternalRefs.$inferInsert;
export type ViewingExternalRefRow = typeof viewingExternalRefs.$inferSelect;
export type NewViewingExternalRefRow = typeof viewingExternalRefs.$inferInsert;
export type IntegrationEventRow = typeof integrationEvents.$inferSelect;
export type NewIntegrationEventRow = typeof integrationEvents.$inferInsert;
export type ConversationTypeEnum =
  (typeof conversationTypeEnum.enumValues)[number];
