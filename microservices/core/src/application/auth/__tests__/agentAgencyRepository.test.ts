import { describe, it, expect, vi, beforeEach } from "vitest";
import { AgentAgencyRepository } from "../agentAgencyRepository";
import type { Db } from "@lettingsops/db";

// ─── Mock DB helper ───────────────────────────────────────────────────────────
//
// Mirrors the chainable-mock pattern used in apiKeyRepository.test.ts so this
// repo's tests don't depend on a live Postgres in CI. The chain resolves to
// the value passed in — wherever `await this.db.select()...` lands, the
// awaited value is the array we supplied.

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
    "onConflictDoUpdate",
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

const mockRow = {
  agentId: "agent_xyz_001",
  agencyId: "agency-uuid-1",
  notes: "Reapit demo agent",
  createdAt: NOW,
  updatedAt: NOW,
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("AgentAgencyRepository", () => {
  let mockDb: Partial<Db>;
  let repo: AgentAgencyRepository;

  beforeEach(() => {
    mockDb = {
      select: vi.fn(() => mockChain([mockRow])),
      insert: vi.fn(() => mockChain([mockRow])),
    } as unknown as Partial<Db>;
    repo = new AgentAgencyRepository(mockDb as Db);
  });

  // ── findAgencyForAgent ────────────────────────────────────────────────────

  describe("findAgencyForAgent", () => {
    it("returns the agencyId when a mapping row exists (hit)", async () => {
      const result = await repo.findAgencyForAgent("agent_xyz_001");
      expect(result).toBe("agency-uuid-1");
      expect(mockDb.select).toHaveBeenCalledTimes(1);
    });

    it("returns null when no mapping row exists (miss)", async () => {
      // Re-wire `select` to resolve to an empty array — the realistic
      // shape of `db.select().from(...).where(...).limit(1)` for an
      // unknown agentId.
      mockDb.select = vi.fn(() => mockChain([])) as unknown as Db["select"];
      repo = new AgentAgencyRepository(mockDb as Db);

      const result = await repo.findAgencyForAgent("agent_unknown_999");
      expect(result).toBeNull();
    });

    it("returns null when row exists but agencyId is somehow undefined", async () => {
      // Defensive: a malformed row (e.g. partial DB state during a
      // migration) shouldn't leak `undefined` into the caller chain.
      // The repo collapses it to null so the webhook handler can throw
      // a clean 401.
      mockDb.select = vi.fn(() =>
        mockChain([{ agencyId: undefined }]),
      ) as unknown as Db["select"];
      repo = new AgentAgencyRepository(mockDb as Db);

      const result = await repo.findAgencyForAgent("agent_xyz_001");
      expect(result).toBeNull();
    });

    it("does NOT widen the SQL when multiple agents map to the same agency", async () => {
      // The map is keyed by `agent_id` (PK), so multiple agent_ids can
      // point at the same agency_id, but a single `findAgencyForAgent`
      // call still resolves to exactly one row. The `.limit(1)` in the
      // implementation is paranoia — the PK already guarantees this —
      // but verifies the query never asks for more than it needs.
      const calls: string[] = [];
      mockDb.select = vi.fn(() => {
        const chain = mockChain([mockRow]) as Record<string, unknown>;
        const origLimit = chain.limit as () => unknown;
        chain.limit = (n?: number) => {
          calls.push(`limit:${n ?? "noarg"}`);
          return origLimit();
        };
        return chain;
      }) as unknown as Db["select"];
      repo = new AgentAgencyRepository(mockDb as Db);

      await repo.findAgencyForAgent("agent_xyz_001");
      expect(calls).toEqual(["limit:1"]);
    });
  });

  // ── upsert ────────────────────────────────────────────────────────────────

  describe("upsert", () => {
    it("inserts a new mapping and returns the row", async () => {
      const row = await repo.upsert({
        agentId: "agent_xyz_001",
        agencyId: "agency-uuid-1",
        notes: "Reapit demo agent",
      });

      expect(row.agentId).toBe("agent_xyz_001");
      expect(row.agencyId).toBe("agency-uuid-1");
      expect(mockDb.insert).toHaveBeenCalledTimes(1);
    });

    it("throws a clear error when the insert returns no row", async () => {
      mockDb.insert = vi.fn(() => mockChain([])) as unknown as Db["insert"];
      repo = new AgentAgencyRepository(mockDb as Db);

      await expect(
        repo.upsert({ agentId: "agent_x", agencyId: "agency-uuid-1" }),
      ).rejects.toThrow("Failed to upsert agent_agency_map");
    });

    it("accepts an undefined `notes` field", async () => {
      // Operator-facing label is optional — make sure the type-level
      // optionality isn't silently lost (which would mean every seed
      // call needed an explicit `notes: undefined`).
      const row = await repo.upsert({
        agentId: "agent_xyz_002",
        agencyId: "agency-uuid-2",
      });
      expect(row).toBeDefined();
      expect(mockDb.insert).toHaveBeenCalledTimes(1);
    });
  });
});
