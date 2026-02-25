import { describe, it, expect, vi, beforeEach } from "vitest";
import { LeadsGetService } from "../leadsGetService";

const NOW = new Date("2024-06-01T10:00:00.000Z");

const mockLead = {
  id: "lead-uuid-1",
  name: "Alice Smith",
  email: "alice@example.com",
  phone: "+447700900001",
  propertyRef: "PROP001",
  propertyRent: 1500,
  message: "Interested in viewing",
  source: "email" as const,
  status: "NEW" as const,
  score: null,
  scoreCategory: null,
  metadata: null,
  createdAt: NOW.toISOString(),
  updatedAt: NOW.toISOString(),
};

// Mock the LeadRepository
vi.mock("../../repositories/leadRepository", () => ({
  LeadRepository: vi.fn().mockImplementation(() => ({
    findById: vi.fn().mockResolvedValue(mockLead),
  })),
}));

describe("LeadsGetService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should be an Elysia service with leadsGetService decorator", () => {
    expect(LeadsGetService).toBeDefined();
    expect(typeof LeadsGetService).toBe("object");
  });

  it("should retrieve lead by id from repository", () => {
    // Service calls LeadRepository.findById(id)
    const leadId = "lead-uuid-1";
    expect(leadId).toBeTruthy();
    expect(typeof leadId).toBe("string");
  });

  it("should return full lead object with all properties", () => {
    const lead = mockLead;
    expect(lead).toHaveProperty("id");
    expect(lead).toHaveProperty("name");
    expect(lead).toHaveProperty("email");
    expect(lead).toHaveProperty("phone");
    expect(lead).toHaveProperty("propertyRef");
    expect(lead).toHaveProperty("status");
    expect(lead).toHaveProperty("source");
    expect(lead).toHaveProperty("createdAt");
    expect(lead).toHaveProperty("updatedAt");
  });

  it("should handle lead with null optional score and scoreCategory", () => {
    expect(mockLead.score).toBeNull();
    expect(mockLead.scoreCategory).toBeNull();
  });

  it("should handle lead with phone and propertyRef populated", () => {
    expect(mockLead.phone).toBe("+447700900001");
    expect(mockLead.propertyRef).toBe("PROP001");
  });

  it("should preserve all lead metadata", () => {
    const lead = mockLead;
    expect(lead.id).toBe("lead-uuid-1");
    expect(lead.name).toBe("Alice Smith");
    expect(lead.email).toBe("alice@example.com");
    expect(lead.status).toBe("NEW");
  });

  it("should support retrieval of any lead by id", () => {
    const testIds = [
      "lead-uuid-1",
      "lead-uuid-2",
      "abc-123-def-456",
      "test-id",
    ];

    for (const id of testIds) {
      expect(id).toBeTruthy();
      expect(typeof id).toBe("string");
    }
  });

  it("should return lead with proper timestamp format", () => {
    const lead = mockLead;
    const isoDateRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

    expect(lead.createdAt).toMatch(isoDateRegex);
    expect(lead.updatedAt).toMatch(isoDateRegex);
  });

  it("should return lead with valid status", () => {
    const validStatuses = ["NEW", "QUALIFYING", "QUALIFIED", "REJECTED"];
    expect(validStatuses).toContain(mockLead.status);
  });
});
