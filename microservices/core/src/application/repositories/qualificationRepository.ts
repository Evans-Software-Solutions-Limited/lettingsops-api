/**
 * QualificationRepository
 *
 * Data access for Qualification records.
 */

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

export class QualificationRepository {
  static readonly key = "QualificationRepository";

  async create(input: CreateQualificationInput): Promise<Qualification> {
    // TODO: implement with Drizzle ORM
    throw new Error("Not implemented: QualificationRepository.create");
  }

  async findByLeadId(leadId: string): Promise<Qualification | null> {
    // TODO: implement with Drizzle ORM
    throw new Error("Not implemented: QualificationRepository.findByLeadId");
  }
}
