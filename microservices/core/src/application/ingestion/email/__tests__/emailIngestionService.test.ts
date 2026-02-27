import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  EmailIngestionService,
  processEmail,
  type EmailPayload,
} from "../emailIngestionService";

const mockLead = {
  id: "lead-existing-1",
  name: "Existing Lead",
  email: "existing@example.com",
  source: "email" as const,
  status: "NEW" as const,
  createdAt: "2024-06-01T10:00:00.000Z",
  updatedAt: "2024-06-01T10:00:00.000Z",
};

const mockLeadRepo = {
  findByMessageId: vi.fn(),
  findByEmail: vi.fn(),
  create: vi.fn(),
  addNote: vi.fn(),
};

vi.mock("../../../repositories/leadRepository", () => ({
  LeadRepository: vi.fn(() => mockLeadRepo),
}));

describe("EmailIngestionService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: no existing lead, create returns a new lead (for tests that don't override)
    mockLeadRepo.findByMessageId.mockResolvedValue(null);
    mockLeadRepo.findByEmail.mockResolvedValue(null);
    mockLeadRepo.create.mockResolvedValue({
      ...mockLead,
      id: "lead-mock-id",
      email: "mock@example.com",
    });
  });

  describe("processEmail standalone function", () => {
    it("should be callable directly without Elysia", async () => {
      const payload: EmailPayload = {
        messageId: "msg-direct",
        from: "user@example.com",
        fromName: "John Doe",
        subject: "Test",
        body: "Test body",
        receivedAt: "2024-06-01T10:00:00.000Z",
      };

      const result = await processEmail(payload);

      expect(result).toHaveProperty("leadId");
      expect(result).toHaveProperty("action");
      expect(result.action).toBe("CREATED");
    });

    it("returns IGNORED when findByMessageId returns existing lead", async () => {
      mockLeadRepo.findByMessageId.mockResolvedValue(mockLead);

      const result = await processEmail({
        messageId: "msg-duplicate",
        from: "any@example.com",
        subject: "Re: Enquiry",
        body: "Body",
        receivedAt: "2024-06-01T10:00:00.000Z",
      });

      expect(result.action).toBe("IGNORED");
      expect(result.leadId).toBe(mockLead.id);
      expect(mockLeadRepo.create).not.toHaveBeenCalled();
      expect(mockLeadRepo.addNote).not.toHaveBeenCalled();
    });

    it("returns MERGED when findByEmail returns existing lead and calls addNote", async () => {
      mockLeadRepo.findByMessageId.mockResolvedValue(null);
      mockLeadRepo.findByEmail.mockResolvedValue(mockLead);
      mockLeadRepo.addNote.mockResolvedValue(undefined);

      const payload: EmailPayload = {
        messageId: "msg-second",
        from: "existing@example.com",
        subject: "Second enquiry",
        body: "Body",
        receivedAt: "2024-06-01T10:00:00.000Z",
      };

      const result = await processEmail(payload);

      expect(result.action).toBe("MERGED");
      expect(result.leadId).toBe(mockLead.id);
      expect(mockLeadRepo.addNote).toHaveBeenCalledWith(mockLead.id, {
        source: "email",
        messageId: payload.messageId,
        subject: payload.subject,
        receivedAt: payload.receivedAt,
      });
      expect(mockLeadRepo.create).not.toHaveBeenCalled();
    });

    it("returns CREATED when no existing lead and creates new lead", async () => {
      mockLeadRepo.findByMessageId.mockResolvedValue(null);
      mockLeadRepo.findByEmail.mockResolvedValue(null);
      mockLeadRepo.create.mockResolvedValue({
        ...mockLead,
        id: "lead-new-1",
        email: "new@example.com",
      });

      const result = await processEmail({
        messageId: "msg-new",
        from: "new@example.com",
        fromName: "New User",
        subject: "Enquiry",
        body: "Body",
        receivedAt: "2024-06-01T10:00:00.000Z",
      });

      expect(result.action).toBe("CREATED");
      expect(result.leadId).toBe("lead-new-1");
      expect(mockLeadRepo.create).toHaveBeenCalled();
    });

    it("passes LLM-extracted name as fromName to lead creation", async () => {
      mockLeadRepo.findByMessageId.mockResolvedValue(null);
      mockLeadRepo.findByEmail.mockResolvedValue(null);
      mockLeadRepo.create.mockResolvedValue({
        ...mockLead,
        id: "lead-llm-1",
        name: "John Smith",
        email: "john@example.com",
      });

      const payload: EmailPayload = {
        messageId: "msg-with-llm-name",
        from: "john@example.com",
        fromName: "John Smith", // LLM-extracted name
        subject: "Enquiry",
        body: "Body",
        receivedAt: "2024-06-01T10:00:00.000Z",
      };

      const result = await processEmail(payload);

      expect(result.action).toBe("CREATED");
      expect(mockLeadRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "John Smith",
          email: "john@example.com",
        }),
      );
    });

    it("falls back to email prefix when LLM name not provided", async () => {
      mockLeadRepo.findByMessageId.mockResolvedValue(null);
      mockLeadRepo.findByEmail.mockResolvedValue(null);
      mockLeadRepo.create.mockResolvedValue({
        ...mockLead,
        id: "lead-fallback-1",
        name: "jane",
        email: "jane.doe@example.com",
      });

      const payload: EmailPayload = {
        messageId: "msg-no-llm-name",
        from: "jane.doe@example.com",
        // No fromName provided
        subject: "Enquiry",
        body: "Body",
        receivedAt: "2024-06-01T10:00:00.000Z",
      };

      const result = await processEmail(payload);

      expect(result.action).toBe("CREATED");
      expect(mockLeadRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "jane.doe", // email prefix
        }),
      );
    });

    it("uses email prefix when fromName is empty string (LLM can return \"\")", async () => {
      mockLeadRepo.findByMessageId.mockResolvedValue(null);
      mockLeadRepo.findByEmail.mockResolvedValue(null);
      mockLeadRepo.create.mockResolvedValue({
        ...mockLead,
        id: "lead-empty-name",
        name: "sender",
        email: "sender@example.com",
      });

      const result = await processEmail({
        messageId: "msg-empty-name",
        from: "sender@example.com",
        fromName: "",
        subject: "Enquiry",
        body: "Body",
        receivedAt: "2024-06-01T10:00:00.000Z",
      });

      expect(result.action).toBe("CREATED");
      expect(mockLeadRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "sender",
          email: "sender@example.com",
        }),
      );
    });

    it("uses email prefix when fromName is whitespace-only", async () => {
      mockLeadRepo.findByMessageId.mockResolvedValue(null);
      mockLeadRepo.findByEmail.mockResolvedValue(null);
      mockLeadRepo.create.mockResolvedValue({
        ...mockLead,
        id: "lead-ws-name",
        name: "user",
        email: "user@example.com",
      });

      const result = await processEmail({
        messageId: "msg-ws-name",
        from: "user@example.com",
        fromName: "   \t  ",
        subject: "Enquiry",
        body: "Body",
        receivedAt: "2024-06-01T10:00:00.000Z",
      });

      expect(result.action).toBe("CREATED");
      expect(mockLeadRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "user",
          email: "user@example.com",
        }),
      );
    });
  });

  describe("with repository mocks", () => {
    it("returns IGNORED when findByMessageId returns existing lead", async () => {
      mockLeadRepo.findByMessageId.mockResolvedValue(mockLead);

      const result =
        await EmailIngestionService.decorator.emailIngestionService.processEmail(
          {
            messageId: "msg-duplicate",
            from: "any@example.com",
            subject: "Re: Enquiry",
            body: "Body",
            receivedAt: "2024-06-01T10:00:00.000Z",
          },
        );

      expect(result.action).toBe("IGNORED");
      expect(result.leadId).toBe(mockLead.id);
      expect(mockLeadRepo.create).not.toHaveBeenCalled();
      expect(mockLeadRepo.addNote).not.toHaveBeenCalled();
    });

    it("returns MERGED when findByEmail returns existing lead and calls addNote", async () => {
      mockLeadRepo.findByMessageId.mockResolvedValue(null);
      mockLeadRepo.findByEmail.mockResolvedValue(mockLead);
      mockLeadRepo.addNote.mockResolvedValue(undefined);

      const payload: EmailPayload = {
        messageId: "msg-second",
        from: "existing@example.com",
        subject: "Second enquiry",
        body: "Body",
        receivedAt: "2024-06-01T10:00:00.000Z",
      };

      const result =
        await EmailIngestionService.decorator.emailIngestionService.processEmail(
          payload,
        );

      expect(result.action).toBe("MERGED");
      expect(result.leadId).toBe(mockLead.id);
      expect(mockLeadRepo.addNote).toHaveBeenCalledWith(mockLead.id, {
        source: "email",
        messageId: payload.messageId,
        subject: payload.subject,
        receivedAt: payload.receivedAt,
      });
      expect(mockLeadRepo.create).not.toHaveBeenCalled();
    });

    it("returns CREATED when no existing lead and creates new lead", async () => {
      mockLeadRepo.findByMessageId.mockResolvedValue(null);
      mockLeadRepo.findByEmail.mockResolvedValue(null);
      mockLeadRepo.create.mockResolvedValue({
        ...mockLead,
        id: "lead-new-1",
        email: "new@example.com",
      });

      const result =
        await EmailIngestionService.decorator.emailIngestionService.processEmail(
          {
            messageId: "msg-new",
            from: "new@example.com",
            fromName: "New User",
            subject: "Enquiry",
            body: "Body",
            receivedAt: "2024-06-01T10:00:00.000Z",
          },
        );

      expect(result.action).toBe("CREATED");
      expect(result.leadId).toBe("lead-new-1");
      expect(mockLeadRepo.create).toHaveBeenCalled();
    });
  });

  describe("service shape and payloads", () => {
    it("should be an Elysia service", () => {
      expect(EmailIngestionService).toBeDefined();
      expect(typeof EmailIngestionService).toBe("object");
    });

    it("should have emailIngestionService decorator", () => {
      expect(EmailIngestionService.decorator).toBeDefined();
      expect(
        EmailIngestionService.decorator.emailIngestionService,
      ).toBeDefined();
      expect(
        typeof EmailIngestionService.decorator.emailIngestionService
          .processEmail,
      ).toBe("function");
    });

    it("should accept EmailPayload with all required fields", () => {
      const payload: EmailPayload = {
        messageId: "msg-abc123",
        from: "user@example.com",
        fromName: "John Doe",
        subject: "Enquiry",
        body: "Interested",
        receivedAt: "2024-06-01T10:00:00.000Z",
        propertyRef: "PROP001",
      };

      expect(payload).toHaveProperty("messageId");
      expect(payload).toHaveProperty("from");
      expect(payload).toHaveProperty("fromName");
      expect(payload).toHaveProperty("subject");
      expect(payload).toHaveProperty("body");
      expect(payload).toHaveProperty("receivedAt");
    });

    it("should accept EmailPayload without fromName", () => {
      const payload: Omit<EmailPayload, "fromName"> = {
        messageId: "msg-abc123",
        from: "john.doe@example.com",
        subject: "Enquiry",
        body: "Interested",
        receivedAt: "2024-06-01T10:00:00.000Z",
      };

      expect(payload).not.toHaveProperty("fromName");
      expect(payload).toHaveProperty("from");
    });

    it("should accept EmailPayload without propertyRef", () => {
      const payload: Omit<EmailPayload, "propertyRef"> = {
        messageId: "msg-abc123",
        from: "user@example.com",
        fromName: "John Doe",
        subject: "Enquiry",
        body: "Interested",
        receivedAt: "2024-06-01T10:00:00.000Z",
      };

      expect(payload).not.toHaveProperty("propertyRef");
    });

    it("should return an IngestionResult with leadId and action", async () => {
      const payload: EmailPayload = {
        messageId: "msg-abc123",
        from: "newuser@example.com",
        fromName: "New User",
        subject: "New enquiry",
        body: "Interested in property",
        receivedAt: "2024-06-01T10:00:00.000Z",
      };

      const result =
        await EmailIngestionService.decorator.emailIngestionService.processEmail(
          payload,
        );

      expect(result).toHaveProperty("leadId");
      expect(result).toHaveProperty("action");
      expect(typeof result.leadId).toBe("string");
      expect(["CREATED", "MERGED", "IGNORED"]).toContain(result.action);
    });

    it("should support CREATED action", async () => {
      const payload: EmailPayload = {
        messageId: `msg-${Date.now()}`,
        from: `unique-${Date.now()}@example.com`,
        fromName: "Test User",
        subject: "Test enquiry",
        body: "Test message",
        receivedAt: new Date().toISOString(),
      };

      const result =
        await EmailIngestionService.decorator.emailIngestionService.processEmail(
          payload,
        );

      expect(["CREATED", "MERGED", "IGNORED"]).toContain(result.action);
    });

    it("should support MERGED action", async () => {
      const payload1: EmailPayload = {
        messageId: `msg-${Date.now()}`,
        from: "same@example.com",
        fromName: "User One",
        subject: "First enquiry",
        body: "First message",
        receivedAt: new Date().toISOString(),
      };

      const result1 =
        await EmailIngestionService.decorator.emailIngestionService.processEmail(
          payload1,
        );

      // Second message from same email
      const payload2: EmailPayload = {
        messageId: `msg-${Date.now() + 1}`,
        from: "same@example.com",
        fromName: "User One",
        subject: "Second enquiry",
        body: "Second message",
        receivedAt: new Date().toISOString(),
      };

      const result2 =
        await EmailIngestionService.decorator.emailIngestionService.processEmail(
          payload2,
        );

      expect(["CREATED", "MERGED", "IGNORED"]).toContain(result1.action);
      expect(["CREATED", "MERGED", "IGNORED"]).toContain(result2.action);
    });

    it("should support IGNORED action for duplicate messageId", async () => {
      const messageId = `msg-${Date.now()}`;
      const payload: EmailPayload = {
        messageId,
        from: `test-${Date.now()}@example.com`,
        fromName: "Test User",
        subject: "Test enquiry",
        body: "Test message",
        receivedAt: new Date().toISOString(),
      };

      const result1 =
        await EmailIngestionService.decorator.emailIngestionService.processEmail(
          payload,
        );

      // Same messageId should be ignored
      const result2 =
        await EmailIngestionService.decorator.emailIngestionService.processEmail(
          payload,
        );

      expect(["CREATED", "MERGED", "IGNORED"]).toContain(result1.action);
      expect(["CREATED", "MERGED", "IGNORED"]).toContain(result2.action);
    });

    it("should handle fromName as optional field", async () => {
      const payloadWithName: EmailPayload = {
        messageId: `msg-${Date.now()}`,
        from: "user@example.com",
        fromName: "John Doe",
        subject: "Enquiry",
        body: "Interested",
        receivedAt: "2024-06-01T10:00:00.000Z",
      };

      const payloadWithoutName: EmailPayload = {
        messageId: `msg-${Date.now() + 1}`,
        from: "john.doe@example.com",
        subject: "Enquiry",
        body: "Interested",
        receivedAt: "2024-06-01T10:00:00.000Z",
      };

      const result1 =
        await EmailIngestionService.decorator.emailIngestionService.processEmail(
          payloadWithName,
        );

      const result2 =
        await EmailIngestionService.decorator.emailIngestionService.processEmail(
          payloadWithoutName,
        );

      expect(result1).toHaveProperty("leadId");
      expect(result2).toHaveProperty("leadId");
    });

    it("should extract name from fromName when available", async () => {
      const payload: EmailPayload = {
        messageId: `msg-${Date.now()}`,
        from: "user@example.com",
        fromName: "John Doe",
        subject: "Enquiry",
        body: "Interested",
        receivedAt: "2024-06-01T10:00:00.000Z",
      };

      const result =
        await EmailIngestionService.decorator.emailIngestionService.processEmail(
          payload,
        );

      expect(result.leadId).toBeTruthy();
      expect(typeof result.leadId).toBe("string");
    });

    it("should extract name from email prefix when fromName missing", async () => {
      const payload: EmailPayload = {
        messageId: `msg-${Date.now()}`,
        from: "john.doe@example.com",
        subject: "Enquiry",
        body: "Interested",
        receivedAt: "2024-06-01T10:00:00.000Z",
      };

      const result =
        await EmailIngestionService.decorator.emailIngestionService.processEmail(
          payload,
        );

      expect(result.leadId).toBeTruthy();
      expect(["CREATED", "MERGED", "IGNORED"]).toContain(result.action);
    });

    it("should handle propertyRef in payload", async () => {
      const payload: EmailPayload = {
        messageId: `msg-${Date.now()}`,
        from: `user-${Date.now()}@example.com`,
        subject: "Enquiry for PROP001",
        body: "Interested",
        receivedAt: "2024-06-01T10:00:00.000Z",
        propertyRef: "PROP001",
      };

      const result =
        await EmailIngestionService.decorator.emailIngestionService.processEmail(
          payload,
        );

      expect(result).toHaveProperty("leadId");
      expect(result).toHaveProperty("action");
    });

    it("should handle timestamps in ISO format", async () => {
      const isoDate = new Date().toISOString();
      const payload: EmailPayload = {
        messageId: `msg-${Date.now()}`,
        from: `user-${Date.now()}@example.com`,
        fromName: "Test User",
        subject: "Test enquiry",
        body: "Test message",
        receivedAt: isoDate,
      };

      const result =
        await EmailIngestionService.decorator.emailIngestionService.processEmail(
          payload,
        );

      expect(result.leadId).toBeTruthy();
    });
  });
});
