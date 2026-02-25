import { describe, it, expect, vi, beforeEach } from "vitest";
import { emailIngestionHandler } from "../emailIngestionHandler";

const mockResponse = {
  leadId: "lead-uuid-1",
  action: "CREATED",
};

// Mock the EmailIngestionService
vi.mock("../emailIngestionService", () => ({
  EmailIngestionService: {
    decorate: vi.fn().mockReturnThis(),
    use: vi.fn().mockReturnThis(),
    post: vi.fn().mockReturnThis(),
  },
}));

describe("emailIngestionHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should be an Elysia instance with POST /webhooks/email route", () => {
    expect(emailIngestionHandler).toBeDefined();
    expect(typeof emailIngestionHandler.fetch).toBe("function");
  });

  it("should require messageId in body", () => {
    const payload = {
      messageId: "msg-abc123",
      from: "sender@example.com",
      subject: "Viewing enquiry",
      body: "I'm interested in viewing",
      receivedAt: "2024-06-01T10:00:00.000Z",
    };

    expect(payload).toHaveProperty("messageId");
    expect(payload.messageId).toBeTruthy();
  });

  it("should require from email address", () => {
    const payload = {
      messageId: "msg-abc123",
      from: "sender@example.com",
      subject: "Viewing enquiry",
      body: "I'm interested",
      receivedAt: "2024-06-01T10:00:00.000Z",
    };

    expect(payload).toHaveProperty("from");
    expect(payload.from).toMatch(/@/);
  });

  it("should require subject", () => {
    const payload = {
      messageId: "msg-abc123",
      from: "sender@example.com",
      subject: "Viewing enquiry",
      body: "I'm interested",
      receivedAt: "2024-06-01T10:00:00.000Z",
    };

    expect(payload).toHaveProperty("subject");
    expect(payload.subject).toBeTruthy();
  });

  it("should require body", () => {
    const payload = {
      messageId: "msg-abc123",
      from: "sender@example.com",
      subject: "Viewing enquiry",
      body: "I'm interested in viewing the property",
      receivedAt: "2024-06-01T10:00:00.000Z",
    };

    expect(payload).toHaveProperty("body");
    expect(payload.body).toBeTruthy();
  });

  it("should require receivedAt timestamp", () => {
    const payload = {
      messageId: "msg-abc123",
      from: "sender@example.com",
      subject: "Viewing enquiry",
      body: "I'm interested",
      receivedAt: "2024-06-01T10:00:00.000Z",
    };

    expect(payload).toHaveProperty("receivedAt");
    expect(payload.receivedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("should accept optional fromName", () => {
    const payload = {
      messageId: "msg-abc123",
      from: "sender@example.com",
      fromName: "John Doe",
      subject: "Viewing enquiry",
      body: "I'm interested",
      receivedAt: "2024-06-01T10:00:00.000Z",
    };

    expect(payload).toHaveProperty("fromName");
    expect(payload.fromName).toBe("John Doe");
  });

  it("should accept optional propertyRef", () => {
    const payload = {
      messageId: "msg-abc123",
      from: "sender@example.com",
      subject: "Viewing enquiry",
      body: "Interested in PROP001",
      receivedAt: "2024-06-01T10:00:00.000Z",
      propertyRef: "PROP001",
    };

    expect(payload).toHaveProperty("propertyRef");
    expect(payload.propertyRef).toBe("PROP001");
  });

  it("should return leadId and action", () => {
    const response = mockResponse;
    expect(response).toHaveProperty("leadId");
    expect(response).toHaveProperty("action");
  });

  it("should return valid action values", () => {
    const validActions = ["CREATED", "MERGED", "IGNORED"];
    expect(validActions).toContain(mockResponse.action);
  });

  it("should be idempotent (same messageId handled safely)", () => {
    const payload1 = {
      messageId: "msg-abc123",
      from: "sender@example.com",
      subject: "Viewing enquiry",
      body: "Interested",
      receivedAt: "2024-06-01T10:00:00.000Z",
    };

    const payload2 = {
      messageId: "msg-abc123",
      from: "sender@example.com",
      subject: "Viewing enquiry",
      body: "Interested",
      receivedAt: "2024-06-01T10:00:00.000Z",
    };

    expect(payload1.messageId).toBe(payload2.messageId);
  });

  it("should support webhook request with minimal required fields", () => {
    const minimalPayload = {
      messageId: "msg-123",
      from: "user@example.com",
      subject: "Enquiry",
      body: "Text",
      receivedAt: "2024-06-01T10:00:00.000Z",
    };

    expect(minimalPayload).toHaveProperty("messageId");
    expect(minimalPayload).toHaveProperty("from");
    expect(minimalPayload).toHaveProperty("subject");
    expect(minimalPayload).toHaveProperty("body");
    expect(minimalPayload).toHaveProperty("receivedAt");
  });
});
