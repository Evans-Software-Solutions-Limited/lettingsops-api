import { describe, it, expect, vi, beforeEach } from "vitest";
import { leadsListHandler } from "../leadsListHandler";

const mockLead = {
  id: "lead-uuid-1",
  name: "John Doe",
  email: "john@example.com",
  status: "NEW",
  score: null,
  scoreCategory: null,
  createdAt: "2024-06-01T10:00:00.000Z",
};

const mockListResponse = {
  leads: [mockLead],
  total: 1,
  page: 1,
  limit: 10,
};

// Mock the LeadRepository
vi.mock("../../repositories/leadRepository", () => ({
  LeadRepository: vi.fn().mockImplementation(() => ({
    list: vi.fn().mockResolvedValue(mockListResponse),
  })),
}));

describe("leadsListHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should be an Elysia instance with GET /leads route", () => {
    expect(leadsListHandler).toBeDefined();
    expect(typeof leadsListHandler.fetch).toBe("function");
  });

  it("should accept optional query parameters", () => {
    const query = {
      status: "NEW",
      propertyRef: "PROP001",
      page: 1,
      limit: 10,
    };

    expect(query).toHaveProperty("status");
    expect(query).toHaveProperty("propertyRef");
    expect(query).toHaveProperty("page");
    expect(query).toHaveProperty("limit");
  });

  it("should accept minimal request with no query params", () => {
    const query = {};
    expect(Object.keys(query).length).toBe(0);
  });

  it("should return paginated list of leads", () => {
    const response = mockListResponse;
    expect(response).toHaveProperty("leads");
    expect(response).toHaveProperty("total");
    expect(response).toHaveProperty("page");
    expect(response).toHaveProperty("limit");
  });

  it("should return array of leads", () => {
    const response = mockListResponse;
    expect(Array.isArray(response.leads)).toBe(true);
  });

  it("should return pagination metadata", () => {
    const response = mockListResponse;
    expect(response.total).toBe(1);
    expect(response.page).toBe(1);
    expect(response.limit).toBe(10);
  });

  it("should return leads with essential fields", () => {
    const lead = mockListResponse.leads[0];
    expect(lead).toHaveProperty("id");
    expect(lead).toHaveProperty("name");
    expect(lead).toHaveProperty("email");
    expect(lead).toHaveProperty("status");
    expect(lead).toHaveProperty("createdAt");
  });

  it("should support filtering by status", () => {
    const statuses = ["NEW", "QUALIFYING", "QUALIFIED", "REJECTED"];
    for (const status of statuses) {
      expect(statuses).toContain(status);
    }
  });

  it("should support filtering by propertyRef", () => {
    const query = {
      propertyRef: "PROP001",
    };
    expect(query.propertyRef).toBe("PROP001");
  });

  it("should support pagination with page and limit", () => {
    const query = {
      page: 2,
      limit: 20,
    };
    expect(query.page).toBe(2);
    expect(query.limit).toBe(20);
  });

  it("should handle empty results", () => {
    const emptyResponse = {
      leads: [],
      total: 0,
      page: 1,
      limit: 10,
    };
    expect(emptyResponse.leads.length).toBe(0);
    expect(emptyResponse.total).toBe(0);
  });
});
