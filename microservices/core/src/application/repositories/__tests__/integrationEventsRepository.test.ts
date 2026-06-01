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
    it("writes status, attempts, lastError, and bumps updatedAt", async () => {
      const setSpy = vi.fn();
      const chain: Record<string, unknown> = {
        set: (patch: unknown) => {
          setSpy(patch);
          return chain;
        },
        where: () => Promise.resolve(undefined),
      };
      mockDb.update = vi.fn(
        () => chain as unknown as ReturnType<Db["update"]>,
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
      const chain: Record<string, unknown> = {
        set: (patch: unknown) => {
          setSpy(patch);
          return chain;
        },
        where: () => Promise.resolve(undefined),
      };
      mockDb.update = vi.fn(
        () => chain as unknown as ReturnType<Db["update"]>,
      ) as unknown as Db["update"];
      repo = new IntegrationEventsRepository(mockDb as Db, FIXTURE_AGENCY);

      await repo.updateStatus("ev-uuid-1", {
        status: "succeeded",
        attempts: 1,
      });

      const patch = setSpy.mock.calls[0]?.[0] as Record<string, unknown>;
      expect(patch.lastError).toBeNull();
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

    it("returns the rows from the query", async () => {
      const rows = await repo.listForAgency();
      expect(rows).toEqual([mockRow]);
    });
  });
});
