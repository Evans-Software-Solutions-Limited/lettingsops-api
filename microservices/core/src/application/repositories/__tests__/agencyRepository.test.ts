import { describe, it, expect, vi, beforeEach } from "vitest";
import { AgencyRepository } from "../agencyRepository";
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

const mockAgencyRow = {
  id: "agency-uuid-1",
  name: "Premier Lettings",
  inboundEmail: "hello@premierlets.com",
  createdAt: NOW,
  updatedAt: NOW,
};

const mockRequiredFields = [
  {
    id: "field-uuid-1",
    agencyId: "agency-uuid-1",
    fieldKey: "name",
    fieldLabel: "Full Name",
    sortOrder: 0,
    createdAt: NOW,
  },
  {
    id: "field-uuid-2",
    agencyId: "agency-uuid-1",
    fieldKey: "email",
    fieldLabel: "Email Address",
    sortOrder: 1,
    createdAt: NOW,
  },
];

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("AgencyRepository", () => {
  let mockDb: Partial<Db>;
  let repo: AgencyRepository;

  beforeEach(() => {
    mockDb = {
      select: vi.fn(() => mockChain([mockAgencyRow])),
    } as unknown as Partial<Db>;
    repo = new AgencyRepository(mockDb as Db);
  });

  // ── findById ────────────────────────────────────────────────────────────────

  describe("findById", () => {
    it("returns an agency when found", async () => {
      const agency = await repo.findById("agency-uuid-1");
      expect(agency).not.toBeNull();
      expect(agency?.id).toBe("agency-uuid-1");
      expect(agency?.name).toBe("Premier Lettings");
    });

    it("returns null when not found", async () => {
      (mockDb.select as ReturnType<typeof vi.fn>).mockReturnValue(
        mockChain([]),
      );
      const agency = await repo.findById("nonexistent");
      expect(agency).toBeNull();
    });

    it("returns agency with inbound email", async () => {
      const agency = await repo.findById("agency-uuid-1");
      expect(agency?.inboundEmail).toBe("hello@premierlets.com");
    });

    it("returns agency with timestamps", async () => {
      const agency = await repo.findById("agency-uuid-1");
      expect(agency?.createdAt).toBeDefined();
      expect(agency?.updatedAt).toBeDefined();
    });
  });

  // ── getRequiredFields ───────────────────────────────────────────────────────

  describe("getRequiredFields", () => {
    it("returns required fields for an agency", async () => {
      (mockDb.select as ReturnType<typeof vi.fn>).mockReturnValue(
        mockChain(mockRequiredFields),
      );

      const fields = await repo.getRequiredFields("agency-uuid-1");
      expect(fields).toHaveLength(2);
      expect(fields[0]?.fieldKey).toBe("name");
      expect(fields[1]?.fieldKey).toBe("email");
    });

    it("returns fields in sort order", async () => {
      (mockDb.select as ReturnType<typeof vi.fn>).mockReturnValue(
        mockChain(mockRequiredFields),
      );

      const fields = await repo.getRequiredFields("agency-uuid-1");
      expect(fields[0]?.sortOrder).toBe(0);
      expect(fields[1]?.sortOrder).toBe(1);
    });

    it("returns empty array when no fields defined", async () => {
      (mockDb.select as ReturnType<typeof vi.fn>).mockReturnValue(
        mockChain([]),
      );

      const fields = await repo.getRequiredFields("agency-uuid-1");
      expect(fields).toEqual([]);
    });

    it("includes field labels and keys", async () => {
      (mockDb.select as ReturnType<typeof vi.fn>).mockReturnValue(
        mockChain(mockRequiredFields),
      );

      const fields = await repo.getRequiredFields("agency-uuid-1");
      expect(fields[0]?.fieldLabel).toBe("Full Name");
      expect(fields[1]?.fieldLabel).toBe("Email Address");
    });

    it("filters fields by agencyId", async () => {
      const fields = mockRequiredFields.filter(
        (f) => f.agencyId === "agency-uuid-1",
      );
      expect(fields).toHaveLength(2);
    });
  });
});
