/**
 * QualificationRepository
 *
 * Data access for Qualification records — backed by Neon via Drizzle ORM.
 */
import { eq } from "drizzle-orm";
import { type Db, getDb, qualifications } from "@lettingsops/db";
import type { ScoreCategory } from "./leadRepository";

export type EmploymentStatus =
  | "employed"
  | "self_employed"
  | "unemployed"
  | "student"
  | "retired";

export type IncomeBand =
  | "under_20k"
  | "20k_30k"
  | "30k_50k"
  | "50k_75k"
  | "over_75k";

export type QualificationAnswers = {
  moveInDate: string;
  occupants: number;
  employmentStatus: EmploymentStatus;
  incomeBand: IncomeBand;
  hasPets: boolean;
  viewingAvailability: string[];
};

export type Qualification = {
  id: string;
  leadId: string;
  answers: QualificationAnswers;
  score: number;
  category: ScoreCategory;
  createdAt: string;
};

export type CreateQualificationInput = {
  leadId: string;
  answers: QualificationAnswers;
  score: number;
  category: ScoreCategory;
};

function rowToQualification(row: typeof qualifications.$inferSelect): Qualification {
  return {
    id: row.id,
    leadId: row.leadId,
    answers: row.answers as QualificationAnswers,
    score: row.score,
    category: row.category as ScoreCategory,
    createdAt: row.createdAt.toISOString(),
  };
}

export class QualificationRepository {
  static readonly key = "QualificationRepository";

  private db: Db;

  constructor(db?: Db) {
    this.db = db ?? getDb();
  }

  async create(input: CreateQualificationInput): Promise<Qualification> {
    const [row] = await this.db
      .insert(qualifications)
      .values({
        leadId: input.leadId,
        answers: input.answers as Record<string, unknown>,
        score: input.score,
        category: input.category,
      })
      .returning();

    if (!row) throw new Error("Failed to create qualification — no row returned");
    return rowToQualification(row);
  }

  async findByLeadId(leadId: string): Promise<Qualification | null> {
    const [row] = await this.db
      .select()
      .from(qualifications)
      .where(eq(qualifications.leadId, leadId))
      .orderBy(qualifications.createdAt)
      .limit(1);

    return row ? rowToQualification(row) : null;
  }
}
