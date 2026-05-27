/**
 * apiKeysHandler integration tests.
 *
 * Drive actual HTTP requests through `apiKeysHandler.fetch(new Request(...))`
 * so the tests cover routing, schema validation, principal guard, and the
 * agencyId threading — not just JavaScript literals.
 *
 * The auth plugin and service are mocked so no database is needed.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { apiKeysHandler } from "../apiKeysHandler";

// ── Hoisted values — must be initialised at hoist time so vi.mock factories ──
// ── (which run before module evaluation) can reference them.                 ──

// Mutable auth state object: mutate fields between tests, the derive callback
// reads current values on each request.
const mockAuthState = vi.hoisted(() => ({
  principal: "service" as "service" | "user" | "anonymous",
  agencyId: "agency-test-1" as string | null,
}));

// Service spy functions
const mockCreate = vi.hoisted(() => vi.fn());
const mockList = vi.hoisted(() => vi.fn());
const mockRevoke = vi.hoisted(() => vi.fn());

// ── Module mocks ─────────────────────────────────────────────────────────────

vi.mock("../../auth/authPlugin", async () => {
  const { default: Elysia } = await import("elysia");
  return {
    auth: new Elysia({ name: "auth" }).derive({ as: "scoped" }, () => ({
      auth: {
        principal: mockAuthState.principal,
        agencyId: mockAuthState.agencyId,
        estateAgentId: null as null,
        role: null as null,
      },
    })),
  };
});

vi.mock("../apiKeysService", async () => {
  const { default: Elysia } = await import("elysia");
  return {
    ApiKeysService: new Elysia({ name: "ApiKeysService" }).decorate(
      "apiKeysService",
      {
        createApiKey: mockCreate,
        listApiKeys: mockList,
        revokeApiKey: mockRevoke,
      },
    ),
  };
});

vi.mock("@lettingsops/db", () => ({ getDb: vi.fn(() => ({})) }));
vi.mock("../../auth/apiKeyRepository", () => ({
  ApiKeyRepository: vi.fn(() => ({
    findActive: vi.fn().mockResolvedValue(null),
  })),
}));

// ── Shared fixtures ──────────────────────────────────────────────────────────

const CREATED_KEY = {
  id: "key-uuid-1",
  agencyId: "agency-test-1",
  label: "CI deploy",
  prefix: "abc123de",
  key: "rawkeyvalue1234567890abcdef1234567890ab",
  createdAt: "2024-06-01T10:00:00.000Z",
};

const LIST_ITEM = {
  id: "key-uuid-1",
  agencyId: "agency-test-1",
  label: "CI deploy",
  prefix: "abc123de",
  lastUsedAt: null,
  revokedAt: null,
  createdAt: "2024-06-01T10:00:00.000Z",
};

// ── Helper ───────────────────────────────────────────────────────────────────

function jsonRequest(method: string, url: string, body?: unknown): Request {
  return new Request(`http://localhost${url}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

// ─────────────────────────────────────────────────────────────────────────────

describe("apiKeysHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset auth state to happy-path defaults
    mockAuthState.principal = "service";
    mockAuthState.agencyId = "agency-test-1";
  });

  // ── Principal guard ──────────────────────────────────────────────────────

  describe("principal guard (API-key-auth-only)", () => {
    it("rejects a JWT principal on POST with 403", async () => {
      mockAuthState.principal = "user";

      const res = await apiKeysHandler.fetch(
        jsonRequest("POST", "/api-keys", { label: "CI deploy" }),
      );

      expect(res.status).toBe(403);
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it("rejects an anonymous principal on GET with 403", async () => {
      mockAuthState.principal = "anonymous";

      const res = await apiKeysHandler.fetch(
        new Request("http://localhost/api-keys"),
      );

      expect(res.status).toBe(403);
      expect(mockList).not.toHaveBeenCalled();
    });
  });

  // ── POST /api-keys ───────────────────────────────────────────────────────

  describe("POST /api-keys", () => {
    it("calls createApiKey(agencyId, label) and returns the created key with prefix", async () => {
      mockCreate.mockResolvedValue(CREATED_KEY);

      const res = await apiKeysHandler.fetch(
        jsonRequest("POST", "/api-keys", { label: "CI deploy" }),
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as Record<string, unknown>;
      expect(mockCreate).toHaveBeenCalledWith("agency-test-1", "CI deploy");
      expect(body).toMatchObject({
        id: "key-uuid-1",
        agencyId: "agency-test-1",
        label: "CI deploy",
        prefix: "abc123de",
        key: expect.any(String),
        createdAt: expect.any(String),
      });
    });

    it("passes undefined label when body has no label field", async () => {
      mockCreate.mockResolvedValue({ ...CREATED_KEY, label: null });

      const res = await apiKeysHandler.fetch(
        jsonRequest("POST", "/api-keys", {}),
      );

      expect(res.status).toBe(200);
      expect(mockCreate).toHaveBeenCalledWith("agency-test-1", undefined);
    });

    it("returns 422 when label exceeds 120 chars (schema validation)", async () => {
      const res = await apiKeysHandler.fetch(
        jsonRequest("POST", "/api-keys", { label: "a".repeat(121) }),
      );

      expect(res.status).toBe(422);
      expect(mockCreate).not.toHaveBeenCalled();
    });
  });

  // ── GET /api-keys ────────────────────────────────────────────────────────

  describe("GET /api-keys", () => {
    it("calls listApiKeys(agencyId) and returns keys array with prefix", async () => {
      mockList.mockResolvedValue([LIST_ITEM]);

      const res = await apiKeysHandler.fetch(
        new Request("http://localhost/api-keys"),
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as { keys: unknown[] };
      expect(mockList).toHaveBeenCalledWith("agency-test-1");
      expect(Array.isArray(body.keys)).toBe(true);
      expect(body.keys[0]).toMatchObject({
        id: "key-uuid-1",
        prefix: "abc123de",
        label: "CI deploy",
      });
    });

    it("returns empty keys array when agency has no keys", async () => {
      mockList.mockResolvedValue([]);

      const res = await apiKeysHandler.fetch(
        new Request("http://localhost/api-keys"),
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as { keys: unknown[] };
      expect(body.keys).toEqual([]);
    });
  });

  // ── DELETE /api-keys/:id ─────────────────────────────────────────────────

  describe("DELETE /api-keys/:id", () => {
    it("calls revokeApiKey(agencyId, id) and returns {revoked: true}", async () => {
      mockRevoke.mockResolvedValue(undefined);

      const res = await apiKeysHandler.fetch(
        new Request("http://localhost/api-keys/key-uuid-1", {
          method: "DELETE",
        }),
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as Record<string, unknown>;
      expect(mockRevoke).toHaveBeenCalledWith("agency-test-1", "key-uuid-1");
      expect(body).toEqual({ revoked: true });
    });
  });
});
