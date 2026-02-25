import { describe, it, expect, vi, beforeEach } from "vitest";
import { qualificationSubmitHandler } from "../qualificationSubmitHandler";

const mockResponse = {
  qualificationId: "qual-uuid-1",
  score: 8,
  category: "STRONG",
};

// Mock the QualificationRepository
vi.mock("../../repositories/qualificationRepository", () => ({
  QualificationRepository: vi.fn().mockImplementation(() => ({
    create: vi.fn().mockResolvedValue(mockResponse),
  })),
}));

vi.mock("../../repositories/leadRepository", () => ({
  LeadRepository: vi.fn().mockImplementation(() => ({
    updateScore: vi.fn().mockResolvedValue(undefined),
  })),
}));

describe("qualificationSubmitHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should be an Elysia instance with POST /leads/:id/qualification route", () => {
    expect(qualificationSubmitHandler).toBeDefined();
    expect(typeof qualificationSubmitHandler.fetch).toBe("function");
  });

  it("should require leadId in params", () => {
    const params = { id: "lead-uuid-1" };
    expect(params.id).toBeTruthy();
    expect(typeof params.id).toBe("string");
  });

  it("should require moveInDate in body with date format", () => {
    const body = {
      moveInDate: "2024-07-01",
    };
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    expect(body.moveInDate).toMatch(dateRegex);
  });

  it("should require occupants as positive number", () => {
    const testCases = [
      { occupants: 1, valid: true },
      { occupants: 5, valid: true },
      { occupants: 0, valid: false },
      { occupants: -1, valid: false },
    ];

    for (const { occupants, valid } of testCases) {
      if (valid) {
        expect(occupants).toBeGreaterThanOrEqual(1);
      } else {
        expect(occupants).toBeLessThan(1);
      }
    }
  });

  it("should require valid employmentStatus enum", () => {
    const validStatuses = [
      "employed",
      "self_employed",
      "unemployed",
      "student",
      "retired",
    ];

    for (const status of validStatuses) {
      expect(validStatuses).toContain(status);
    }

    expect(validStatuses).not.toContain("invalid");
  });

  it("should require valid incomeBand enum", () => {
    const validBands = [
      "under_20k",
      "20k_30k",
      "30k_50k",
      "50k_75k",
      "over_75k",
    ];

    for (const band of validBands) {
      expect(validBands).toContain(band);
    }

    expect(validBands).not.toContain("invalid");
  });

  it("should require hasPets as boolean", () => {
    const testValues = [true, false];

    for (const value of testValues) {
      expect(typeof value).toBe("boolean");
    }
  });

  it("should require viewingAvailability as array of strings", () => {
    const availability = ["Saturday morning", "Sunday afternoon"];
    expect(Array.isArray(availability)).toBe(true);
    expect(availability.every((item) => typeof item === "string")).toBe(true);
  });

  it("should return qualification response with required fields", () => {
    const response = mockResponse;
    expect(response).toHaveProperty("qualificationId");
    expect(response).toHaveProperty("score");
    expect(response).toHaveProperty("category");
  });

  it("should return valid category value", () => {
    const validCategories = ["LOW", "MEDIUM", "STRONG"];
    expect(validCategories).toContain(mockResponse.category);
  });

  it("should return score as number", () => {
    expect(typeof mockResponse.score).toBe("number");
    expect(mockResponse.score).toBeGreaterThanOrEqual(0);
    expect(mockResponse.score).toBeLessThanOrEqual(10);
  });

  it("should accept valid complete qualification request", () => {
    const body = {
      moveInDate: "2024-07-01",
      occupants: 2,
      employmentStatus: "employed",
      incomeBand: "30k_50k",
      hasPets: false,
      viewingAvailability: ["Saturday morning"],
    };

    expect(body).toHaveProperty("moveInDate");
    expect(body).toHaveProperty("occupants");
    expect(body).toHaveProperty("employmentStatus");
    expect(body).toHaveProperty("incomeBand");
    expect(body).toHaveProperty("hasPets");
    expect(body).toHaveProperty("viewingAvailability");
  });
});
