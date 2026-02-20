import { describe, it, expect, vi, beforeEach } from "vitest";
import { ViewingRepository } from "../viewingRepository";
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

const NOW = new Date("2024-06-01T14:00:00.000Z");

const mockViewingRow = {
  id: "viewing-uuid-1",
  leadId: "lead-uuid-1",
  propertyRef: "PROP001",
  slotId: "slot-2024-06-15-14:00",
  calendarEventId: "gcal-event-001",
  confirmedAt: NOW,
  cancelledAt: null,
  createdAt: NOW,
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("ViewingRepository", () => {
  let mockDb: Partial<Db>;
  let repo: ViewingRepository;

  beforeEach(() => {
    mockDb = {
      insert: vi.fn(() => mockChain([mockViewingRow])),
      select: vi.fn(() => mockChain([mockViewingRow])),
      update: vi.fn(() => mockChain([])),
    } as unknown as Partial<Db>;
    repo = new ViewingRepository(mockDb as Db);
  });

  describe("create", () => {
    it("inserts and returns a mapped Viewing", async () => {
      const viewing = await repo.create({
        leadId: "lead-uuid-1",
        propertyRef: "PROP001",
        slotId: "slot-2024-06-15-14:00",
        calendarEventId: "gcal-event-001",
        confirmedAt: NOW.toISOString(),
      });

      expect(mockDb.insert).toHaveBeenCalledOnce();
      expect(viewing).toMatchObject({
        id: "viewing-uuid-1",
        leadId: "lead-uuid-1",
        propertyRef: "PROP001",
        slotId: "slot-2024-06-15-14:00",
        calendarEventId: "gcal-event-001",
      });
      expect(viewing.confirmedAt).toBe(NOW.toISOString());
      expect(viewing.cancelledAt).toBeUndefined();
    });

    it("throws if no row is returned", async () => {
      (mockDb.insert as ReturnType<typeof vi.fn>).mockReturnValue(mockChain([]));
      await expect(
        repo.create({
          leadId: "x",
          propertyRef: "PROP001",
          slotId: "slot-1",
          confirmedAt: NOW.toISOString(),
        }),
      ).rejects.toThrow("Failed to create viewing");
    });
  });

  describe("findById", () => {
    it("returns a mapped Viewing when found", async () => {
      const viewing = await repo.findById("viewing-uuid-1");
      expect(viewing).not.toBeNull();
      expect(viewing?.id).toBe("viewing-uuid-1");
    });

    it("returns null when not found", async () => {
      (mockDb.select as ReturnType<typeof vi.fn>).mockReturnValue(mockChain([]));
      const viewing = await repo.findById("nope");
      expect(viewing).toBeNull();
    });
  });

  describe("findByLeadId", () => {
    it("returns all viewings for a lead", async () => {
      const viewings = await repo.findByLeadId("lead-uuid-1");
      expect(viewings).toHaveLength(1);
      expect(viewings[0]?.leadId).toBe("lead-uuid-1");
    });

    it("returns empty array when no viewings", async () => {
      (mockDb.select as ReturnType<typeof vi.fn>).mockReturnValue(mockChain([]));
      const viewings = await repo.findByLeadId("no-viewings");
      expect(viewings).toHaveLength(0);
    });
  });

  describe("cancel", () => {
    it("calls update with a cancelledAt timestamp", async () => {
      await repo.cancel("viewing-uuid-1");
      expect(mockDb.update).toHaveBeenCalledOnce();
    });
  });
});
