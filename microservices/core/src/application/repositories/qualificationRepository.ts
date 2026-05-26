/**
 * QualificationRepository
 *
 * Data access for Qualification records — backed by Neon via Drizzle ORM.
 *
 * Tenant-scoped: every instance carries an `agencyId` (real UUID or the
 * `ANY_AGENCY` sentinel). See `TenantScopedRepository`.
 */
import { and, eq } from "drizzle-orm";
import { type Db, qualifications } from "@lettingsops/db";
import type { ScoreCategory } from "./leadRepository";
import {
  type AgencyScope,
  TenantScopedRepository,
  filterPredicates,
} from "./tenantScopedRepository";

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

function rowToQualification(
  row: typeof qualifications.$inferSelect,
): Qualification {
  return {
    id: row.id,
    leadId: row.leadId,
    answers: row.answers as QualificationAnswers,
    score: row.score,
    category: row.category as ScoreCategory,
    createdAt: row.createdAt.toISOString(),
  };
}

export class QualificationRepository extends TenantScopedRepository {
  static readonly key = "QualificationRepository";

  constructor(db: Db | undefined, agencyId: AgencyScope) {
    super(db, agencyId);
  }

  async create(input: CreateQualificationInput): Promise<Qualification> {
    const [row] = await this.db
      .insert(qualifications)
      .values({
        agencyId: this.writeAgencyId(),
        leadId: input.leadId,
        answers: input.answers as Record<string, unknown>,
        score: input.score,
        category: input.category,
      })
      .returning();

    if (!row)
      throw new Error("Failed to create qualification — no row returned");
    return rowToQualification(row);
  }

  async findByLeadId(leadId: string): Promise<Qualification | null> {
    const [row] = await this.db
      .select()
      .from(qualifications)
      .where(
        and(
          ...filterPredicates([
            eq(qualifications.leadId, leadId),
            this.scopeWhere(qualifications.agencyId),
          ]),
        ),
      )
      .orderBy(qualifications.createdAt)
      .limit(1);

    return row ? rowToQualification(row) : null;
  }
}
