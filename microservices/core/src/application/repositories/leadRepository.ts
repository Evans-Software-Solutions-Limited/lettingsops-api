/**
 * LeadRepository
 *
 * Data access for Lead entities — backed by Neon (serverless Postgres) via Drizzle ORM.
 * Pass a `db` instance to the constructor to inject a test database.
 */
import { and, count, eq } from "drizzle-orm";
import { type Db, communicationLogs, getDb, leads } from "@lettingsops/db";

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

export class LeadRepository {
  static readonly key = "LeadRepository";

  private db: Db;

  constructor(db?: Db) {
    this.db = db ?? getDb();
  }

  async create(input: CreateLeadInput): Promise<Lead> {
    const [row] = await this.db
      .insert(leads)
      .values({
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
    return rowToLead(row);
  }

  async findById(id: string): Promise<Lead | null> {
    const [row] = await this.db
      .select()
      .from(leads)
      .where(eq(leads.id, id))
      .limit(1);
    return row ? rowToLead(row) : null;
  }

  async findByEmail(email: string): Promise<Lead | null> {
    const [row] = await this.db
      .select()
      .from(leads)
      .where(eq(leads.email, email))
      .limit(1);
    return row ? rowToLead(row) : null;
  }

  async findByMessageId(messageId: string): Promise<Lead | null> {
    // Look up the lead via communication_logs (email messageId stored there)
    const [log] = await this.db
      .select({ leadId: communicationLogs.leadId })
      .from(communicationLogs)
      .where(eq(communicationLogs.messageId, messageId))
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

    const conditions = [];
    if (filters.status) {
      conditions.push(eq(leads.status, filters.status as LeadStatus));
    }
    if (filters.propertyRef) {
      conditions.push(eq(leads.propertyRef, filters.propertyRef));
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

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
      .where(eq(leads.id, id));
  }

  async updateScore(
    id: string,
    score: number,
    category: ScoreCategory,
  ): Promise<void> {
    await this.db
      .update(leads)
      .set({ score, scoreCategory: category, updatedAt: new Date() })
      .where(eq(leads.id, id));
  }

  async addNote(
    id: string,
    note: {
      source: string;
      messageId: string;
      subject: string;
      receivedAt: string;
    },
  ): Promise<void> {
    await this.db.insert(communicationLogs).values({
      leadId: id,
      source: note.source,
      messageId: note.messageId,
      subject: note.subject,
      receivedAt: new Date(note.receivedAt),
    });
  }
}
