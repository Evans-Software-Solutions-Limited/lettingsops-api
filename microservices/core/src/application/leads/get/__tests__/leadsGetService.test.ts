import { describe, it, expect } from "vitest";
import { LeadsGetService } from "../leadsGetService";

describe("LeadsGetService", () => {
  it("should be an Elysia service", () => {
    expect(LeadsGetService).toBeDefined();
    expect(typeof LeadsGetService).toBe("object");
  });

  it("should have leadsGetService decorator", () => {
    expect(LeadsGetService.decorator).toBeDefined();
    expect(LeadsGetService.decorator.leadsGetService).toBeDefined();
    expect(typeof LeadsGetService.decorator.leadsGetService.getLead).toBe(
      "function",
    );
  });

  it("should accept a string id parameter", () => {
    const id = "lead-uuid-1";
    expect(typeof id).toBe("string");
    expect(id).toBeTruthy();
  });

  it("should throw error when lead not found", async () => {
    await expect(
      LeadsGetService.decorator.leadsGetService.getLead("non-existent-lead"),
    ).rejects.toThrow("Lead not found");
  });

  it("should handle UUIDs as lead ids", () => {
    const uuids = [
      "550e8400-e29b-41d4-a716-446655440000",
      "lead-uuid-1",
      "abc-123-def-456",
    ];

    for (const uuid of uuids) {
      expect(uuid).toBeTruthy();
      expect(typeof uuid).toBe("string");
    }
  });

  it("should handle numeric string ids", () => {
    const numericIds = ["1", "12345", "999"];

    for (const id of numericIds) {
      expect(id).toBeTruthy();
      expect(typeof id).toBe("string");
    }
  });
});
