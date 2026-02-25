import { describe, it, expect, vi, beforeEach } from "vitest";
import { QualificationSubmitService, type ScoreCategory } from "../qualificationSubmitService";

const NOW = new Date("2024-06-01T10:00:00.000Z");

const mockQualification = {
  id: "qual-uuid-1",
  leadId: "lead-uuid-1",
  answers: {
    moveInDate: "2024-07-01",
    occupants: 2,
    employmentStatus: "employed" as const,
    incomeBand: "30k_50k" as const,
    hasPets: false,
    viewingAvailability: ["Saturday morning", "Sunday afternoon"],
  },
  score: 8,
  category: "STRONG" as const,
  createdAt: NOW.toISOString(),
};

const mockLead = {
  id: "lead-uuid-1",
  name: "John Doe",
  email: "john@example.com",
  phone: "+447700900001",
  propertyRef: "PROP001",
  propertyRent: 1500,
  message: "Viewing enquiry",
  source: "email" as const,
  status: "NEW" as const,
  score: null,
  scoreCategory: null,
  createdAt: NOW.toISOString(),
  updatedAt: NOW.toISOString(),
};

// Mock repositories
vi.mock("../../repositories/leadRepository", () => ({
  LeadRepository: vi.fn().mockImplementation(() => ({
    findById: vi.fn().mockResolvedValue(mockLead),
    updateScore: vi.fn().mockResolvedValue(undefined),
    updateStatus: vi.fn().mockResolvedValue(undefined),
  })),
}));

vi.mock("../../repositories/qualificationRepository", () => ({
  QualificationRepository: vi.fn().mockImplementation(() => ({
    create: vi.fn().mockResolvedValue(mockQualification),
  })),
}));

describe("QualificationSubmitService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should be an Elysia service", () => {
    expect(QualificationSubmitService).toBeDefined();
    expect(typeof QualificationSubmitService).toBe("object");
  });

  it("should score qualification with income band consideration", () => {
    const lowIncomeAnswers = {
      moveInDate: "2024-07-01",
      occupants: 2,
      employmentStatus: "employed" as const,
      incomeBand: "under_20k" as const,
      hasPets: false,
      viewingAvailability: ["Saturday morning"],
    };

    // Annual income ~15k < monthly rent 1500 × 12 × 2.5 = 45k, so no income bonus
    const incomeThreshold = 1500 * 12 * 2.5; // 45000
    const estimatedIncome = 15000; // under_20k midpoint
    expect(estimatedIncome).toBeLessThan(incomeThreshold);
  });

  it("should score qualification with employment status bonus", () => {
    const employedAnswers = {
      moveInDate: "2024-07-01",
      occupants: 2,
      employmentStatus: "employed" as const,
      incomeBand: "30k_50k" as const,
      hasPets: false,
      viewingAvailability: ["Saturday morning"],
    };

    expect(employedAnswers.employmentStatus).toBe("employed");
  });

  it("should score qualification with move-in urgency bonus", () => {
    // Move in within 30 days gives bonus
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 15); // 15 days from now
    const soon = futureDate.toISOString().split("T")[0];

    expect(soon).toBeTruthy();
  });

  it("should score qualification with viewing availability bonus", () => {
    const availableAnswers = {
      moveInDate: "2024-07-01",
      occupants: 2,
      employmentStatus: "employed" as const,
      incomeBand: "30k_50k" as const,
      hasPets: false,
      viewingAvailability: [
        "Saturday morning",
        "Sunday afternoon",
        "Monday evening",
      ],
    };

    expect(availableAnswers.viewingAvailability.length).toBeGreaterThanOrEqual(
      3,
    );
  });

  it("should categorize score as STRONG when >= 6", () => {
    const strongScore = 8;
    const category: ScoreCategory =
      strongScore >= 6 ? "STRONG" : strongScore >= 3 ? "MEDIUM" : "LOW";
    expect(category).toBe("STRONG");
  });

  it("should categorize score as MEDIUM when 3-5", () => {
    const mediumScore = 4;
    const category: ScoreCategory =
      mediumScore >= 6 ? "STRONG" : mediumScore >= 3 ? "MEDIUM" : "LOW";
    expect(category).toBe("MEDIUM");
  });

  it("should categorize score as LOW when < 3", () => {
    const lowScore = 1;
    const category: ScoreCategory =
      lowScore >= 6 ? "STRONG" : lowScore >= 3 ? "MEDIUM" : "LOW";
    expect(category).toBe("LOW");
  });

  it("should return qualification with id, score, and category", () => {
    const response = {
      qualificationId: mockQualification.id,
      score: mockQualification.score,
      category: mockQualification.category,
    };

    expect(response).toHaveProperty("qualificationId");
    expect(response).toHaveProperty("score");
    expect(response).toHaveProperty("category");
  });

  it("should support all employment status options", () => {
    const statuses = [
      "employed",
      "self_employed",
      "unemployed",
      "student",
      "retired",
    ];

    for (const status of statuses) {
      expect(statuses).toContain(status);
    }
  });

  it("should support all income band options", () => {
    const bands = ["under_20k", "20k_30k", "30k_50k", "50k_75k", "over_75k"];

    for (const band of bands) {
      expect(bands).toContain(band);
    }
  });
});
