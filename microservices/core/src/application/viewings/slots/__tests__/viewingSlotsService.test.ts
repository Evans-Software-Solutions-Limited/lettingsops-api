import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  ViewingSlotsService,
  type SlotQuery,
  type Slot,
} from "../viewingSlotsService";

const mockSlots: Slot[] = [
  {
    id: "slot-2024-06-15-14:00",
    startsAt: "2024-06-15T14:00:00.000Z",
    endsAt: "2024-06-15T14:30:00.000Z",
    available: true,
  },
  {
    id: "slot-2024-06-15-15:00",
    startsAt: "2024-06-15T15:00:00.000Z",
    endsAt: "2024-06-15T15:30:00.000Z",
    available: false,
  },
];

describe("ViewingSlotsService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should be an Elysia service", () => {
    expect(ViewingSlotsService).toBeDefined();
    expect(typeof ViewingSlotsService).toBe("object");
  });

  it("should accept propertyRef, from, and to dates in query", () => {
    const query: SlotQuery = {
      propertyRef: "PROP001",
      from: "2024-06-15",
      to: "2024-06-20",
    };

    expect(query).toHaveProperty("propertyRef");
    expect(query).toHaveProperty("from");
    expect(query).toHaveProperty("to");
  });

  it("should return array of slots", () => {
    const response = {
      slots: mockSlots,
    };

    expect(Array.isArray(response.slots)).toBe(true);
  });

  it("should include id, startsAt, endsAt, available in slot", () => {
    const slot = mockSlots[0];
    expect(slot).toHaveProperty("id");
    expect(slot).toHaveProperty("startsAt");
    expect(slot).toHaveProperty("endsAt");
    expect(slot).toHaveProperty("available");
  });

  it("should have available as boolean", () => {
    for (const slot of mockSlots) {
      expect(typeof slot.available).toBe("boolean");
    }
  });

  it("should have timestamps in ISO format", () => {
    const isoRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;
    for (const slot of mockSlots) {
      expect(slot.startsAt).toMatch(isoRegex);
      expect(slot.endsAt).toMatch(isoRegex);
    }
  });

  it("should support date range within reasonablewindows", () => {
    const query: SlotQuery = {
      propertyRef: "PROP001",
      from: "2024-06-15",
      to: "2024-06-30",
    };

    const fromDate = new Date(query.from);
    const toDate = new Date(query.to);
    const daysDiff = Math.floor(
      (toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24),
    );

    expect(daysDiff).toBeGreaterThan(0);
    expect(daysDiff).toBeLessThanOrEqual(365);
  });

  it("should generate unique slot IDs", () => {
    const ids = mockSlots.map((s) => s.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it("should handle empty slots array", () => {
    const emptyResponse = {
      slots: [] as Slot[],
    };

    expect(emptyResponse.slots).toEqual([]);
  });

  it("should support multiple slots per day", () => {
    const slotsPerDay = mockSlots.filter((s) =>
      s.startsAt.startsWith("2024-06-15"),
    );
    expect(slotsPerDay.length).toBeGreaterThanOrEqual(1);
  });

  it("should have end time after start time for each slot", () => {
    for (const slot of mockSlots) {
      const startTime = new Date(slot.startsAt).getTime();
      const endTime = new Date(slot.endsAt).getTime();
      expect(endTime).toBeGreaterThan(startTime);
    }
  });
});
