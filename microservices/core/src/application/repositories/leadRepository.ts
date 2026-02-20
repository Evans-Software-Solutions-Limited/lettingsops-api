/**
 * LeadRepository
 *
 * Data access for Lead entities. All methods are stubs pending Drizzle ORM + DB setup.
 * Implementation will connect to Neon (serverless Postgres) via Drizzle.
 */

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

export class LeadRepository {
  static readonly key = "LeadRepository";

  async create(input: CreateLeadInput): Promise<Lead> {
    // TODO: implement with Drizzle ORM
    throw new Error("Not implemented: LeadRepository.create");
  }

  async findById(id: string): Promise<Lead | null> {
    // TODO: implement with Drizzle ORM
    throw new Error("Not implemented: LeadRepository.findById");
  }

  async findByEmail(email: string): Promise<Lead | null> {
    // TODO: implement with Drizzle ORM
    throw new Error("Not implemented: LeadRepository.findByEmail");
  }

  async findByMessageId(messageId: string): Promise<Lead | null> {
    // TODO: query metadata JSONB for messageId
    throw new Error("Not implemented: LeadRepository.findByMessageId");
  }

  async list(filters: ListLeadsFilters): Promise<{
    leads: Lead[];
    total: number;
    page: number;
    limit: number;
  }> {
    // TODO: implement with Drizzle ORM + pagination
    throw new Error("Not implemented: LeadRepository.list");
  }

  async updateStatus(id: string, status: LeadStatus): Promise<void> {
    // TODO: implement with Drizzle ORM
    throw new Error("Not implemented: LeadRepository.updateStatus");
  }

  async updateScore(id: string, score: number, category: ScoreCategory): Promise<void> {
    // TODO: implement with Drizzle ORM
    throw new Error("Not implemented: LeadRepository.updateScore");
  }

  async addNote(
    id: string,
    note: { source: string; messageId: string; subject: string; receivedAt: string },
  ): Promise<void> {
    // TODO: insert into communication_logs table
    throw new Error("Not implemented: LeadRepository.addNote");
  }
}
