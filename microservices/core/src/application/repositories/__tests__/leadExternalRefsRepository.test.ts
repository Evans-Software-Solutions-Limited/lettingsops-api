import { describe, it, expect, vi, beforeEach } from "vitest";
import { LeadExternalRefsRepository } from "../leadExternalRefsRepository";
import type { Db } from "@lettingsops/db";

function mockChain<T>(result: T) {
  const chain: Record<string, unknown> = {};
  const promise = Promise.resolve(result);
  for (const m of [
    "values",
    "set",
    "from",
    "where",
    "limit",
    "onConflictDoUpdate",
  ]) {
    chain[m] = () => chain;
  }
  chain["returning"] = () => promise;
  chain["then"] = (
    resolve: Parameters<Promise<T>["then"]>[0],
    reject?: Parameters<Promise<T>["then"]>[1],
  ) => promise.then(resolve, reject);
  return chain;
}

const FIXTURE_AGENCY = "agency-test-1";
const NOW = new Date("2026-06-01T10:00:00.000Z");

const mockRow = {
  id: "ref-uuid-1",
  agencyId: FIXTURE_AGENCY,
  leadId: "lead-uuid-1",
  crmKind: "reapit",
  externalId: "REAPIT-LEAD-12345",
  createdAt: NOW,
};

describe("LeadExternalRefsRepository", () => {
  let mockDb: Partial<Db>;
  let repo: LeadExternalRefsRepository;

  beforeEach(() => {
    mockDb = {
      select: vi.fn(() => mockChain([mockRow])),
      insert: vi.fn(() => mockChain([mockRow])),
    } as unknown as Partial<Db>;
    repo = new LeadExternalRefsRepository(mockDb as Db, FIXTURE_AGENCY);
  });

  describe("findByLeadAndKind", () => {
    it("returns the row when one exists for this lead + CRM kind", async () => {
      const row = await repo.findByLeadAndKind("lead-uuid-1", "reapit");
      expect(row?.externalId).toBe("REAPIT-LEAD-12345");
    });

    it("returns null when no row exists (first push for this lead+kind)", async () => {
      mockDb.select = vi.fn(
        () => mockChain([]) as unknown as ReturnType<Db["select"]>,
      ) as unknown as Db["select"];
      repo = new LeadExternalRefsRepository(mockDb as Db, FIXTURE_AGENCY);

      const row = await repo.findByLeadAndKind("lead-uuid-1", "reapit");
      expect(row).toBeNull();
    });
  });

  describe("upsert", () => {
    it("inserts a fresh ref and returns the persisted row", async () => {
      const row = await repo.upsert({
        leadId: "lead-uuid-1",
        crmKind: "reapit",
        externalId: "REAPIT-LEAD-12345",
      });
      expect(row.externalId).toBe("REAPIT-LEAD-12345");
      expect(mockDb.insert).toHaveBeenCalledTimes(1);
    });

    it("passes onConflictDoUpdate targeting the (lead_id, crm_kind) unique index", async () => {
      // Inspector Brad-style regression guard — if a future refactor
      // drops the ON CONFLICT clause, every retry would create
      // duplicate refs and the unique-index would start raising at
      // the DB layer. We verify the call chain hits onConflictDoUpdate.
      const onConflictSpy = vi.fn();
      const chain: Record<string, unknown> = {
        values: () => chain,
        onConflictDoUpdate: (arg: unknown) => {
          onConflictSpy(arg);
          return chain;
        },
        returning: () => Promise.resolve([mockRow]),
      };
      mockDb.insert = vi.fn(
        () => chain as unknown as ReturnType<Db["insert"]>,
      ) as unknown as Db["insert"];
      repo = new LeadExternalRefsRepository(mockDb as Db, FIXTURE_AGENCY);

      await repo.upsert({
        leadId: "lead-uuid-1",
        crmKind: "reapit",
        externalId: "REAPIT-LEAD-99999",
      });

      expect(onConflictSpy).toHaveBeenCalledTimes(1);
      const arg = onConflictSpy.mock.calls[0]?.[0] as {
        target: unknown;
        set: { externalId: string };
      };
      expect(arg.set.externalId).toBe("REAPIT-LEAD-99999");
      // target is the [lead_id, crm_kind] column tuple. The mock
      // columns are stub objects so we just verify it's an array.
      expect(Array.isArray(arg.target)).toBe(true);
    });

    it("throws a clear error when the insert returns no row", async () => {
      mockDb.insert = vi.fn(
        () => mockChain([]) as unknown as ReturnType<Db["insert"]>,
      ) as unknown as Db["insert"];
      repo = new LeadExternalRefsRepository(mockDb as Db, FIXTURE_AGENCY);

      await expect(
        repo.upsert({
          leadId: "lead-uuid-1",
          crmKind: "reapit",
          externalId: "X",
        }),
      ).rejects.toThrow("Failed to upsert lead_external_refs");
    });
  });
});
