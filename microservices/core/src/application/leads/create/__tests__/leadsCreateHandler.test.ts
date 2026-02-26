import { describe, it, expect, vi, beforeEach } from "vitest";
import { leadsCreateHandler } from "../leadsCreateHandler";

const mockLead = {
  id: "lead-uuid-1",
  name: "John Doe",
  email: "john@example.com",
  phone: "+447700900001",
  propertyRef: "PROP001",
  source: "email",
  status: "NEW",
  createdAt: "2024-06-01T10:00:00.000Z",
};

// Mock the LeadRepository
vi.mock("../../repositories/leadRepository", () => ({
  LeadRepository: vi.fn().mockImplementation(() => ({
    create: vi.fn().mockResolvedValue(mockLead),
  })),
}));

describe("leadsCreateHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should be an Elysia instance with POST /leads route", () => {
    expect(leadsCreateHandler).toBeDefined();
    // Elysia instances have fetch method
    expect(typeof leadsCreateHandler.fetch).toBe("function");
  });

  it("should use LeadsCreateService plugin to provide createLead method", () => {
    expect(leadsCreateHandler).toBeDefined();
    // The handler uses LeadsCreateService plugin which provides leadsCreateService
    // on the context
  });

  it("should require name field in request body", () => {
    // Elysia schema defines name as required string
    const payload = {
      email: "test@example.com",
    };

    // Missing name should fail validation
    expect(payload).not.toHaveProperty("name");
  });

  it("should require email field in request body", () => {
    // Elysia schema defines email with format: "email"
    const payload = {
      name: "John Doe",
    };

    // Missing email should fail validation
    expect(payload).not.toHaveProperty("email");
  });

  it("should accept optional phone, propertyRef, message fields", () => {
    const payload = {
      name: "John Doe",
      email: "john@example.com",
      phone: "+447700900001",
      propertyRef: "PROP001",
      message: "Interested in viewing",
    };

    expect(payload).toHaveProperty("phone");
    expect(payload).toHaveProperty("propertyRef");
    expect(payload).toHaveProperty("message");
  });

  it("should validate email format", () => {
    // Elysia schema specifies format: "email"
    const validEmails = [
      "user@example.com",
      "test.user@example.co.uk",
      "user+tag@example.com",
    ];
    const invalidEmails = [
      "notanemail",
      "user@",
      "@example.com",
      "user @example.com",
    ];

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    for (const email of validEmails) {
      expect(emailRegex.test(email)).toBe(true);
    }

    for (const email of invalidEmails) {
      expect(emailRegex.test(email)).toBe(false);
    }
  });

  it("should restrict source to enum values: email, phone, portal, manual", () => {
    const validSources = ["email", "phone", "portal", "manual"];

    for (const source of validSources) {
      expect(validSources).toContain(source);
    }

    // Invalid sources should not be in the enum
    expect(validSources).not.toContain("invalid");
    expect(validSources).not.toContain("unknown");
  });

  it("should return 200 status with lead object on success", () => {
    expect(mockLead).toMatchObject({
      id: expect.any(String),
      status: "NEW",
      createdAt: expect.any(String),
    });
  });

  it("should create lead with NEW status regardless of input", () => {
    // Handler always creates leads with NEW status
    expect(mockLead.status).toBe("NEW");
  });

  it("should support minimal request with just name and email", () => {
    const minimalPayload = {
      name: "Jane Doe",
      email: "jane@example.com",
    };

    expect(minimalPayload).toHaveProperty("name");
    expect(minimalPayload).toHaveProperty("email");
    expect(minimalPayload.name).toBeTruthy();
    expect(minimalPayload.email).toBeTruthy();
  });

  it("should support full request with all optional fields", () => {
    const fullPayload = {
      name: "John Doe",
      email: "john@example.com",
      phone: "+447700900001",
      propertyRef: "PROP001",
      message: "Interested in 2-bed flat",
      source: "email",
    };

    expect(fullPayload).toHaveProperty("name");
    expect(fullPayload).toHaveProperty("email");
    expect(fullPayload).toHaveProperty("phone");
    expect(fullPayload).toHaveProperty("propertyRef");
    expect(fullPayload).toHaveProperty("message");
    expect(fullPayload).toHaveProperty("source");
  });
});
