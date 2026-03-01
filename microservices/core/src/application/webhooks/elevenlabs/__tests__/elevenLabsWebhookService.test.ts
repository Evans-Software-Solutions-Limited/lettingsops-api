import { describe, it, expect, vi, beforeEach } from "vitest";
import { ElevenLabsWebhookService } from "../elevenLabsWebhookService";
import type { Db } from "@lettingsops/db";

// ─── Mock DB helper ───────────────────────────────────────────────────────────

/**
 * Creates a fluent chain that:
 * - Returns itself from all query builder methods (select/from/where/limit/etc.)
 * - Is directly awaitable (resolving to `result`)
 * - Returns a real Promise from `.returning()`
 */
function mockChain<T>(result: T) {
  const chain: Record<string, unknown> = {};
  const promise = Promise.resolve(result);

  const fluent = [
    "values",
    "set",
    "from",
    "where",
    "limit",
    "offset",
    "orderBy",
    "leftJoin",
    "innerJoin",
  ];

  for (const method of fluent) {
    chain[method] = () => chain;
  }

  chain["returning"] = () => promise;
  chain["then"] = (
    resolve: Parameters<Promise<T>["then"]>[0],
    reject?: Parameters<Promise<T>["then"]>[1],
  ) => promise.then(resolve, reject);
  chain["catch"] = (reject: Parameters<Promise<T>["catch"]>[0]) =>
    promise.catch(reject);

  return chain;
}

const NOW = new Date("2024-03-01T10:00:00.000Z");

const mockLeadRow = {
  id: "lead-123",
  name: "John Doe",
  email: "john@example.com",
  phone: null,
  propertyRef: null,
  propertyRent: null,
  message: null,
  source: "phone" as const,
  status: "NEW" as const,
  score: null,
  scoreCategory: null,
  metadata: null,
  createdAt: NOW,
  updatedAt: NOW,
};

let mockDb: Partial<Db>;

vi.mock("@lettingsops/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@lettingsops/db")>();
  return {
    ...actual,
    getDb: vi.fn(() => mockDb),
  };
});

describe("ElevenLabsWebhookService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = {
      insert: vi.fn(() => mockChain([mockLeadRow])),
      select: vi.fn(() => mockChain([mockLeadRow])),
      update: vi.fn(() => mockChain([])),
    } as unknown as Partial<Db>;
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
    // First select call returns no lead, insert returns new lead
    (mockDb.select as ReturnType<typeof vi.fn>).mockReturnValue(mockChain([]));
    (mockDb.insert as ReturnType<typeof vi.fn>).mockReturnValue(
      mockChain([mockLeadRow]),
    );

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

    expect(mockDb.select).toHaveBeenCalled();
    expect(mockDb.insert).toHaveBeenCalled();
    expect(result.success).toBe(true);
    expect(result.leadId).toBe("lead-123");
  });

  it("should reuse existing lead when found", async () => {
    // Select returns existing lead
    (mockDb.select as ReturnType<typeof vi.fn>).mockReturnValue(
      mockChain([mockLeadRow]),
    );

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

    expect(mockDb.select).toHaveBeenCalled();
    expect(mockDb.insert).not.toHaveBeenCalled();
    expect(result.success).toBe(true);
    expect(result.leadId).toBe("lead-123");
  });

  it("should store transcript body when transcript present", async () => {
    // Select returns existing lead, insert for communication log
    (mockDb.select as ReturnType<typeof vi.fn>).mockReturnValue(
      mockChain([mockLeadRow]),
    );
    (mockDb.insert as ReturnType<typeof vi.fn>).mockReturnValue(mockChain([]));

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

    expect(mockDb.insert).toHaveBeenCalled();
  });

  it("should handle missing extractedFields gracefully", async () => {
    // Select returns no lead for synthetic email
    (mockDb.select as ReturnType<typeof vi.fn>).mockReturnValue(mockChain([]));
    const unknownCallerRow = {
      ...mockLeadRow,
      name: "Unknown Caller",
      email: "call-abc123@elevenlabs.local",
    };
    (mockDb.insert as ReturnType<typeof vi.fn>).mockReturnValue(
      mockChain([unknownCallerRow]),
    );

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

    expect(mockDb.select).toHaveBeenCalled();
    expect(mockDb.insert).toHaveBeenCalled();
    expect(result.success).toBe(true);
  });

  it("should not call addNote when transcript is empty", async () => {
    // Select returns existing lead, no insert should happen for communication log
    (mockDb.select as ReturnType<typeof vi.fn>).mockReturnValue(
      mockChain([mockLeadRow]),
    );

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

    // insert should not be called when transcript is empty
    expect(mockDb.insert).not.toHaveBeenCalled();
  });

  it("should store metadata including call duration", async () => {
    // Select returns no lead, insert creates new one
    (mockDb.select as ReturnType<typeof vi.fn>).mockReturnValue(mockChain([]));
    (mockDb.insert as ReturnType<typeof vi.fn>).mockReturnValue(
      mockChain([mockLeadRow]),
    );

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

    expect(mockDb.insert).toHaveBeenCalled();
  });
});
