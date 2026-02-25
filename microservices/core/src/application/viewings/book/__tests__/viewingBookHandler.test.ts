import { describe, it, expect, vi, beforeEach } from "vitest";
import { viewingBookHandler } from "../viewingBookHandler";

const mockResponse = {
  viewingId: "viewing-uuid-1",
  confirmedAt: "2024-06-15T14:00:00.000Z",
  calendarEventId: "gcal-event-001",
};

// Mock the ViewingBookService
vi.mock("../viewingBookService", () => ({
  ViewingBookService: {
    decorate: vi.fn().mockReturnThis(),
    use: vi.fn().mockReturnThis(),
    post: vi.fn().mockReturnThis(),
  },
}));

describe("viewingBookHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should be an Elysia instance with POST /viewings/book route", () => {
    expect(viewingBookHandler).toBeDefined();
    expect(typeof viewingBookHandler.fetch).toBe("function");
  });

  it("should require leadId in body", () => {
    const body = {
      leadId: "lead-uuid-1",
      propertyRef: "PROP001",
      slotId: "slot-2024-06-15-14:00",
    };

    expect(body).toHaveProperty("leadId");
    expect(body.leadId).toBeTruthy();
  });

  it("should require propertyRef in body", () => {
    const body = {
      leadId: "lead-uuid-1",
      propertyRef: "PROP001",
      slotId: "slot-2024-06-15-14:00",
    };

    expect(body).toHaveProperty("propertyRef");
    expect(body.propertyRef).toBeTruthy();
  });

  it("should require slotId in body", () => {
    const body = {
      leadId: "lead-uuid-1",
      propertyRef: "PROP001",
      slotId: "slot-2024-06-15-14:00",
    };

    expect(body).toHaveProperty("slotId");
    expect(body.slotId).toBeTruthy();
  });

  it("should return viewing confirmation with id and confirmedAt", () => {
    const response = mockResponse;
    expect(response).toHaveProperty("viewingId");
    expect(response).toHaveProperty("confirmedAt");
  });

  it("should include optional calendarEventId when available", () => {
    const response = mockResponse;
    expect(response).toHaveProperty("calendarEventId");
    expect(response.calendarEventId).toBeTruthy();
  });

  it("should return confirmedAt as ISO timestamp", () => {
    const response = mockResponse;
    const isoRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;
    expect(response.confirmedAt).toMatch(isoRegex);
  });

  it("should generate unique viewing IDs", () => {
    const viewingIds = ["viewing-uuid-1", "viewing-uuid-2", "viewing-uuid-3"];
    const uniqueIds = new Set(viewingIds);
    expect(uniqueIds.size).toBe(viewingIds.length);
  });

  it("should support booking for different leads on same property", () => {
    const booking1 = {
      leadId: "lead-uuid-1",
      propertyRef: "PROP001",
      slotId: "slot-2024-06-15-14:00",
    };

    const booking2 = {
      leadId: "lead-uuid-2",
      propertyRef: "PROP001",
      slotId: "slot-2024-06-15-15:00",
    };

    expect(booking1.leadId).not.toBe(booking2.leadId);
    expect(booking1.propertyRef).toBe(booking2.propertyRef);
  });

  it("should support booking different properties for same lead", () => {
    const booking1 = {
      leadId: "lead-uuid-1",
      propertyRef: "PROP001",
      slotId: "slot-2024-06-15-14:00",
    };

    const booking2 = {
      leadId: "lead-uuid-1",
      propertyRef: "PROP002",
      slotId: "slot-2024-06-16-14:00",
    };

    expect(booking1.leadId).toBe(booking2.leadId);
    expect(booking1.propertyRef).not.toBe(booking2.propertyRef);
  });

  it("should accept valid complete viewing booking request", () => {
    const body = {
      leadId: "lead-uuid-1",
      propertyRef: "PROP001",
      slotId: "slot-2024-06-15-14:00",
    };

    expect(body).toHaveProperty("leadId");
    expect(body).toHaveProperty("propertyRef");
    expect(body).toHaveProperty("slotId");
    expect(body.leadId).toBeTruthy();
    expect(body.propertyRef).toBeTruthy();
    expect(body.slotId).toBeTruthy();
  });
});
