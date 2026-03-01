import { describe, it, expect, vi, beforeEach } from "vitest";
import { ElevenLabsWebhookService } from "../elevenLabsWebhookService";

const mockLead = {
  id: "lead-123",
  name: "John Doe",
  email: "john@example.com",
  source: "phone" as const,
  status: "NEW" as const,
  createdAt: "2024-03-01T10:00:00.000Z",
  updatedAt: "2024-03-01T10:00:00.000Z",
};

const mockLeadRepo = {
  findByEmail: vi.fn(),
  create: vi.fn(),
  addNote: vi.fn(),
};

const mockDb = {};

vi.mock("@lettingsops/db", () => ({
  getDb: vi.fn(() => mockDb),
}));

vi.mock("../../repositories/leadRepository", () => ({
  LeadRepository: vi.fn(() => mockLeadRepo),
}));

describe("ElevenLabsWebhookService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should be an Elysia service plugin", () => {
    expect(ElevenLabsWebhookService).toBeDefined();
    expect(typeof ElevenLabsWebhookService).toBe("object");
  });

  it("should have handleWebhook decorator method", () => {
    expect(ElevenLabsWebhookService.decorator).toBeDefined();
    expect(
      ElevenLabsWebhookService.decorator.elevenLabsWebhookService,
    ).toBeDefined();
    expect(
      typeof ElevenLabsWebhookService.decorator.elevenLabsWebhookService
        .handleWebhook,
    ).toBe("function");
  });

  it("should create a new lead when email not found", async () => {
    mockLeadRepo.findByEmail.mockResolvedValue(null);
    mockLeadRepo.create.mockResolvedValue(mockLead);

    const payload = {
      callId: "call-456",
      agentId: "agent-789",
      intent: "viewing_enquiry" as const,
      extractedFields: {
        name: "John Doe",
        email: "john@example.com",
        phone: "07700000000",
        propertyRef: "PROP-001",
      },
      transcript: [],
    };

    const result =
      await ElevenLabsWebhookService.decorator.elevenLabsWebhookService.handleWebhook(
        payload,
      );

    expect(mockLeadRepo.findByEmail).toHaveBeenCalledWith("john@example.com");
    expect(mockLeadRepo.create).toHaveBeenCalled();
    expect(result.success).toBe(true);
    expect(result.leadId).toBe("lead-123");
  });

  it("should reuse existing lead when found", async () => {
    mockLeadRepo.findByEmail.mockResolvedValue(mockLead);

    const payload = {
      callId: "call-456",
      agentId: "agent-789",
      intent: "maintenance" as const,
      extractedFields: {
        email: "john@example.com",
      },
      transcript: [],
    };

    const result =
      await ElevenLabsWebhookService.decorator.elevenLabsWebhookService.handleWebhook(
        payload,
      );

    expect(mockLeadRepo.findByEmail).toHaveBeenCalledWith("john@example.com");
    expect(mockLeadRepo.create).not.toHaveBeenCalled();
    expect(result.success).toBe(true);
    expect(result.leadId).toBe("lead-123");
  });

  it("should store transcript body when transcript present", async () => {
    mockLeadRepo.findByEmail.mockResolvedValue(mockLead);

    const payload = {
      callId: "call-456",
      agentId: "agent-789",
      intent: "viewing_enquiry" as const,
      extractedFields: {
        email: "john@example.com",
      },
      transcript: [
        {
          role: "agent" as const,
          message: "Hello, how can I help?",
          timestamp: "2024-01-01T10:00:00Z",
        },
        {
          role: "user" as const,
          message: "I'm interested in viewing the property",
          timestamp: "2024-01-01T10:01:00Z",
        },
        {
          role: "agent" as const,
          message: "Great! Let me check availability",
          timestamp: "2024-01-01T10:02:00Z",
        },
      ],
    };

    await ElevenLabsWebhookService.decorator.elevenLabsWebhookService.handleWebhook(
      payload,
    );

    expect(mockLeadRepo.addNote).toHaveBeenCalledWith("lead-123", {
      source: "phone",
      messageId: "call-456",
      subject: "Call: viewing_enquiry",
      body: "agent: Hello, how can I help?\nuser: I'm interested in viewing the property\nagent: Great! Let me check availability",
      receivedAt: expect.any(String),
    });
  });

  it("should handle missing extractedFields gracefully", async () => {
    mockLeadRepo.findByEmail.mockResolvedValue(null);
    mockLeadRepo.create.mockResolvedValue({
      ...mockLead,
      name: "Unknown Caller",
      email: "call-abc123@elevenlabs.local",
    });

    const payload = {
      callId: "abc123",
      agentId: "agent-789",
      intent: "other" as const,
      transcript: [],
    };

    const result =
      await ElevenLabsWebhookService.decorator.elevenLabsWebhookService.handleWebhook(
        payload,
      );

    expect(mockLeadRepo.findByEmail).toHaveBeenCalledWith(
      "call-abc123@elevenlabs.local",
    );
    expect(mockLeadRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Unknown Caller",
        email: "call-abc123@elevenlabs.local",
      }),
    );
    expect(result.success).toBe(true);
  });

  it("should not call addNote when transcript is empty", async () => {
    mockLeadRepo.findByEmail.mockResolvedValue(mockLead);

    const payload = {
      callId: "call-456",
      agentId: "agent-789",
      intent: "viewing_enquiry" as const,
      extractedFields: {
        email: "john@example.com",
      },
      transcript: [],
    };

    await ElevenLabsWebhookService.decorator.elevenLabsWebhookService.handleWebhook(
      payload,
    );

    expect(mockLeadRepo.addNote).not.toHaveBeenCalled();
  });

  it("should store metadata including call duration", async () => {
    mockLeadRepo.findByEmail.mockResolvedValue(null);
    mockLeadRepo.create.mockResolvedValue(mockLead);

    const payload = {
      callId: "call-456",
      agentId: "agent-789",
      intent: "rent_query" as const,
      extractedFields: {
        name: "Jane Smith",
        email: "jane@example.com",
        moveInDate: "2024-04-01",
      },
      callDurationSeconds: 300,
      transcript: [],
    };

    await ElevenLabsWebhookService.decorator.elevenLabsWebhookService.handleWebhook(
      payload,
    );

    expect(mockLeadRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          callId: "call-456",
          agentId: "agent-789",
          intent: "rent_query",
          callDurationSeconds: 300,
        }),
      }),
    );
  });
});
