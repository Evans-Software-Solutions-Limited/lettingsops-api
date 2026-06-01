import { describe, it, expect, vi, beforeEach } from "vitest";
import { AgencyIntegrationsRepository } from "../agencyIntegrationsRepository";
import type { Db } from "@lettingsops/db";

// Chainable Drizzle mock — same pattern as other repo tests in this dir.
function mockChain<T>(result: T) {
  const chain: Record<string, unknown> = {};
  const promise = Promise.resolve(result);
  for (const m of ["values", "set", "from", "where", "limit"]) {
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
  id: "ai-uuid-1",
  agencyId: FIXTURE_AGENCY,
  crmAdapterKind: "noop",
  crmCredentialsSecret: null,
  slotAdapterKind: "mock",
  slotCredentialsSecret: null,
  slotGranularityMinutes: 30,
  createdAt: NOW,
  updatedAt: NOW,
};

describe("AgencyIntegrationsRepository", () => {
  let mockDb: Partial<Db>;
  let repo: AgencyIntegrationsRepository;

  beforeEach(() => {
    mockDb = {
      select: vi.fn(() => mockChain([mockRow])),
      update: vi.fn(() => mockChain([mockRow])),
    } as unknown as Partial<Db>;
    repo = new AgencyIntegrationsRepository(mockDb as Db, FIXTURE_AGENCY);
  });

  describe("findForAgency", () => {
    it("returns the configuration row when one exists for this agency", async () => {
      const row = await repo.findForAgency();
      expect(row).toEqual(mockRow);
      expect(mockDb.select).toHaveBeenCalledTimes(1);
    });

    it("returns null when no row exists (agency created pre-backfill)", async () => {
      mockDb.select = vi.fn(
        () => mockChain([]) as unknown as ReturnType<Db["select"]>,
      ) as unknown as Db["select"];
      repo = new AgencyIntegrationsRepository(mockDb as Db, FIXTURE_AGENCY);

      const row = await repo.findForAgency();
      expect(row).toBeNull();
    });
  });

  describe("update", () => {
    it("returns the updated row", async () => {
      const updated = await repo.update({
        crmAdapterKind: "csv_export",
        crmCredentialsSecret: "LettingsOpsCsvExportCreds",
      });
      expect(updated).toEqual(mockRow);
      expect(mockDb.update).toHaveBeenCalledTimes(1);
    });

    it("accepts partial input and only writes the supplied keys", async () => {
      // The set() call captures the patch object so we can assert
      // the repo doesn't write unrelated fields. `vi.fn()` with no
      // typed impl gives a spy that accepts any args (we only read
      // `.mock.calls`; the return value isn't used).
      const setSpy = vi.fn();
      const updateChain: Record<string, unknown> = {
        set: (patch: unknown) => {
          setSpy(patch);
          return updateChain;
        },
        where: () => updateChain,
        returning: () => Promise.resolve([mockRow]),
      };
      mockDb.update = vi.fn(
        () => updateChain as unknown as ReturnType<Db["update"]>,
      ) as unknown as Db["update"];
      repo = new AgencyIntegrationsRepository(mockDb as Db, FIXTURE_AGENCY);

      await repo.update({ slotGranularityMinutes: 60 });

      const patch = setSpy.mock.calls[0]?.[0] as Record<string, unknown>;
      expect(patch.slotGranularityMinutes).toBe(60);
      // No CRM fields written — partial update preserves what's there.
      expect(patch.crmAdapterKind).toBeUndefined();
      expect(patch.crmCredentialsSecret).toBeUndefined();
      // updatedAt is always bumped so the dashboard "last changed"
      // column stays accurate.
      expect(patch.updatedAt).toBeInstanceOf(Date);
    });

    it("throws when no row was updated (backfill missed this agency)", async () => {
      mockDb.update = vi.fn(
        () => mockChain([]) as unknown as ReturnType<Db["update"]>,
      ) as unknown as Db["update"];
      repo = new AgencyIntegrationsRepository(mockDb as Db, FIXTURE_AGENCY);

      await expect(repo.update({ slotGranularityMinutes: 60 })).rejects.toThrow(
        /no row updated for this agency/,
      );
    });
  });
});
