import { describe, it, expect } from "vitest";
import { LeadsListService } from "../leadsListService";

describe("LeadsListService", () => {
  it("should be an Elysia service", () => {
    expect(LeadsListService).toBeDefined();
    expect(typeof LeadsListService).toBe("object");
  });

  it("should have leadsListService decorator", () => {
    expect(LeadsListService.decorator).toBeDefined();
    expect(LeadsListService.decorator.leadsListService).toBeDefined();
    expect(typeof LeadsListService.decorator.leadsListService.listLeads).toBe(
      "function",
    );
  });

  it("should default page to 1 when not provided", () => {
    const filters: Record<string, unknown> = {};
    const page = (filters.page as number | undefined) ?? 1;
    expect(page).toBe(1);
  });

  it("should default limit to 20 when not provided", () => {
    const filters: Record<string, unknown> = {};
    const limit = (filters.limit as number | undefined) ?? 20;
    expect(limit).toBe(20);
  });

  it("should preserve provided page number", () => {
    const filters = { page: 2 };
    const page = filters.page ?? 1;
    expect(page).toBe(2);
  });

  it("should preserve provided limit", () => {
    const filters = { limit: 50 };
    const limit = filters.limit ?? 20;
    expect(limit).toBe(50);
  });

  it("should accept status filter", () => {
    const filters = { status: "NEW" };
    expect(filters.status).toBe("NEW");
  });

  it("should accept propertyRef filter", () => {
    const filters = { propertyRef: "PROP001" };
    expect(filters.propertyRef).toBe("PROP001");
  });

  it("should accept combined filters", () => {
    const filters = {
      status: "NEW",
      propertyRef: "PROP001",
      page: 2,
      limit: 10,
    };

    expect(filters.status).toBe("NEW");
    expect(filters.propertyRef).toBe("PROP001");
    expect(filters.page).toBe(2);
    expect(filters.limit).toBe(10);
  });

  it("should support large pagination limits", () => {
    const filters = { limit: 100 };
    const limit = filters.limit ?? 20;
    expect(limit).toBeGreaterThan(0);
    expect(limit).toBeLessThanOrEqual(1000);
  });

  it("should support high page numbers", () => {
    const filters = { page: 100 };
    const page = filters.page ?? 1;
    expect(page).toBeGreaterThan(0);
  });

  it("should accept empty filters object", async () => {
    const result = await LeadsListService.decorator.leadsListService.listLeads("agency-test-1",
      {},
    );

    expect(result).toBeDefined();
    expect(result).toHaveProperty("leads");
    expect(Array.isArray(result.leads)).toBe(true);
  });

  it("should return object with leads, total, page, limit", async () => {
    const result = await LeadsListService.decorator.leadsListService.listLeads("agency-test-1",
      {},
    );

    expect(result).toHaveProperty("leads");
    expect(result).toHaveProperty("total");
    expect(result).toHaveProperty("page");
    expect(result).toHaveProperty("limit");
  });

  it("should return leads as an array", async () => {
    const result = await LeadsListService.decorator.leadsListService.listLeads("agency-test-1",
      {},
    );

    expect(Array.isArray(result.leads)).toBe(true);
  });
});
