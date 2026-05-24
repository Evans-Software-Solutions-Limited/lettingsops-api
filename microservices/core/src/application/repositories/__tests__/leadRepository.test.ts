import { describe, it, expect, vi, beforeEach } from "vitest";
import { LeadRepository } from "../leadRepository";
import { ANY_AGENCY } from "../tenantScopedRepository";
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

const mockLeadRow = {
  id: "lead-uuid-1",
  name: "Alice Smith",
  email: "alice@example.com",
  phone: "+447700900001",
  propertyRef: "PROP001",
  propertyRent: 1500,
  message: "Interested in 2-bed flat",
  source: "email" as const,
  status: "NEW" as const,
  score: null,
  scoreCategory: null,
  metadata: null,
  createdAt: NOW,
  updatedAt: NOW,
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("LeadRepository", () => {
  let mockDb: Partial<Db>;
  let repo: LeadRepository;

  beforeEach(() => {
    mockDb = {
      insert: vi.fn(() => mockChain([mockLeadRow])),
      select: vi.fn(() => mockChain([mockLeadRow])),
      update: vi.fn(() => mockChain([])),
    } as unknown as Partial<Db>;
    // Tests exercise the unscoped behaviour. The tenant-isolation
    // matrix in `tenantIsolation.test.ts` covers the agency-scoped
    // semantics. Construct with the ANY_AGENCY sentinel here so reads
    // skip the filter (matches pre-Block-E behaviour these tests were
    // written against).
    repo = new LeadRepository(mockDb as Db, ANY_AGENCY);
  });

  // ── create ──────────────────────────────────────────────────────────────────

  describe("create", () => {
    it("inserts a row and returns a mapped Lead", async () => {
      const lead = await repo.create({
        name: "Alice Smith",
        email: "alice@example.com",
        phone: "+447700900001",
        propertyRef: "PROP001",
        source: "email",
        status: "NEW",
      });

      expect(mockDb.insert).toHaveBeenCalledOnce();
      expect(lead).toMatchObject({
        id: "lead-uuid-1",
        name: "Alice Smith",
        email: "alice@example.com",
        status: "NEW",
        source: "email",
      });
      expect(lead.createdAt).toBe(NOW.toISOString());
    });

    it("throws if no row is returned", async () => {
      (mockDb.insert as ReturnType<typeof vi.fn>).mockReturnValue(
        mockChain([]),
      );

      await expect(
        repo.create({
          name: "X",
          email: "x@x.com",
          source: "manual",
          status: "NEW",
        }),
      ).rejects.toThrow("Failed to create lead");
    });
  });

  // ── findById ────────────────────────────────────────────────────────────────

  describe("findById", () => {
    it("returns a mapped Lead when found", async () => {
      const lead = await repo.findById("lead-uuid-1");
      expect(lead).not.toBeNull();
      expect(lead?.id).toBe("lead-uuid-1");
    });

    it("returns null when not found", async () => {
      (mockDb.select as ReturnType<typeof vi.fn>).mockReturnValue(
        mockChain([]),
      );
      const lead = await repo.findById("nonexistent");
      expect(lead).toBeNull();
    });
  });

  // ── findByEmail ─────────────────────────────────────────────────────────────

  describe("findByEmail", () => {
    it("returns a mapped Lead when found", async () => {
      const lead = await repo.findByEmail("alice@example.com");
      expect(lead?.email).toBe("alice@example.com");
    });

    it("returns null when not found", async () => {
      (mockDb.select as ReturnType<typeof vi.fn>).mockReturnValue(
        mockChain([]),
      );
      const lead = await repo.findByEmail("nobody@example.com");
      expect(lead).toBeNull();
    });
  });

  // ── findByMessageId ─────────────────────────────────────────────────────────

  describe("findByMessageId", () => {
    it("looks up communication_logs then returns the lead", async () => {
      // First select → communication_log row
      // Second select → lead row (via findById)
      (mockDb.select as ReturnType<typeof vi.fn>)
        .mockReturnValueOnce(mockChain([{ leadId: "lead-uuid-1" }]))
        .mockReturnValueOnce(mockChain([mockLeadRow]));

      const lead = await repo.findByMessageId("msg-abc123");
      expect(lead?.id).toBe("lead-uuid-1");
    });

    it("returns null when messageId has no matching log", async () => {
      (mockDb.select as ReturnType<typeof vi.fn>).mockReturnValue(
        mockChain([]),
      );
      const lead = await repo.findByMessageId("nonexistent-msg");
      expect(lead).toBeNull();
    });
  });

  // ── list ────────────────────────────────────────────────────────────────────

  describe("list", () => {
    it("returns paginated results with total count", async () => {
      (mockDb.select as ReturnType<typeof vi.fn>)
        .mockReturnValueOnce(mockChain([mockLeadRow])) // rows
        .mockReturnValueOnce(mockChain([{ count: "3" }])); // count

      const result = await repo.list({ page: 1, limit: 10 });

      expect(result.leads).toHaveLength(1);
      expect(result.total).toBe(3);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
    });

    it("returns empty array when no results", async () => {
      (mockDb.select as ReturnType<typeof vi.fn>)
        .mockReturnValueOnce(mockChain([]))
        .mockReturnValueOnce(mockChain([{ count: "0" }]));

      const result = await repo.list({ page: 1, limit: 10 });
      expect(result.leads).toHaveLength(0);
      expect(result.total).toBe(0);
    });
  });

  // ── updateStatus ────────────────────────────────────────────────────────────

  describe("updateStatus", () => {
    it("calls update with the new status", async () => {
      await repo.updateStatus("lead-uuid-1", "QUALIFYING");
      expect(mockDb.update).toHaveBeenCalledOnce();
    });
  });

  // ── updateScore ─────────────────────────────────────────────────────────────

  describe("updateScore", () => {
    it("calls update with score and category", async () => {
      await repo.updateScore("lead-uuid-1", 7, "STRONG");
      expect(mockDb.update).toHaveBeenCalledOnce();
    });
  });

  // ── addNote ─────────────────────────────────────────────────────────────────

  describe("addNote", () => {
    it("inserts into communication_logs", async () => {
      await repo.addNote("lead-uuid-1", {
        source: "email",
        messageId: "msg-001",
        subject: "Viewing request",
        receivedAt: NOW.toISOString(),
      });
      expect(mockDb.insert).toHaveBeenCalledOnce();
    });
  });
});
