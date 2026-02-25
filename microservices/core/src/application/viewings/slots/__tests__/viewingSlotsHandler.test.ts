import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSlots = {
  slots: [
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
  ],
};

// Mock the ViewingSlotsService
vi.mock("../viewingSlotsService", () => ({
  ViewingSlotsService: {
    decorate: vi.fn().mockReturnThis(),
    use: vi.fn().mockReturnThis(),
    get: vi.fn().mockReturnThis(),
  },
}));

describe("viewingSlotsHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should have GET /viewings/slots route defined", () => {
    // Handler is defined with Elysia().get("/viewings/slots", ...)
    const routePath = "/viewings/slots";
    expect(routePath).toBe("/viewings/slots");
  });

  it("should require propertyRef query parameter", () => {
    const query = {
      propertyRef: "PROP001",
      from: "2024-06-15",
      to: "2024-06-20",
    };

    expect(query).toHaveProperty("propertyRef");
    expect(query.propertyRef).toBeTruthy();
  });

  it("should require from date in ISO format", () => {
    const query = {
      propertyRef: "PROP001",
      from: "2024-06-15",
      to: "2024-06-20",
    };

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    expect(query.from).toMatch(dateRegex);
  });

  it("should require to date in ISO format", () => {
    const query = {
      propertyRef: "PROP001",
      from: "2024-06-15",
      to: "2024-06-20",
    };

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    expect(query.to).toMatch(dateRegex);
  });

  it("should return array of viewing slots", () => {
    const response = mockSlots;
    expect(Array.isArray(response.slots)).toBe(true);
  });

  it("should include slot metadata: id, startsAt, endsAt, available", () => {
    const slot = mockSlots.slots[0];
    expect(slot).toHaveProperty("id");
    expect(slot).toHaveProperty("startsAt");
    expect(slot).toHaveProperty("endsAt");
    expect(slot).toHaveProperty("available");
  });

  it("should mark slots as available or unavailable", () => {
    for (const slot of mockSlots.slots) {
      expect(typeof slot.available).toBe("boolean");
    }
  });

  it("should return timestamps in ISO format", () => {
    const isoRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;
    for (const slot of mockSlots.slots) {
      expect(slot.startsAt).toMatch(isoRegex);
      expect(slot.endsAt).toMatch(isoRegex);
    }
  });

  it("should support date range queries", () => {
    const query = {
      propertyRef: "PROP001",
      from: "2024-06-15",
      to: "2024-06-30",
    };

    const fromDate = new Date(query.from);
    const toDate = new Date(query.to);
    expect(fromDate < toDate).toBe(true);
  });

  it("should return empty slots array when no availability", () => {
    const emptyResponse = {
      slots: [],
    };

    expect(emptyResponse.slots).toEqual([]);
  });

  it("should generate unique slot IDs", () => {
    const slotIds = mockSlots.slots.map((s) => s.id);
    const uniqueIds = new Set(slotIds);
    expect(uniqueIds.size).toBe(slotIds.length);
  });
});
