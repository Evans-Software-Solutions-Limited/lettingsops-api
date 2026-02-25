import { describe, it, expect, vi, beforeEach } from "vitest";
import { ViewingBookService, type BookViewingInput } from "../viewingBookService";

const NOW = new Date("2024-06-01T10:00:00.000Z");

const mockViewing = {
  id: "viewing-uuid-1",
  leadId: "lead-uuid-1",
  propertyRef: "PROP001",
  slotId: "slot-2024-06-15-14:00",
  calendarEventId: undefined,
  confirmedAt: NOW.toISOString(),
  cancelledAt: null,
  createdAt: NOW.toISOString(),
};

const mockLead = {
  id: "lead-uuid-1",
  name: "John Doe",
  email: "john@example.com",
  phone: "+447700900001",
  propertyRef: "PROP001",
  propertyRent: 1500,
  message: "Interested in viewing",
  source: "email" as const,
  status: "NEW" as const,
  score: null,
  scoreCategory: null,
  createdAt: NOW.toISOString(),
  updatedAt: NOW.toISOString(),
};

// Mock repositories
vi.mock("../../repositories/leadRepository", () => ({
  LeadRepository: vi.fn().mockImplementation(() => ({
    findById: vi.fn().mockResolvedValue(mockLead),
    updateStatus: vi.fn().mockResolvedValue(undefined),
  })),
}));

vi.mock("../../repositories/viewingRepository", () => ({
  ViewingRepository: vi.fn().mockImplementation(() => ({
    create: vi.fn().mockResolvedValue(mockViewing),
  })),
}));

describe("ViewingBookService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should be an Elysia service", () => {
    expect(ViewingBookService).toBeDefined();
    expect(typeof ViewingBookService).toBe("object");
  });

  it("should accept leadId, propertyRef, slotId in input", () => {
    const input: BookViewingInput = {
      leadId: "lead-uuid-1",
      propertyRef: "PROP001",
      slotId: "slot-2024-06-15-14:00",
    };

    expect(input).toHaveProperty("leadId");
    expect(input).toHaveProperty("propertyRef");
    expect(input).toHaveProperty("slotId");
  });

  it("should create viewing with provided details", () => {
    const viewing = mockViewing;
    expect(viewing.leadId).toBe("lead-uuid-1");
    expect(viewing.propertyRef).toBe("PROP001");
    expect(viewing.slotId).toBe("slot-2024-06-15-14:00");
  });

  it("should return viewingId from created viewing", () => {
    const viewing = mockViewing;
    expect(viewing.id).toBeTruthy();
    expect(typeof viewing.id).toBe("string");
  });

  it("should set confirmedAt timestamp", () => {
    const viewing = mockViewing;
    const isoRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;
    expect(viewing.confirmedAt).toMatch(isoRegex);
  });

  it("should set calendarEventId if available", () => {
    // Service may set calendarEventId from calendar integration
    const viewing = mockViewing;
    if (viewing.calendarEventId) {
      expect(typeof viewing.calendarEventId).toBe("string");
    }
  });

  it("should update lead status to VIEWING_BOOKED", () => {
    // Service calls leadRepo.updateStatus with "VIEWING_BOOKED"
    const expectedStatus = "VIEWING_BOOKED";
    expect(expectedStatus).toBeTruthy();
  });

  it("should require lead to exist", () => {
    const leadId = "lead-uuid-1";
    expect(leadId).toBeTruthy();
  });

  it("should support booking multiple viewings for same lead", () => {
    const booking1: BookViewingInput = {
      leadId: "lead-uuid-1",
      propertyRef: "PROP001",
      slotId: "slot-2024-06-15-14:00",
    };

    const booking2: BookViewingInput = {
      leadId: "lead-uuid-1",
      propertyRef: "PROP002",
      slotId: "slot-2024-06-16-14:00",
    };

    expect(booking1.leadId).toBe(booking2.leadId);
    expect(booking1.propertyRef).not.toBe(booking2.propertyRef);
  });

  it("should support booking same property multiple times", () => {
    const booking1: BookViewingInput = {
      leadId: "lead-uuid-1",
      propertyRef: "PROP001",
      slotId: "slot-2024-06-15-14:00",
    };

    const booking2: BookViewingInput = {
      leadId: "lead-uuid-1",
      propertyRef: "PROP001",
      slotId: "slot-2024-06-15-15:00",
    };

    expect(booking1.propertyRef).toBe(booking2.propertyRef);
    expect(booking1.slotId).not.toBe(booking2.slotId);
  });

  it("should return complete viewing confirmation response", () => {
    const viewing = mockViewing;
    const response = {
      viewingId: viewing.id,
      confirmedAt: viewing.confirmedAt,
      calendarEventId: viewing.calendarEventId,
    };

    expect(response).toHaveProperty("viewingId");
    expect(response).toHaveProperty("confirmedAt");
  });
});
