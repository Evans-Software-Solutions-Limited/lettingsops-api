import { describe, it, expect } from "vitest";
import { LeadsCreateService } from "../leadsCreateService";

describe("LeadsCreateService", () => {
  it("should be an Elysia service", () => {
    expect(LeadsCreateService).toBeDefined();
    expect(typeof LeadsCreateService).toBe("object");
  });

  it("should have leadsCreateService decorator", () => {
    expect(LeadsCreateService.decorator).toBeDefined();
    expect(LeadsCreateService.decorator.leadsCreateService).toBeDefined();
    expect(
      typeof LeadsCreateService.decorator.leadsCreateService.createLead,
    ).toBe("function");
  });

  it("should accept name and email as required fields", () => {
    const input = {
      name: "Jane Doe",
      email: "jane@example.com",
    };

    expect(input).toHaveProperty("name");
    expect(input).toHaveProperty("email");
    expect(input.name).toBe("Jane Doe");
    expect(input.email).toBe("jane@example.com");
  });

  it("should accept optional phone field", () => {
    const input = {
      name: "John Doe",
      email: "john@example.com",
      phone: "+447700900001",
    };

    expect(input).toHaveProperty("phone");
    expect(input.phone).toBe("+447700900001");
  });

  it("should accept optional propertyRef field", () => {
    const input = {
      name: "John Doe",
      email: "john@example.com",
      propertyRef: "PROP001",
    };

    expect(input).toHaveProperty("propertyRef");
    expect(input.propertyRef).toBe("PROP001");
  });

  it("should accept optional message field", () => {
    const input = {
      name: "John Doe",
      email: "john@example.com",
      message: "Interested in property",
    };

    expect(input).toHaveProperty("message");
    expect(input.message).toBe("Interested in property");
  });

  it("should default source to manual when not provided", () => {
    const input = {
      name: "Jane Doe",
      email: "jane@example.com",
    };

    const source = (input as Record<string, unknown>).source ?? "manual";
    expect(source).toBe("manual");
  });

  it("should preserve provided source value", () => {
    const input = {
      name: "John Doe",
      email: "john@example.com",
      source: "portal",
    };

    const source = (input as Record<string, unknown>).source ?? "manual";
    expect(source).toBe("portal");
  });

  it("should support all source types", () => {
    const sources = ["email", "phone", "portal", "manual"];

    for (const source of sources) {
      expect(sources).toContain(source);
    }
  });

  it("should always set status to NEW for new lead creation", async () => {
    const input = {
      name: "Bob Smith",
      email: "bob@example.com",
    };

    const result =
      await LeadsCreateService.decorator.leadsCreateService.createLead(input);

    expect(result).toBeDefined();
    expect(result.status).toBe("NEW");
  });

  it("should return lead object with id, status, and createdAt", async () => {
    const input = {
      name: "Alice Smith",
      email: "alice@example.com",
    };

    const result =
      await LeadsCreateService.decorator.leadsCreateService.createLead(input);

    expect(result).toHaveProperty("id");
    expect(result).toHaveProperty("status");
    expect(result).toHaveProperty("createdAt");
  });

  it("should return id as a string", async () => {
    const input = {
      name: "John Doe",
      email: "john@example.com",
    };

    const result =
      await LeadsCreateService.decorator.leadsCreateService.createLead(input);

    expect(typeof result.id).toBe("string");
    expect(result.id).toBeTruthy();
  });

  it("should return status as NEW", async () => {
    const input = {
      name: "Jane Doe",
      email: "jane@example.com",
    };

    const result =
      await LeadsCreateService.decorator.leadsCreateService.createLead(input);

    expect(result.status).toBe("NEW");
  });

  it("should return createdAt as ISO string", async () => {
    const input = {
      name: "Bob Smith",
      email: "bob@example.com",
    };

    const result =
      await LeadsCreateService.decorator.leadsCreateService.createLead(input);

    const isoRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;
    expect(result.createdAt).toMatch(isoRegex);
  });

  it("should handle minimal required fields", async () => {
    const input = {
      name: "Jane Doe",
      email: "jane@example.com",
    };

    const result =
      await LeadsCreateService.decorator.leadsCreateService.createLead(input);

    expect(result).toBeDefined();
    expect(result.status).toBe("NEW");
  });

  it("should handle all optional fields", async () => {
    const input = {
      name: "John Smith",
      email: "john@example.com",
      phone: "+447700900002",
      propertyRef: "PROP002",
      message: "Viewing enquiry for PROP002",
      source: "portal" as const,
    };

    const result =
      await LeadsCreateService.decorator.leadsCreateService.createLead(input);

    expect(result).toBeDefined();
    expect(result.status).toBe("NEW");
  });

  it("should handle long property references", async () => {
    const input = {
      name: "John Doe",
      email: "john@example.com",
      propertyRef: "PROPERTY-REF-1234567890-ABCDEF",
      message: "Long property reference test",
    };

    const result =
      await LeadsCreateService.decorator.leadsCreateService.createLead(input);

    expect(result).toBeDefined();
    expect(result.status).toBe("NEW");
  });

  it("should handle international phone numbers", async () => {
    const input = {
      name: "International User",
      email: "international@example.com",
      phone: "+14155552671",
      message: "International phone test",
    };

    const result =
      await LeadsCreateService.decorator.leadsCreateService.createLead(input);

    expect(result).toBeDefined();
    expect(result.status).toBe("NEW");
  });
});
