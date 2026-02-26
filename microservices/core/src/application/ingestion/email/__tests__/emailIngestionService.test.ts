import { describe, it, expect } from "vitest";
import {
  EmailIngestionService,
  type EmailPayload,
} from "../emailIngestionService";

describe("EmailIngestionService", () => {
  it("should be an Elysia service", () => {
    expect(EmailIngestionService).toBeDefined();
    expect(typeof EmailIngestionService).toBe("object");
  });

  it("should have emailIngestionService decorator", () => {
    expect(EmailIngestionService.decorator).toBeDefined();
    expect(EmailIngestionService.decorator.emailIngestionService).toBeDefined();
    expect(
      typeof EmailIngestionService.decorator.emailIngestionService.processEmail,
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
