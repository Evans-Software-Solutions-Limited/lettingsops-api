import { describe, it, expect, vi, beforeEach } from "vitest";
import { ViewingExternalRefsRepository } from "../viewingExternalRefsRepository";
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
  viewingId: "viewing-uuid-1",
  crmKind: "reapit",
  externalId: "REAPIT-VIEWING-12345",
  createdAt: NOW,
};

describe("ViewingExternalRefsRepository", () => {
  let mockDb: Partial<Db>;
  let repo: ViewingExternalRefsRepository;

  beforeEach(() => {
    mockDb = {
      select: vi.fn(() => mockChain([mockRow])),
      insert: vi.fn(() => mockChain([mockRow])),
    } as unknown as Partial<Db>;
    repo = new ViewingExternalRefsRepository(mockDb as Db, FIXTURE_AGENCY);
  });

  describe("findByViewingAndKind", () => {
    it("returns the row when one exists", async () => {
      const row = await repo.findByViewingAndKind("viewing-uuid-1", "reapit");
      expect(row?.externalId).toBe("REAPIT-VIEWING-12345");
    });

    it("returns null on miss (first push for this viewing+kind)", async () => {
      mockDb.select = vi.fn(
        () => mockChain([]) as unknown as ReturnType<Db["select"]>,
      ) as unknown as Db["select"];
      repo = new ViewingExternalRefsRepository(mockDb as Db, FIXTURE_AGENCY);

      const row = await repo.findByViewingAndKind("viewing-uuid-1", "reapit");
      expect(row).toBeNull();
    });
  });

  describe("upsert", () => {
    it("inserts a fresh ref and returns the persisted row", async () => {
      const row = await repo.upsert({
        viewingId: "viewing-uuid-1",
        crmKind: "reapit",
        externalId: "REAPIT-VIEWING-12345",
      });
      expect(row.externalId).toBe("REAPIT-VIEWING-12345");
    });

    it("hits onConflictDoUpdate on (viewing_id, crm_kind) AND scopes UPDATE branch by agency_id", async () => {
      // Same dual-guard as the lead-refs test: ON CONFLICT prevents
      // duplicate refs on retry, and `where: agency_id = scope`
      // prevents a cross-tenant viewingId from overwriting another
      // tenant's external_id (PR #45 HIGH finding).
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
      repo = new ViewingExternalRefsRepository(mockDb as Db, FIXTURE_AGENCY);

      await repo.upsert({
        viewingId: "viewing-uuid-1",
        crmKind: "reapit",
        externalId: "REAPIT-VIEWING-99999",
      });

      expect(onConflictSpy).toHaveBeenCalledTimes(1);
      const arg = onConflictSpy.mock.calls[0]?.[0] as {
        target: unknown;
        set: { externalId: string };
        where?: unknown;
      };
      expect(arg.set.externalId).toBe("REAPIT-VIEWING-99999");
      expect(Array.isArray(arg.target)).toBe(true);
      expect(arg.where).toBeDefined();
      const serialised = JSON.stringify(arg.where ?? null);
      expect(serialised).toContain(FIXTURE_AGENCY);
    });

    it("throws when the insert returns no row", async () => {
      mockDb.insert = vi.fn(
        () => mockChain([]) as unknown as ReturnType<Db["insert"]>,
      ) as unknown as Db["insert"];
      repo = new ViewingExternalRefsRepository(mockDb as Db, FIXTURE_AGENCY);

      await expect(
        repo.upsert({
          viewingId: "viewing-uuid-1",
          crmKind: "reapit",
          externalId: "X",
        }),
      ).rejects.toThrow("Failed to upsert viewing_external_refs");
    });

    it("rejects a forged viewingId that doesn't belong to this agency (pre-insert verify)", async () => {
      // Inspector Brad MEDIUM finding, PR #45 3rd sweep — mirror of
      // the lead-refs pre-insert verify. A cross-tenant viewingId
      // would otherwise INSERT successfully and lock the legitimate
      // tenant out of pushing that viewing.
      mockDb.select = vi.fn(
        () => mockChain([]) as unknown as ReturnType<Db["select"]>,
      ) as unknown as Db["select"];
      const insertSpy = vi.fn(
        () => mockChain([mockRow]) as unknown as ReturnType<Db["insert"]>,
      );
      mockDb.insert = insertSpy as unknown as Db["insert"];
      repo = new ViewingExternalRefsRepository(mockDb as Db, FIXTURE_AGENCY);

      await expect(
        repo.upsert({
          viewingId: "viewing-from-other-tenant",
          crmKind: "reapit",
          externalId: "POISON",
        }),
      ).rejects.toThrow(
        /viewing viewing-from-other-tenant does not belong to this agency/,
      );

      expect(insertSpy).not.toHaveBeenCalled();
    });
  });
});
