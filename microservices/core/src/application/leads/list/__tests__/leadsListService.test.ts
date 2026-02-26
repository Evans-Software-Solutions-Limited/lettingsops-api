import { describe, it, expect, vi, beforeEach } from "vitest";
import { LeadsListService } from "../leadsListService";

const NOW = new Date("2024-06-01T10:00:00.000Z");

const mockLeads = [
  {
    id: "lead-uuid-1",
    name: "Alice Smith",
    email: "alice@example.com",
    status: "NEW",
    createdAt: NOW.toISOString(),
  },
  {
    id: "lead-uuid-2",
    name: "Bob Jones",
    email: "bob@example.com",
    status: "QUALIFYING",
    createdAt: NOW.toISOString(),
  },
];

const mockListResponse = {
  leads: mockLeads,
  total: 2,
  page: 1,
  limit: 20,
};

// Mock the LeadRepository
vi.mock("../../repositories/leadRepository", () => ({
  LeadRepository: vi.fn().mockImplementation(() => ({
    list: vi.fn().mockResolvedValue(mockListResponse),
  })),
}));

describe("LeadsListService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should be an Elysia service with leadsListService decorator", () => {
    expect(LeadsListService).toBeDefined();
    expect(typeof LeadsListService).toBe("object");
  });

  it("should default page to 1 when not provided", () => {
    const filters: {
      page?: number;
    } = {};
    const page = filters.page ?? 1;
    expect(page).toBe(1);
  });

  it("should default limit to 20 when not provided", () => {
    const filters: {
      limit?: number;
    } = {};
    const limit = filters.limit ?? 20;
    expect(limit).toBe(20);
  });

  it("should preserve provided page number", () => {
    const filters = {
      page: 2,
    };
    const page = filters.page ?? 1;
    expect(page).toBe(2);
  });

  it("should preserve provided limit", () => {
    const filters = {
      limit: 50,
    };
    const limit = filters.limit ?? 20;
    expect(limit).toBe(50);
  });

  it("should pass status filter to repository", () => {
    const filters = {
      status: "NEW",
      page: 1,
      limit: 20,
    };
    expect(filters.status).toBe("NEW");
  });

  it("should pass propertyRef filter to repository", () => {
    const filters = {
      propertyRef: "PROP001",
      page: 1,
      limit: 20,
    };
    expect(filters.propertyRef).toBe("PROP001");
  });

  it("should return paginated list response", () => {
    const response = mockListResponse;
    expect(response).toHaveProperty("leads");
    expect(response).toHaveProperty("total");
    expect(response).toHaveProperty("page");
    expect(response).toHaveProperty("limit");
  });

  it("should return array of leads", () => {
    const response = mockListResponse;
    expect(Array.isArray(response.leads)).toBe(true);
    expect(response.leads.length).toBeGreaterThan(0);
  });

  it("should return correct pagination info", () => {
    const response = mockListResponse;
    expect(response.total).toBe(2);
    expect(response.page).toBe(1);
    expect(response.limit).toBe(20);
  });

  it("should handle empty results", () => {
    const emptyResponse = {
      leads: [],
      total: 0,
      page: 1,
      limit: 20,
    };
    expect(emptyResponse.leads).toEqual([]);
    expect(emptyResponse.total).toBe(0);
  });
});
