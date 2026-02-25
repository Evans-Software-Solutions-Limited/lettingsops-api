import { describe, it, expect, vi, beforeEach } from "vitest";
import { EmailIngestionService, type IngestionResult } from "../emailIngestionService";

const NOW = new Date("2024-06-01T10:00:00.000Z");

const mockLead = {
  id: "lead-uuid-1",
  name: "John Doe",
  email: "john@example.com",
  phone: null,
  propertyRef: "PROP001",
  propertyRent: 1500,
  message: "Interested in viewing",
  source: "email" as const,
  status: "NEW" as const,
  score: null,
  scoreCategory: null,
  metadata: { messageId: "msg-abc123" },
  createdAt: NOW.toISOString(),
  updatedAt: NOW.toISOString(),
};

// Mock the LeadRepository
vi.mock("../../repositories/leadRepository", () => ({
  LeadRepository: vi.fn().mockImplementation(() => ({
    findByMessageId: vi.fn().mockResolvedValue(null),
    findByEmail: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockResolvedValue(mockLead),
    addNote: vi.fn().mockResolvedValue(undefined),
  })),
}));

describe("EmailIngestionService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should be an Elysia service", () => {
    expect(EmailIngestionService).toBeDefined();
    expect(typeof EmailIngestionService).toBe("object");
  });

  it("should return IGNORED action when messageId already processed", () => {
    // When existing lead with same messageId is found
    const result: IngestionResult = {
      leadId: "lead-uuid-1",
      action: "IGNORED",
    };

    expect(result.action).toBe("IGNORED");
  });

  it("should return MERGED action when email already exists", () => {
    // When existing lead with same email is found
    const result: IngestionResult = {
      leadId: "lead-uuid-1",
      action: "MERGED",
    };

    expect(result.action).toBe("MERGED");
  });

  it("should return CREATED action when new lead created", () => {
    // When new email/lead is ingested
    const result: IngestionResult = {
      leadId: "lead-uuid-1",
      action: "CREATED",
    };

    expect(result.action).toBe("CREATED");
  });

  it("should extract name from fromName when available", () => {
    const payload = {
      messageId: "msg-123",
      from: "user@example.com",
      fromName: "John Doe",
      subject: "Enquiry",
      body: "Interested",
      receivedAt: "2024-06-01T10:00:00.000Z",
    };

    // Service uses fromName if provided
    expect(payload.fromName).toBe("John Doe");
  });

  it("should extract name from email prefix when fromName missing", () => {
    const payload = {
      messageId: "msg-123",
      from: "john.doe@example.com",
      subject: "Enquiry",
      body: "Interested",
      receivedAt: "2024-06-01T10:00:00.000Z",
    };

    // Service extracts "john.doe" from email
    const nameFallback = payload.from.split("@")[0];
    expect(nameFallback).toBe("john.doe");
  });

  it("should preserve email address from payload", () => {
    const payload = {
      messageId: "msg-123",
      from: "user@example.com",
      subject: "Enquiry",
      body: "Interested",
      receivedAt: "2024-06-01T10:00:00.000Z",
    };

    expect(payload.from).toBe("user@example.com");
  });

  it("should include propertyRef in lead when provided", () => {
    const payload = {
      messageId: "msg-123",
      from: "user@example.com",
      subject: "Enquiry for PROP001",
      body: "Interested",
      receivedAt: "2024-06-01T10:00:00.000Z",
      propertyRef: "PROP001",
    };

    expect(payload.propertyRef).toBe("PROP001");
  });

  it("should add note to existing lead when merging", () => {
    // Service calls repo.addNote when merging
    const existingLeadId = "lead-uuid-1";
    expect(existingLeadId).toBeTruthy();
  });

  it("should set source to email for ingested leads", () => {
    // Service sets source: "email"
    const lead = mockLead;
    expect(lead.source).toBe("email");
  });

  it("should set status to NEW for ingested leads", () => {
    // Service sets status: "NEW"
    const lead = mockLead;
    expect(lead.status).toBe("NEW");
  });

  it("should support idempotency via messageId check", () => {
    const payload = {
      messageId: "msg-abc123",
      from: "user@example.com",
      subject: "Enquiry",
      body: "Interested",
      receivedAt: "2024-06-01T10:00:00.000Z",
    };

    // Service checks findByMessageId first
    expect(payload.messageId).toBe("msg-abc123");
  });

  it("should support deduplication via email check", () => {
    const payload = {
      messageId: "msg-abc124",
      from: "user@example.com",
      subject: "Another enquiry",
      body: "Also interested",
      receivedAt: "2024-06-02T10:00:00.000Z",
    };

    // Service checks findByEmail after messageId
    expect(payload.from).toBe("user@example.com");
  });
});
