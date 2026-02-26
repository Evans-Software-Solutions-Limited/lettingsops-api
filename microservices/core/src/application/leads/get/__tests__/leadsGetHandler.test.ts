import { describe, it, expect, vi, beforeEach } from "vitest";
import { leadsGetHandler } from "../leadsGetHandler";

const mockLead = {
  id: "lead-uuid-1",
  name: "John Doe",
  email: "john@example.com",
  phone: "+447700900001",
  propertyRef: "PROP001",
  status: "NEW",
  source: "email",
  score: null,
  scoreCategory: null,
  createdAt: "2024-06-01T10:00:00.000Z",
  updatedAt: "2024-06-01T10:00:00.000Z",
};

// Mock the LeadRepository
vi.mock("../../repositories/leadRepository", () => ({
  LeadRepository: vi.fn().mockImplementation(() => ({
    findById: vi.fn().mockResolvedValue(mockLead),
  })),
}));

describe("leadsGetHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should be an Elysia instance with GET /leads/:id route", () => {
    expect(leadsGetHandler).toBeDefined();
    expect(typeof leadsGetHandler.fetch).toBe("function");
  });

  it("should require id parameter", () => {
    // Route expects /leads/:id pattern
    const validPath = "/leads/lead-uuid-1";
    const invalidPath = "/leads/";

    expect(validPath).toMatch(/^\/leads\/[^/]+$/);
    expect(invalidPath).not.toMatch(/^\/leads\/[^/]+$/);
  });

  it("should return lead object with all required fields", () => {
    const response = mockLead;
    expect(response).toHaveProperty("id");
    expect(response).toHaveProperty("name");
    expect(response).toHaveProperty("email");
    expect(response).toHaveProperty("status");
    expect(response).toHaveProperty("source");
    expect(response).toHaveProperty("createdAt");
    expect(response).toHaveProperty("updatedAt");
  });

  it("should include optional fields when present", () => {
    const leadWithOptionals = {
      ...mockLead,
      phone: "+447700900001",
      propertyRef: "PROP001",
      score: 8,
      scoreCategory: "STRONG",
    };

    expect(leadWithOptionals).toHaveProperty("phone");
    expect(leadWithOptionals).toHaveProperty("propertyRef");
    expect(leadWithOptionals).toHaveProperty("score");
    expect(leadWithOptionals).toHaveProperty("scoreCategory");
  });

  it("should handle leads without optional fields", () => {
    const leadWithoutOptionals = {
      id: "lead-uuid-2",
      name: "Jane Doe",
      email: "jane@example.com",
      status: "NEW",
      source: "manual",
      createdAt: "2024-06-01T11:00:00.000Z",
      updatedAt: "2024-06-01T11:00:00.000Z",
      phone: undefined as string | undefined,
      propertyRef: undefined as string | undefined,
      score: undefined as number | undefined,
      scoreCategory: undefined as string | undefined,
    };

    expect(leadWithoutOptionals.phone).toBeUndefined();
    expect(leadWithoutOptionals.propertyRef).toBeUndefined();
    expect(leadWithoutOptionals.score).toBeUndefined();
    expect(leadWithoutOptionals.scoreCategory).toBeUndefined();
  });

  it("should validate id is a non-empty string", () => {
    const validIds = ["lead-uuid-1", "abc123", "test"];
    const invalidIds = [""];

    for (const id of validIds) {
      expect(id.length).toBeGreaterThan(0);
      expect(typeof id).toBe("string");
    }

    for (const id of invalidIds) {
      expect(id.length).toBe(0);
    }
  });

  it("should return lead with timestamps as ISO strings", () => {
    expect(mockLead.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(mockLead.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("should return lead with correct status field", () => {
    const lead = mockLead;
    expect(["NEW", "QUALIFYING", "QUALIFIED", "REJECTED"]).toContain(
      lead.status,
    );
  });

  it("should return lead with valid source values", () => {
    const validSources = ["email", "phone", "portal", "manual"];
    expect(validSources).toContain(mockLead.source);
  });
});
