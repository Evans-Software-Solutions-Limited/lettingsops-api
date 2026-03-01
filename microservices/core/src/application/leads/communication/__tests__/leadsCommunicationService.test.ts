import { describe, it, expect, vi, beforeEach } from "vitest";
import { LeadsCommunicationService } from "../leadsCommunicationService";

const mockDb = {
  select: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnThis(),
  where: vi.fn(),
};

vi.mock("@lettingsops/db", () => ({
  getDb: vi.fn(() => mockDb),
  communicationLogs: { leadId: {} },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((col, val) => ({ col, val })),
}));

describe("LeadsCommunicationService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should be an Elysia service plugin", () => {
    expect(LeadsCommunicationService).toBeDefined();
    expect(typeof LeadsCommunicationService).toBe("object");
  });

  it("should have getCommunication decorator method", () => {
    expect(LeadsCommunicationService.decorator).toBeDefined();
    expect(
      LeadsCommunicationService.decorator.leadsCommunicationService,
    ).toBeDefined();
    expect(
      typeof LeadsCommunicationService.decorator.leadsCommunicationService
        .getCommunication,
    ).toBe("function");
  });

  it("should return empty array when no logs exist", async () => {
    mockDb.where.mockResolvedValue([]);

    const result =
      await LeadsCommunicationService.decorator.leadsCommunicationService.getCommunication(
        "lead-123",
      );

    expect(result).toEqual({
      leadId: "lead-123",
      communications: [],
    });
    expect(mockDb.select).toHaveBeenCalled();
  });

  it("should map DB rows to correct shape including source/subject/body/receivedAt/direction", async () => {
    const mockRows = [
      {
        id: "log-1",
        source: "email",
        subject: "Viewing Request",
        body: "I'd like to view the property",
        receivedAt: new Date("2024-03-01T10:00:00Z"),
        messageId: "msg-1",
      },
      {
        id: "log-2",
        source: "phone",
        subject: "Call: viewing_enquiry",
        body: "agent: Hello\nuser: Hi there",
        receivedAt: new Date("2024-03-01T11:00:00Z"),
        messageId: "msg-2",
      },
      {
        id: "log-3",
        source: "portal",
        subject: null,
        body: null,
        receivedAt: new Date("2024-03-01T12:00:00Z"),
        messageId: "msg-3",
      },
    ];
    mockDb.where.mockResolvedValue(mockRows);

    const result =
      await LeadsCommunicationService.decorator.leadsCommunicationService.getCommunication(
        "lead-123",
      );

    expect(result.leadId).toBe("lead-123");
    expect(result.communications).toHaveLength(3);

    // Check first log (email with subject and body)
    expect(result.communications[0]).toEqual({
      id: "log-1",
      source: "email",
      subject: "Viewing Request",
      body: "I'd like to view the property",
      receivedAt: "2024-03-01T10:00:00.000Z",
      direction: "inbound",
    });

    // Check second log (phone with transcript-like body)
    expect(result.communications[1]).toEqual({
      id: "log-2",
      source: "phone",
      subject: "Call: viewing_enquiry",
      body: "agent: Hello\nuser: Hi there",
      receivedAt: "2024-03-01T11:00:00.000Z",
      direction: "inbound",
    });

    // Check third log (null subject and body omitted)
    expect(result.communications[2]).toEqual({
      id: "log-3",
      source: "portal",
      receivedAt: "2024-03-01T12:00:00.000Z",
      direction: "inbound",
    });
    expect(result.communications[2]).not.toHaveProperty("subject");
    expect(result.communications[2]).not.toHaveProperty("body");
  });

  it("should handle NULL receivedAt by using current date", async () => {
    const mockRows = [
      {
        id: "log-1",
        source: "email",
        subject: "Test",
        body: "Test body",
        receivedAt: null,
        messageId: "msg-1",
      },
    ];
    mockDb.where.mockResolvedValue(mockRows);

    const result =
      await LeadsCommunicationService.decorator.leadsCommunicationService.getCommunication(
        "lead-123",
      );

    expect(result.communications).toHaveLength(1);
    expect(result.communications[0]).toHaveProperty("receivedAt");
    // Should be a valid ISO date string
    const date = new Date(result.communications[0].receivedAt);
    expect(date).toBeInstanceOf(Date);
    expect(date.getTime()).toBeGreaterThan(0);
  });

  it("should always include direction as inbound", async () => {
    const mockRows = [
      {
        id: "log-1",
        source: "email",
        subject: "Test",
        body: "Test",
        receivedAt: new Date(),
        messageId: "msg-1",
      },
      {
        id: "log-2",
        source: "phone",
        subject: "Call",
        body: null,
        receivedAt: new Date(),
        messageId: "msg-2",
      },
    ];
    mockDb.where.mockResolvedValue(mockRows);

    const result =
      await LeadsCommunicationService.decorator.leadsCommunicationService.getCommunication(
        "lead-123",
      );

    expect(result.communications.every((c) => c.direction === "inbound")).toBe(
      true,
    );
  });

  it("should filter communications by leadId", async () => {
    mockDb.where.mockResolvedValue([]);

    await LeadsCommunicationService.decorator.leadsCommunicationService.getCommunication(
      "lead-456",
    );

    // Verify the query chain was called
    expect(mockDb.select).toHaveBeenCalled();
    expect(mockDb.from).toHaveBeenCalled();
    expect(mockDb.where).toHaveBeenCalled();
  });

  it("should return communications in the order they were received", async () => {
    const mockRows = [
      {
        id: "log-1",
        source: "email",
        subject: "First",
        body: "First message",
        receivedAt: new Date("2024-03-01T10:00:00Z"),
        messageId: "msg-1",
      },
      {
        id: "log-2",
        source: "email",
        subject: "Second",
        body: "Second message",
        receivedAt: new Date("2024-03-01T11:00:00Z"),
        messageId: "msg-2",
      },
      {
        id: "log-3",
        source: "email",
        subject: "Third",
        body: "Third message",
        receivedAt: new Date("2024-03-01T12:00:00Z"),
        messageId: "msg-3",
      },
    ];
    mockDb.where.mockResolvedValue(mockRows);

    const result =
      await LeadsCommunicationService.decorator.leadsCommunicationService.getCommunication(
        "lead-123",
      );

    expect(result.communications[0].subject).toBe("First");
    expect(result.communications[1].subject).toBe("Second");
    expect(result.communications[2].subject).toBe("Third");
  });
});
