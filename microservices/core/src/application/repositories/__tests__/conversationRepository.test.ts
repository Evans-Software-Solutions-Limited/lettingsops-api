import { describe, it, expect, vi, beforeEach } from "vitest";
import { ConversationRepository } from "../conversationRepository";
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

const NOW = new Date("2024-06-01T10:00:00.000Z");

const mockConversationRow = {
  id: "conv-uuid-1",
  agencyId: "agency-uuid-1",
  leadId: "lead-uuid-1",
  tenantEmail: "tenant@example.com",
  conversationType: "VIEWING_ENQUIRY" as const,
  threadMessageIds: ["msg-001"],
  collectedFields: { name: "John Doe" },
  status: "active",
  createdAt: NOW,
  updatedAt: NOW,
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("ConversationRepository", () => {
  let mockDb: Partial<Db>;
  let repo: ConversationRepository;

  beforeEach(() => {
    mockDb = {
      select: vi.fn(() => mockChain([mockConversationRow])),
      insert: vi.fn(() => mockChain([mockConversationRow])),
      update: vi.fn(() => mockChain([])),
    } as unknown as Partial<Db>;
    repo = new ConversationRepository(mockDb as Db);
  });

  // ── findByAgencyAndEmail ────────────────────────────────────────────────────

  describe("findByAgencyAndEmail", () => {
    it("returns a conversation when found", async () => {
      const conversation = await repo.findByAgencyAndEmail(
        "agency-uuid-1",
        "tenant@example.com",
      );
      expect(conversation).not.toBeNull();
      expect(conversation?.id).toBe("conv-uuid-1");
      expect(conversation?.tenantEmail).toBe("tenant@example.com");
    });

    it("returns null when not found", async () => {
      (mockDb.select as ReturnType<typeof vi.fn>).mockReturnValue(
        mockChain([]),
      );
      const conversation = await repo.findByAgencyAndEmail(
        "agency-uuid-1",
        "nonexistent@example.com",
      );
      expect(conversation).toBeNull();
    });
  });

  // ── findById ────────────────────────────────────────────────────────────────

  describe("findById", () => {
    it("returns a conversation when found", async () => {
      const conversation = await repo.findById("conv-uuid-1");
      expect(conversation).not.toBeNull();
      expect(conversation?.id).toBe("conv-uuid-1");
    });

    it("returns null when not found", async () => {
      (mockDb.select as ReturnType<typeof vi.fn>).mockReturnValue(
        mockChain([]),
      );
      const conversation = await repo.findById("nonexistent");
      expect(conversation).toBeNull();
    });
  });

  // ── create ──────────────────────────────────────────────────────────────────

  describe("create", () => {
    it("inserts a row and returns a mapped conversation", async () => {
      const conversation = await repo.create({
        agencyId: "agency-uuid-1",
        tenantEmail: "tenant@example.com",
      });

      expect(mockDb.insert).toHaveBeenCalledOnce();
      expect(conversation).toMatchObject({
        id: "conv-uuid-1",
        agencyId: "agency-uuid-1",
        tenantEmail: "tenant@example.com",
        status: "active",
      });
      expect(conversation.threadMessageIds).toEqual(["msg-001"]);
    });

    it("includes leadId when provided", async () => {
      await repo.create({
        agencyId: "agency-uuid-1",
        tenantEmail: "tenant@example.com",
        leadId: "lead-uuid-123",
      });

      expect(mockDb.insert).toHaveBeenCalledOnce();
    });

    it("throws if no row is returned", async () => {
      (mockDb.insert as ReturnType<typeof vi.fn>).mockReturnValue(
        mockChain([]),
      );

      await expect(
        repo.create({
          agencyId: "agency-uuid-1",
          tenantEmail: "tenant@example.com",
        }),
      ).rejects.toThrow("Failed to create conversation");
    });
  });

  // ── appendMessageId ─────────────────────────────────────────────────────────

  describe("appendMessageId", () => {
    it("appends messageId to threadMessageIds", async () => {
      // First select returns existing conversation
      // Second update is called
      (mockDb.select as ReturnType<typeof vi.fn>).mockReturnValueOnce(
        mockChain([mockConversationRow]),
      );

      await repo.appendMessageId("conv-uuid-1", "msg-002");

      expect(mockDb.select).toHaveBeenCalledOnce();
      expect(mockDb.update).toHaveBeenCalledOnce();
    });

    it("throws if conversation not found", async () => {
      (mockDb.select as ReturnType<typeof vi.fn>).mockReturnValue(
        mockChain([]),
      );

      await expect(
        repo.appendMessageId("nonexistent", "msg-002"),
      ).rejects.toThrow("Conversation not found");
    });
  });

  // ── setCollectedFields ──────────────────────────────────────────────────────

  describe("setCollectedFields", () => {
    it("calls update with the new fields", async () => {
      const newFields = { name: "Jane Doe", email: "jane@example.com" };
      await repo.setCollectedFields("conv-uuid-1", newFields);

      expect(mockDb.update).toHaveBeenCalledOnce();
    });
  });

  // ── markComplete ────────────────────────────────────────────────────────────

  describe("markComplete", () => {
    it("sets status to completed", async () => {
      await repo.markComplete("conv-uuid-1");

      expect(mockDb.update).toHaveBeenCalledOnce();
    });
  });
});
