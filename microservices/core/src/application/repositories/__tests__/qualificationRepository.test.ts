import { describe, it, expect, vi, beforeEach } from "vitest";
import { QualificationRepository } from "../qualificationRepository";
import type { Db } from "@lettingsops/db";

// ─── Mock DB helper ───────────────────────────────────────────────────────────

function mockChain<T>(result: T) {
  const chain: Record<string, unknown> = {};
  const promise = Promise.resolve(result);

  for (const method of ["values", "set", "from", "where", "limit", "offset", "orderBy"]) {
    chain[method] = () => chain;
  }

  chain["returning"] = () => promise;
  chain["then"] = (resolve: Parameters<Promise<T>["then"]>[0], reject?: Parameters<Promise<T>["then"]>[1]) =>
    promise.then(resolve, reject);
  chain["catch"] = (reject: Parameters<Promise<T>["catch"]>[0]) => promise.catch(reject);

  return chain;
}

const NOW = new Date("2024-06-01T10:00:00.000Z");

const mockAnswers = {
  moveInDate: "2024-07-01",
  occupants: 2,
  employmentStatus: "employed" as const,
  incomeBand: "30k_50k" as const,
  hasPets: false,
  viewingAvailability: ["Saturday morning", "Sunday afternoon"],
};

const mockQualRow = {
  id: "qual-uuid-1",
  leadId: "lead-uuid-1",
  answers: mockAnswers,
  score: 7,
  category: "STRONG" as const,
  createdAt: NOW,
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("QualificationRepository", () => {
  let mockDb: Partial<Db>;
  let repo: QualificationRepository;

  beforeEach(() => {
    mockDb = {
      insert: vi.fn(() => mockChain([mockQualRow])),
      select: vi.fn(() => mockChain([mockQualRow])),
    } as unknown as Partial<Db>;
    repo = new QualificationRepository(mockDb as Db);
  });

  describe("create", () => {
    it("inserts and returns a mapped Qualification", async () => {
      const qual = await repo.create({
        leadId: "lead-uuid-1",
        answers: mockAnswers,
        score: 7,
        category: "STRONG",
      });

      expect(mockDb.insert).toHaveBeenCalledOnce();
      expect(qual).toMatchObject({
        id: "qual-uuid-1",
        leadId: "lead-uuid-1",
        score: 7,
        category: "STRONG",
      });
      expect(qual.answers.moveInDate).toBe("2024-07-01");
      expect(qual.createdAt).toBe(NOW.toISOString());
    });

    it("throws if no row is returned", async () => {
      (mockDb.insert as ReturnType<typeof vi.fn>).mockReturnValue(mockChain([]));
      await expect(
        repo.create({ leadId: "x", answers: mockAnswers, score: 0, category: "LOW" }),
      ).rejects.toThrow("Failed to create qualification");
    });
  });

  describe("findByLeadId", () => {
    it("returns a mapped Qualification when found", async () => {
      const qual = await repo.findByLeadId("lead-uuid-1");
      expect(qual).not.toBeNull();
      expect(qual?.leadId).toBe("lead-uuid-1");
    });

    it("returns null when not found", async () => {
      (mockDb.select as ReturnType<typeof vi.fn>).mockReturnValue(mockChain([]));
      const qual = await repo.findByLeadId("no-lead");
      expect(qual).toBeNull();
    });
  });
});
