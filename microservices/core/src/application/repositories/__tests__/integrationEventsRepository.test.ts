import { describe, it, expect, vi, beforeEach } from "vitest";
import { IntegrationEventsRepository } from "../integrationEventsRepository";
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
    "offset",
    "orderBy",
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
  id: "ev-uuid-1",
  agencyId: FIXTURE_AGENCY,
  call: "crm.pushLead",
  refId: "lead-uuid-1",
  status: "pending",
  attempts: 0,
  lastError: null,
  createdAt: NOW,
  updatedAt: NOW,
};

describe("IntegrationEventsRepository", () => {
  let mockDb: Partial<Db>;
  let repo: IntegrationEventsRepository;

  beforeEach(() => {
    mockDb = {
      select: vi.fn(() => mockChain([mockRow])),
      insert: vi.fn(() => mockChain([mockRow])),
      update: vi.fn(() => mockChain(undefined)),
    } as unknown as Partial<Db>;
    repo = new IntegrationEventsRepository(mockDb as Db, FIXTURE_AGENCY);
  });

  describe("create", () => {
    it("inserts a new event and returns it", async () => {
      const row = await repo.create({
        call: "crm.pushLead",
        refId: "lead-uuid-1",
        status: "pending",
      });
      expect(row).toEqual(mockRow);
      expect(mockDb.insert).toHaveBeenCalledTimes(1);
    });

    it("starts attempts at 0 even if a future caller forgets to pass it", async () => {
      const valuesSpy = vi.fn();
      const chain: Record<string, unknown> = {
        values: (record: unknown) => {
          valuesSpy(record);
          return chain;
        },
        returning: () => Promise.resolve([mockRow]),
      };
      mockDb.insert = vi.fn(
        () => chain as unknown as ReturnType<Db["insert"]>,
      ) as unknown as Db["insert"];
      repo = new IntegrationEventsRepository(mockDb as Db, FIXTURE_AGENCY);

      await repo.create({ call: "crm.pushLead", status: "pending" });

      const record = valuesSpy.mock.calls[0]?.[0] as { attempts: number };
      expect(record.attempts).toBe(0);
    });

    it("throws a clear error when the insert returns no row", async () => {
      mockDb.insert = vi.fn(
        () => mockChain([]) as unknown as ReturnType<Db["insert"]>,
      ) as unknown as Db["insert"];
      repo = new IntegrationEventsRepository(mockDb as Db, FIXTURE_AGENCY);

      await expect(
        repo.create({ call: "crm.pushLead", status: "pending" }),
      ).rejects.toThrow("Failed to create integration_event");
    });
  });

  describe("updateStatus", () => {
    /** Build an update chain that captures `.set()` and returns one row from `.returning()` (matches a successful update). */
    function makeUpdateChain(setSpy: ReturnType<typeof vi.fn>) {
      const chain: Record<string, unknown> = {
        set: (patch: unknown) => {
          setSpy(patch);
          return chain;
        },
        where: () => chain,
        returning: () => Promise.resolve([{ id: "ev-uuid-1" }]),
      };
      return chain;
    }

    it("writes status, attempts, lastError, and bumps updatedAt", async () => {
      const setSpy = vi.fn();
      mockDb.update = vi.fn(
        () => makeUpdateChain(setSpy) as unknown as ReturnType<Db["update"]>,
      ) as unknown as Db["update"];
      repo = new IntegrationEventsRepository(mockDb as Db, FIXTURE_AGENCY);

      await repo.updateStatus("ev-uuid-1", {
        status: "retrying",
        attempts: 2,
        lastError: "CRM 502",
      });

      const patch = setSpy.mock.calls[0]?.[0] as Record<string, unknown>;
      expect(patch.status).toBe("retrying");
      expect(patch.attempts).toBe(2);
      expect(patch.lastError).toBe("CRM 502");
      expect(patch.updatedAt).toBeInstanceOf(Date);
    });

    it("normalises undefined lastError to null (DB column is nullable text)", async () => {
      // Distinct from passing null directly — the helper signature
      // allows omitting lastError, and the repo must coerce so the
      // SET clause has a stable shape.
      const setSpy = vi.fn();
      mockDb.update = vi.fn(
        () => makeUpdateChain(setSpy) as unknown as ReturnType<Db["update"]>,
      ) as unknown as Db["update"];
      repo = new IntegrationEventsRepository(mockDb as Db, FIXTURE_AGENCY);

      await repo.updateStatus("ev-uuid-1", {
        status: "succeeded",
        attempts: 1,
      });

      const patch = setSpy.mock.calls[0]?.[0] as Record<string, unknown>;
      expect(patch.lastError).toBeNull();
    });

    it("throws when the eventId doesn't match any row (unknown / wrong-tenant / deleted)", async () => {
      // Inspector Brad MEDIUM finding, PR #45 — the previous version
      // silently no-op'd, leaving the retry helper convinced the
      // status had been persisted while the dashboard still showed
      // the event stuck at `pending`. Empty `.returning()` is the
      // signal; the throw makes the failure loud.
      const chain: Record<string, unknown> = {
        set: () => chain,
        where: () => chain,
        returning: () => Promise.resolve([]),
      };
      mockDb.update = vi.fn(
        () => chain as unknown as ReturnType<Db["update"]>,
      ) as unknown as Db["update"];
      repo = new IntegrationEventsRepository(mockDb as Db, FIXTURE_AGENCY);

      await expect(
        repo.updateStatus("ev-missing", {
          status: "succeeded",
          attempts: 1,
        }),
      ).rejects.toThrow(/no event matched id=ev-missing/);
    });
  });

  describe("listForAgency", () => {
    it("orders by createdAt desc and applies a default limit", async () => {
      const limitSpy = vi.fn();
      const chain: Record<string, unknown> = {
        from: () => chain,
        where: () => chain,
        orderBy: () => chain,
        limit: (n: unknown) => {
          limitSpy(n);
          return Promise.resolve([mockRow]);
        },
      };
      mockDb.select = vi.fn(
        () => chain as unknown as ReturnType<Db["select"]>,
      ) as unknown as Db["select"];
      repo = new IntegrationEventsRepository(mockDb as Db, FIXTURE_AGENCY);

      await repo.listForAgency();

      expect(limitSpy).toHaveBeenCalledWith(50); // DEFAULT_LIMIT
    });

    it("caps a caller-supplied limit at 500 (protects the dashboard)", async () => {
      const limitSpy = vi.fn();
      const chain: Record<string, unknown> = {
        from: () => chain,
        where: () => chain,
        orderBy: () => chain,
        limit: (n: unknown) => {
          limitSpy(n);
          return Promise.resolve([mockRow]);
        },
      };
      mockDb.select = vi.fn(
        () => chain as unknown as ReturnType<Db["select"]>,
      ) as unknown as Db["select"];
      repo = new IntegrationEventsRepository(mockDb as Db, FIXTURE_AGENCY);

      await repo.listForAgency({ limit: 9999 });

      expect(limitSpy).toHaveBeenCalledWith(500); // MAX_LIMIT
    });

    it("honours a caller-supplied limit under the cap", async () => {
      const limitSpy = vi.fn();
      const chain: Record<string, unknown> = {
        from: () => chain,
        where: () => chain,
        orderBy: () => chain,
        limit: (n: unknown) => {
          limitSpy(n);
          return Promise.resolve([mockRow]);
        },
      };
      mockDb.select = vi.fn(
        () => chain as unknown as ReturnType<Db["select"]>,
      ) as unknown as Db["select"];
      repo = new IntegrationEventsRepository(mockDb as Db, FIXTURE_AGENCY);

      await repo.listForAgency({ limit: 10 });
      expect(limitSpy).toHaveBeenCalledWith(10);
    });

    it("clamps limit: 0 up to 1 (avoids the silently-empty response footgun)", async () => {
      // Inspector Brad LOW finding, PR #45 — the upper cap was in
      // place but the lower wasn't, so a caller asking for `0`
      // (often meaning "default" in some clients) got `[]` and was
      // confused. Now `0` becomes the minimum-useful `1`.
      const limitSpy = vi.fn();
      const chain: Record<string, unknown> = {
        from: () => chain,
        where: () => chain,
        orderBy: () => chain,
        limit: (n: unknown) => {
          limitSpy(n);
          return Promise.resolve([mockRow]);
        },
      };
      mockDb.select = vi.fn(
        () => chain as unknown as ReturnType<Db["select"]>,
      ) as unknown as Db["select"];
      repo = new IntegrationEventsRepository(mockDb as Db, FIXTURE_AGENCY);

      await repo.listForAgency({ limit: 0 });
      expect(limitSpy).toHaveBeenCalledWith(1);
    });

    it("clamps a negative limit up to 1 (avoids Postgres `LIMIT must not be negative` error)", async () => {
      // Defensive against a malformed query string that parses to a
      // negative integer. Without this clamp the Postgres error
      // would bubble up to a 500 on the dashboard — the same class
      // of failure the upper cap was added to prevent.
      const limitSpy = vi.fn();
      const chain: Record<string, unknown> = {
        from: () => chain,
        where: () => chain,
        orderBy: () => chain,
        limit: (n: unknown) => {
          limitSpy(n);
          return Promise.resolve([mockRow]);
        },
      };
      mockDb.select = vi.fn(
        () => chain as unknown as ReturnType<Db["select"]>,
      ) as unknown as Db["select"];
      repo = new IntegrationEventsRepository(mockDb as Db, FIXTURE_AGENCY);

      await repo.listForAgency({ limit: -5 });
      expect(limitSpy).toHaveBeenCalledWith(1);
    });

    it("falls back to DEFAULT_LIMIT on NaN (e.g. ?limit=abc parsed via Number())", async () => {
      // Inspector Brad LOW finding, PR #45 3rd sweep — `NaN ??
      // DEFAULT` is NaN (nullish-coalescing doesn't catch it), so
      // both Math.max(NaN, 1) and Math.min(NaN, 500) yield NaN, and
      // `.limit(NaN)` errors at Postgres with "invalid input syntax
      // for type bigint: NaN". The Number.isFinite gate falls back
      // to DEFAULT_LIMIT — same shape as the no-input path.
      const limitSpy = vi.fn();
      const chain: Record<string, unknown> = {
        from: () => chain,
        where: () => chain,
        orderBy: () => chain,
        limit: (n: unknown) => {
          limitSpy(n);
          return Promise.resolve([mockRow]);
        },
      };
      mockDb.select = vi.fn(
        () => chain as unknown as ReturnType<Db["select"]>,
      ) as unknown as Db["select"];
      repo = new IntegrationEventsRepository(mockDb as Db, FIXTURE_AGENCY);

      await repo.listForAgency({ limit: NaN });
      expect(limitSpy).toHaveBeenCalledWith(50); // DEFAULT_LIMIT
    });

    it("falls back to DEFAULT_LIMIT on Infinity (defensive against malformed parsers)", async () => {
      // Number.isFinite is false for Infinity too — same DEFAULT
      // fallback as NaN. Previously this would have clamped to
      // MAX_LIMIT (500), which is technically OK but DEFAULT is a
      // saner outcome for "the value wasn't a real number".
      const limitSpy = vi.fn();
      const chain: Record<string, unknown> = {
        from: () => chain,
        where: () => chain,
        orderBy: () => chain,
        limit: (n: unknown) => {
          limitSpy(n);
          return Promise.resolve([mockRow]);
        },
      };
      mockDb.select = vi.fn(
        () => chain as unknown as ReturnType<Db["select"]>,
      ) as unknown as Db["select"];
      repo = new IntegrationEventsRepository(mockDb as Db, FIXTURE_AGENCY);

      await repo.listForAgency({ limit: Infinity });
      expect(limitSpy).toHaveBeenCalledWith(50);
    });

    it("returns the rows from the query", async () => {
      const rows = await repo.listForAgency();
      expect(rows).toEqual([mockRow]);
    });
  });
});
