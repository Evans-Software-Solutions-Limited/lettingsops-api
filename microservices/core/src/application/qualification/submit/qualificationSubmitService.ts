import Elysia from "elysia";
import { LeadRepository } from "../../repositories/leadRepository";
import { QualificationRepository } from "../../repositories/qualificationRepository";

export type QualificationAnswers = {
  moveInDate: string;
  occupants: number;
  employmentStatus:
    | "employed"
    | "self_employed"
    | "unemployed"
    | "student"
    | "retired";
  incomeBand: "under_20k" | "20k_30k" | "30k_50k" | "50k_75k" | "over_75k";
  hasPets: boolean;
  viewingAvailability: string[];
};

export type ScoreCategory = "LOW" | "MEDIUM" | "STRONG";

/**
 * Advisory-only scoring engine — agent override required before any automated action.
 * Score is purely informational.
 */
function scoreQualification(
  answers: QualificationAnswers,
  monthlyRent: number,
): { score: number; category: ScoreCategory } {
  let score = 0;

  // Income vs rent ratio (assumes annual income bands vs monthly rent × 12 × 2.5)
  const annualRentThreshold = monthlyRent * 12 * 2.5;
  const incomeMidpoints: Record<string, number> = {
    under_20k: 15000,
    "20k_30k": 25000,
    "30k_50k": 40000,
    "50k_75k": 62500,
    over_75k: 85000,
  };
  const estimatedIncome = incomeMidpoints[answers.incomeBand] ?? 0;
  if (estimatedIncome >= annualRentThreshold) score += 3;

  // Move-in date urgency (within 30 days = motivated applicant)
  const daysUntilMoveIn =
    (new Date(answers.moveInDate).getTime() - Date.now()) /
    (1000 * 60 * 60 * 24);
  if (daysUntilMoveIn <= 30 && daysUntilMoveIn >= 0) score += 2;

  // Employment stability
  if (answers.employmentStatus === "employed") score += 2;
  else if (answers.employmentStatus === "self_employed") score += 1;

  // Availability provided
  if (answers.viewingAvailability.length >= 3) score += 1;

  const category: ScoreCategory =
    score >= 6 ? "STRONG" : score >= 3 ? "MEDIUM" : "LOW";

  return { score, category };
}

export const QualificationSubmitService = new Elysia({
  name: "QualificationSubmitService",
}).decorate("qualificationSubmitService", {
  async submitQualification(
    agencyId: string,
    leadId: string,
    answers: QualificationAnswers,
  ): Promise<{
    qualificationId: string;
    score: number;
    category: ScoreCategory;
  }> {
    const leadRepo = new LeadRepository(undefined, agencyId);
    const qualRepo = new QualificationRepository(undefined, agencyId);

    const lead = await leadRepo.findById(leadId);
    if (!lead) throw new Error(`Lead not found: ${leadId}`);

    // TODO: fetch monthly rent from property ref — using placeholder for now
    const monthlyRent = lead.propertyRent ?? 1500;

    const { score, category } = scoreQualification(answers, monthlyRent);

    const qualification = await qualRepo.create({
      leadId,
      answers,
      score,
      category,
    });

    await leadRepo.updateScore(leadId, score, category);
    await leadRepo.updateStatus(leadId, "QUALIFYING");

    return {
      qualificationId: qualification.id,
      score,
      category,
    };
  },
});
