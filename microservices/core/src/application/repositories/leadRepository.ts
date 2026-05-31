/**
 * LeadRepository
 *
 * Data access for Lead entities — backed by Neon (serverless Postgres) via Drizzle ORM.
 *
 * Tenant-scoped: every instance carries an `agencyId` (real UUID, or
 * the `ANY_AGENCY` sentinel for the two webhook ingest paths that
 * cannot resolve an agency at construction time — see
 * `TenantScopedRepository`). Reads filter by it; writes inject it.
 * Sentinel-scoped instances bypass the filter and rely on the column
 * DEFAULT for writes.
 */
import { and, count, eq } from "drizzle-orm";
import { type Db, communicationLogs, leads } from "@lettingsops/db";
import {
  type AgencyScope,
  TenantScopedRepository,
  filterPredicates,
} from "./tenantScopedRepository";
import { publishLeadCreated } from "../metrics/cloudWatchMetrics";

export type LeadStatus =
  | "NEW"
  | "CONTACTED"
  | "QUALIFYING"
  | "QUALIFIED"
  | "VIEWING_BOOKED"
  | "OFFER_STAGE"
  | "CONVERTED"
  | "ARCHIVED";

export type LeadSource = "email" | "phone" | "portal" | "manual";

export type ScoreCategory = "LOW" | "MEDIUM" | "STRONG";

export type Lead = {
  id: string;
  name: string;
  email: string;
  phone?: string;
  propertyRef?: string;
  propertyRent?: number;
  message?: string;
  source: LeadSource;
  status: LeadStatus;
  score?: number;
  scoreCategory?: ScoreCategory;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type CreateLeadInput = {
  name: string;
  email: string;
  phone?: string;
  propertyRef?: string;
  message?: string;
  source: LeadSource;
  status: LeadStatus;
  metadata?: Record<string, unknown>;
};

export type ListLeadsFilters = {
  status?: string;
  propertyRef?: string;
  page: number;
  limit: number;
};

function rowToLead(row: typeof leads.$inferSelect): Lead {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone ?? undefined,
    propertyRef: row.propertyRef ?? undefined,
    propertyRent: row.propertyRent ?? undefined,
    message: row.message ?? undefined,
    source: row.source as LeadSource,
    status: row.status as LeadStatus,
    score: row.score ?? undefined,
    scoreCategory: row.scoreCategory as ScoreCategory | undefined,
    metadata: (row.metadata as Record<string, unknown>) ?? undefined,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export class LeadRepository extends TenantScopedRepository {
  static readonly key = "LeadRepository";

  constructor(db: Db | undefined, agencyId: AgencyScope) {
    super(db, agencyId);
  }

  async create(input: CreateLeadInput): Promise<Lead> {
    const [row] = await this.db
      .insert(leads)
      .values({
        // `agencyId` is omitted when sentinel-scoped — the column's
        // transitional DEFAULT (LEGACY_AGENCY_ID) fills in. Real-agency
        // instances pass the resolved UUID.
        agencyId: this.writeAgencyId(),
        name: input.name,
        email: input.email,
        phone: input.phone,
        propertyRef: input.propertyRef,
        message: input.message,
        source: input.source,
        status: input.status,
        metadata: input.metadata,
      })
      .returning();

    if (!row) throw new Error("Failed to create lead — no row returned");

    // Publish the `LeadsCreated` CloudWatch metric. Done here, not in
    // the calling service, so every ingestion path (HTTP, email
    // Lambda, ElevenLabs phone webhook) gets counted via the single
    // choke point. Fire-and-forget — publish failures (IAM, throttle,
    // network) are swallowed inside `publishLeadCreated`.
    void publishLeadCreated(input.source);

    return rowToLead(row);
  }

  async findById(id: string): Promise<Lead | null> {
    const [row] = await this.db
      .select()
      .from(leads)
      .where(
        and(
          ...filterPredicates([
            eq(leads.id, id),
            this.scopeWhere(leads.agencyId),
          ]),
        ),
      )
      .limit(1);
    return row ? rowToLead(row) : null;
  }

  async findByEmail(email: string): Promise<Lead | null> {
    const [row] = await this.db
      .select()
      .from(leads)
      .where(
        and(
          ...filterPredicates([
            eq(leads.email, email),
            this.scopeWhere(leads.agencyId),
          ]),
        ),
      )
      .limit(1);
    return row ? rowToLead(row) : null;
  }

  async findByMessageId(messageId: string): Promise<Lead | null> {
    // Look up the lead via communication_logs (email messageId stored there).
    // Both tables are tenant-owned and carry agencyId post-Block-E.0; we
    // scope both rather than relying on transitive scoping.
    const [log] = await this.db
      .select({ leadId: communicationLogs.leadId })
      .from(communicationLogs)
      .where(
        and(
          ...filterPredicates([
            eq(communicationLogs.messageId, messageId),
            this.scopeWhere(communicationLogs.agencyId),
          ]),
        ),
      )
      .limit(1);

    if (!log) return null;
    return this.findById(log.leadId);
  }

  async list(filters: ListLeadsFilters): Promise<{
    leads: Lead[];
    total: number;
    page: number;
    limit: number;
  }> {
    const { page, limit } = filters;
    const offset = (page - 1) * limit;

    const where = and(
      ...filterPredicates([
        this.scopeWhere(leads.agencyId),
        filters.status
          ? eq(leads.status, filters.status as LeadStatus)
          : undefined,
        filters.propertyRef
          ? eq(leads.propertyRef, filters.propertyRef)
          : undefined,
      ]),
    );

    const [rows, [totalRow]] = await Promise.all([
      this.db.select().from(leads).where(where).limit(limit).offset(offset),
      this.db.select({ count: count() }).from(leads).where(where),
    ]);

    return {
      leads: rows.map(rowToLead),
      total: Number(totalRow?.count ?? 0),
      page,
      limit,
    };
  }

  async updateStatus(id: string, status: LeadStatus): Promise<void> {
    await this.db
      .update(leads)
      .set({ status, updatedAt: new Date() })
      .where(
        and(
          ...filterPredicates([
            eq(leads.id, id),
            this.scopeWhere(leads.agencyId),
          ]),
        ),
      );
  }

  async updateScore(
    id: string,
    score: number,
    category: ScoreCategory,
  ): Promise<void> {
    await this.db
      .update(leads)
      .set({ score, scoreCategory: category, updatedAt: new Date() })
      .where(
        and(
          ...filterPredicates([
            eq(leads.id, id),
            this.scopeWhere(leads.agencyId),
          ]),
        ),
      );
  }

  async addNote(
    id: string,
    note: {
      source: string;
      messageId: string;
      subject: string;
      body?: string;
      receivedAt: string;
    },
  ): Promise<void> {
    // Both `communication_logs` and `leads` are tenant-owned. We stamp
    // the note row with the same agencyId scope as the parent lead.
    await this.db.insert(communicationLogs).values({
      agencyId: this.writeAgencyId(),
      leadId: id,
      source: note.source,
      messageId: note.messageId,
      subject: note.subject,
      body: note.body,
      receivedAt: new Date(note.receivedAt),
    });
  }
}
