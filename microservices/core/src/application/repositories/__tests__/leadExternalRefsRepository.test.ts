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

    it("passes onConflictDoUpdate targeting (lead_id, crm_kind) AND scoping by agency_id", async () => {
      // Inspector Brad regression guard:
      //  - Without ON CONFLICT every retry duplicates refs (the
      //    unique index would then raise at the DB).
      //  - Without the `where: agency_id = scope` filter, a forged
      //    leadId from tenant A could overwrite tenant B's
      //    external_id on the conflict-update branch (PR #45 HIGH
      //    finding). Both pieces have to be present.
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
        where?: unknown;
      };
      expect(arg.set.externalId).toBe("REAPIT-LEAD-99999");
      // target is the [lead_id, crm_kind] column tuple.
      expect(Array.isArray(arg.target)).toBe(true);
      // The tenant guard. JSON.stringify on a Drizzle SQL fragment
      // serialises its params; the agency UUID must appear so we
      // know the WHERE will reject cross-tenant updates at the DB.
      expect(arg.where).toBeDefined();
      const serialised = JSON.stringify(arg.where ?? null);
      expect(serialised).toContain(FIXTURE_AGENCY);
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

    it("rejects a forged leadId that doesn't belong to this agency (pre-insert verify)", async () => {
      // Inspector Brad MEDIUM finding, PR #45 3rd sweep — the
      // onConflictDoUpdate `where:` guard only protects the UPDATE
      // branch. A first-time INSERT with another tenant's leadId
      // would otherwise succeed and lock the legitimate tenant out
      // of pushing that lead permanently. The pre-insert SELECT
      // against `leads WHERE id=$leadId AND agency_id=scope` rejects
      // the bogus leadId before any write happens.
      //
      // The mock returns [] from select() to simulate "no row owned
      // by this agency matches that leadId" — the realistic
      // attack-path shape.
      mockDb.select = vi.fn(
        () => mockChain([]) as unknown as ReturnType<Db["select"]>,
      ) as unknown as Db["select"];
      const insertSpy = vi.fn(
        () => mockChain([mockRow]) as unknown as ReturnType<Db["insert"]>,
      );
      mockDb.insert = insertSpy as unknown as Db["insert"];
      repo = new LeadExternalRefsRepository(mockDb as Db, FIXTURE_AGENCY);

      await expect(
        repo.upsert({
          leadId: "lead-from-other-tenant",
          crmKind: "reapit",
          externalId: "POISON",
        }),
      ).rejects.toThrow(
        /lead lead-from-other-tenant does not belong to this agency/,
      );

      // Crucial: the INSERT must NEVER fire when the verify rejects.
      // Otherwise the defence-in-depth is one layer thinner.
      expect(insertSpy).not.toHaveBeenCalled();
    });
  });
});
