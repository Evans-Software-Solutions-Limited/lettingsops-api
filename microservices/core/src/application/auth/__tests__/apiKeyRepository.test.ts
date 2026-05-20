import { describe, it, expect, vi, beforeEach } from "vitest";
import { ApiKeyRepository } from "../apiKeyRepository";
import type { Db } from "@lettingsops/db";

// ─── Mock DB helper ───────────────────────────────────────────────────────────

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

const mockApiKeyRow = {
  id: "key-uuid-1",
  agencyId: "agency-uuid-1",
  name: "Reapit integration",
  keyHash: "deadbeef".repeat(8),
  prefix: "lk_abcd1",
  revokedAt: null,
  lastUsedAt: null,
  createdAt: NOW,
};

const revokedRow = { ...mockApiKeyRow, id: "key-uuid-2", revokedAt: NOW };

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("ApiKeyRepository", () => {
  let mockDb: Partial<Db>;
  let repo: ApiKeyRepository;

  beforeEach(() => {
    mockDb = {
      select: vi.fn(() => mockChain([mockApiKeyRow])),
      insert: vi.fn(() => mockChain([mockApiKeyRow])),
      update: vi.fn(() => mockChain(undefined)),
    } as unknown as Partial<Db>;
    repo = new ApiKeyRepository(mockDb as Db);
  });

  // ── create ──────────────────────────────────────────────────────────────────

  describe("create", () => {
    it("returns the inserted row", async () => {
      const row = await repo.create({
        agencyId: "agency-uuid-1",
        name: "Reapit integration",
        keyHash: mockApiKeyRow.keyHash,
        prefix: "lk_abcd1",
      });

      expect(row.id).toBe("key-uuid-1");
      expect(row.name).toBe("Reapit integration");
      expect(row.agencyId).toBe("agency-uuid-1");
      expect(row.revokedAt).toBeNull();
      expect(mockDb.insert).toHaveBeenCalledTimes(1);
    });

    it("throws when the database returns no row", async () => {
      (mockDb.insert as ReturnType<typeof vi.fn>).mockReturnValue(
        mockChain([]),
      );

      await expect(
        repo.create({
          agencyId: "agency-uuid-1",
          name: "Reapit integration",
          keyHash: mockApiKeyRow.keyHash,
          prefix: "lk_abcd1",
        }),
      ).rejects.toThrow(/Failed to create api key/);
    });
  });

  // ── findActive ──────────────────────────────────────────────────────────────

  describe("findActive", () => {
    it("returns the matching row when found", async () => {
      const row = await repo.findActive(mockApiKeyRow.keyHash);
      expect(row).not.toBeNull();
      expect(row?.id).toBe("key-uuid-1");
      expect(row?.revokedAt).toBeNull();
    });

    it("returns null when no row matches", async () => {
      (mockDb.select as ReturnType<typeof vi.fn>).mockReturnValue(
        mockChain([]),
      );

      const row = await repo.findActive("no-such-hash");
      expect(row).toBeNull();
    });

    it("does not return a revoked key — the SQL filters revoked_at IS NULL", async () => {
      // The SQL has `isNull(revokedAt)`, so when the hash matches but the key
      // is revoked, the DB returns no rows. Mock that.
      (mockDb.select as ReturnType<typeof vi.fn>).mockReturnValue(
        mockChain([]),
      );

      const row = await repo.findActive(revokedRow.keyHash);
      expect(row).toBeNull();
    });
  });

  // ── revoke ──────────────────────────────────────────────────────────────────

  describe("revoke", () => {
    it("calls update with the given id", async () => {
      await repo.revoke("key-uuid-1");
      expect(mockDb.update).toHaveBeenCalledTimes(1);
    });
  });

  // ── touch ───────────────────────────────────────────────────────────────────

  describe("touch", () => {
    it("calls update with the given id", async () => {
      await repo.touch("key-uuid-1");
      expect(mockDb.update).toHaveBeenCalledTimes(1);
    });
  });

  // ── listForAgency ───────────────────────────────────────────────────────────

  describe("listForAgency", () => {
    it("returns rows for the given agency", async () => {
      (mockDb.select as ReturnType<typeof vi.fn>).mockReturnValue(
        mockChain([mockApiKeyRow, revokedRow]),
      );

      const rows = await repo.listForAgency("agency-uuid-1");
      expect(rows).toHaveLength(2);
      expect(rows[0]?.id).toBe("key-uuid-1");
      expect(rows[1]?.id).toBe("key-uuid-2");
    });

    it("returns empty when the agency has no keys", async () => {
      (mockDb.select as ReturnType<typeof vi.fn>).mockReturnValue(
        mockChain([]),
      );

      const rows = await repo.listForAgency("agency-uuid-1");
      expect(rows).toEqual([]);
    });

    it("includes both active and revoked keys (listing is admin-facing)", async () => {
      (mockDb.select as ReturnType<typeof vi.fn>).mockReturnValue(
        mockChain([mockApiKeyRow, revokedRow]),
      );

      const rows = await repo.listForAgency("agency-uuid-1");
      const revoked = rows.find((r) => r.revokedAt !== null);
      expect(revoked?.id).toBe("key-uuid-2");
    });
  });
});
