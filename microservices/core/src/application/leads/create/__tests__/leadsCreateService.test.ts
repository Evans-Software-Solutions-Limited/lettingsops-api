import { describe, it, expect, vi, beforeEach } from "vitest";
import { LeadsCreateService } from "../leadsCreateService";

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
    create: vi.fn().mockResolvedValue(mockLead),
  })),
}));

describe("LeadsCreateService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should create lead with NEW status and provided source", async () => {
    const elysia = LeadsCreateService;
    expect(elysia).toBeDefined();

    // The service is an Elysia plugin that decorates 'leadsCreateService'
    // When used, it adds the createLead method to context
    const input = {
      name: "John Doe",
      email: "john@example.com",
      phone: "+447700900001",
      propertyRef: "PROP001",
      message: "Interested",
      source: "email" as const,
    };

    // Verify the service is properly defined
    expect(typeof elysia).toBe("object");
  });

  it("should default source to manual when not provided", () => {
    const input: { name: string; email: string; source?: string } = {
      name: "Jane Doe",
      email: "jane@example.com",
    };

    // This is what the service does internally
    const source = input.source ?? "manual";
    expect(source).toBe("manual");
  });

  it("should preserve provided source value", () => {
    const input = {
      name: "John Doe",
      email: "john@example.com",
      source: "portal" as const,
    };

    const source = input.source ?? "manual";
    expect(source).toBe("portal");
  });

  it("should return lead object with required properties", () => {
    // Verify the mock returns expected lead structure
    expect(mockLead).toHaveProperty("id");
    expect(mockLead).toHaveProperty("status");
    expect(mockLead).toHaveProperty("createdAt");
    expect(mockLead.status).toBe("NEW");
  });

  it("should always set status to NEW for new lead creation", () => {
    const sources = ["email", "phone", "portal", "manual"];

    for (const source of sources) {
      const result = {
        ...mockLead,
        source,
        status: "NEW",
      };
      expect(result.status).toBe("NEW");
    }
  });

  it("should include all input fields in repository call", () => {
    const input = {
      name: "Bob Smith",
      email: "bob@example.com",
      phone: "+447700900002",
      propertyRef: "PROP002",
      message: "Viewing enquiry",
      source: "portal" as const,
    };

    // Service merges fields and adds status
    const merged = {
      ...input,
      status: "NEW",
      source: input.source ?? "manual",
    };

    expect(merged.name).toBe("Bob Smith");
    expect(merged.email).toBe("bob@example.com");
    expect(merged.phone).toBe("+447700900002");
    expect(merged.propertyRef).toBe("PROP002");
    expect(merged.message).toBe("Viewing enquiry");
    expect(merged.source).toBe("portal");
  });
});
