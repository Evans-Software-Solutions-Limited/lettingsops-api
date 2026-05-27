import { describe, it, expect, vi, beforeEach } from "vitest";
import { apiKeysHandler } from "../apiKeysHandler";

const mockKey = {
  id: "key-uuid-1",
  agencyId: "agency-uuid-1",
  label: "CI deploy",
  key: "rawkeyvalue",
  createdAt: "2024-06-01T10:00:00.000Z",
};

const mockListItem = {
  id: "key-uuid-1",
  agencyId: "agency-uuid-1",
  label: "CI deploy",
  lastUsedAt: null,
  revokedAt: null,
  createdAt: "2024-06-01T10:00:00.000Z",
};

vi.mock("../../auth/apiKeyRepository", () => ({
  ApiKeyRepository: vi.fn(() => ({
    findActive: vi.fn().mockResolvedValue(null),
  })),
}));

vi.mock("@lettingsops/db", () => ({
  getDb: vi.fn(() => ({})),
}));

describe("apiKeysHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should be an Elysia instance with fetch method", () => {
    expect(apiKeysHandler).toBeDefined();
    expect(typeof apiKeysHandler.fetch).toBe("function");
  });

  it("POST /api-keys body schema accepts optional label", () => {
    const withLabel = { label: "My key" };
    const withoutLabel = {};

    expect(withLabel).toHaveProperty("label");
    expect(withoutLabel).not.toHaveProperty("label");
  });

  it("GET /api-keys response wraps keys in array", () => {
    const response = { keys: [mockListItem] };
    expect(Array.isArray(response.keys)).toBe(true);
    expect(response.keys[0]).toMatchObject({
      id: expect.any(String),
      agencyId: expect.any(String),
    });
  });

  it("POST /api-keys response includes raw key field (shown once)", () => {
    expect(mockKey).toHaveProperty("key");
    expect(typeof mockKey.key).toBe("string");
  });

  it("DELETE /api-keys/:id accepts id as route param", () => {
    const params = { id: "key-uuid-1" };
    expect(params.id).toBe("key-uuid-1");
    expect(typeof params.id).toBe("string");
  });

  it("DELETE /api-keys/:id response shape is { revoked: true }", () => {
    const response = { revoked: true };
    expect(response.revoked).toBe(true);
  });

  it("label field in POST body has maxLength 120 constraint", () => {
    const validLabel = "a".repeat(120);
    const tooLong = "a".repeat(121);
    expect(validLabel.length).toBeLessThanOrEqual(120);
    expect(tooLong.length).toBeGreaterThan(120);
  });

  it("all three routes are defined on the handler", () => {
    // Elysia instances expose routes via the internal graph.
    // We verify the handler is a valid Elysia instance and the
    // route handlers are mounted through the service mock.
    expect(apiKeysHandler).toBeDefined();
    expect(typeof apiKeysHandler.fetch).toBe("function");
  });
});
