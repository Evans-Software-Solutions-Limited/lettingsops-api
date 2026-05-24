import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import Elysia from "elysia";
import { SignJWT } from "jose";
import { auth, resolveAuth, type AuthContext } from "../authPlugin";
import { HttpError } from "../httpError";
import type { ApiKeyRepository } from "../apiKeyRepository";
import {
  runWithRequestContext,
  getRequestContext,
} from "@lettingsops/api-utils/logger";

const KEY = "test-signing-key-32-chars-min-padded-x";
const NOW = new Date("2024-06-01T10:00:00.000Z");

async function mintJwt(): Promise<string> {
  return new SignJWT({
    sub: "agent-uuid-1",
    agencyId: "agency-uuid-1",
    estateAgentId: "agent-uuid-1",
    role: "agent",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(new TextEncoder().encode(KEY));
}

function makeHeaders(init: Record<string, string> = {}): Headers {
  return new Headers(init);
}

function makeRepo(
  overrides: {
    findActive?: ApiKeyRepository["findActive"];
    touch?: ApiKeyRepository["touch"];
  } = {},
): ApiKeyRepository {
  return {
    findActive: overrides.findActive ?? vi.fn().mockResolvedValue(null),
    touch: overrides.touch ?? vi.fn().mockResolvedValue(undefined),
  } as unknown as ApiKeyRepository;
}

describe("resolveAuth", () => {
  // Block out the env var so test runs don't leak each other's enforcement.
  const prevAuthEnforced = process.env.AUTH_ENFORCED;
  beforeEach(() => {
    delete process.env.AUTH_ENFORCED;
  });
  afterEach(() => {
    if (prevAuthEnforced === undefined) delete process.env.AUTH_ENFORCED;
    else process.env.AUTH_ENFORCED = prevAuthEnforced;
    vi.clearAllMocks();
  });

  // ── JWT path ────────────────────────────────────────────────────────────────

  describe("JWT path", () => {
    it("resolves a valid Bearer token to a user principal", async () => {
      const token = await mintJwt();
      const ctx = await resolveAuth(
        makeHeaders({ authorization: `Bearer ${token}` }),
        { signingKey: KEY },
      );
      expect(ctx).toEqual({
        principal: "user",
        agencyId: "agency-uuid-1",
        estateAgentId: "agent-uuid-1",
        role: "agent",
      });
    });

    it("accepts case-insensitive 'bearer' prefix", async () => {
      const token = await mintJwt();
      const ctx = await resolveAuth(
        makeHeaders({ authorization: `bearer ${token}` }),
        { signingKey: KEY },
      );
      expect(ctx.principal).toBe("user");
    });

    it("throws 401 on an invalid token (even in soft mode)", async () => {
      // Default AUTH_ENFORCED=undefined → soft mode. Bad creds still 401.
      await expect(
        resolveAuth(makeHeaders({ authorization: "Bearer not-a-jwt" }), {
          signingKey: KEY,
        }),
      ).rejects.toMatchObject({ status: 401 });
    });

    it("the thrown error is an HttpError", async () => {
      try {
        await resolveAuth(makeHeaders({ authorization: "Bearer not-a-jwt" }), {
          signingKey: KEY,
        });
        throw new Error("expected throw");
      } catch (err) {
        expect(err).toBeInstanceOf(HttpError);
      }
    });

    it("error message is fixed and PII-free", async () => {
      try {
        await resolveAuth(makeHeaders({ authorization: "Bearer not-a-jwt" }), {
          signingKey: KEY,
        });
      } catch (err) {
        expect((err as HttpError).message).toBe("Invalid authentication");
      }
    });
  });

  // ── API key path ────────────────────────────────────────────────────────────

  describe("API key path", () => {
    it("resolves a valid raw key to a service principal", async () => {
      const repo = makeRepo({
        findActive: vi.fn().mockResolvedValue({
          id: "key-uuid-1",
          agencyId: "agency-uuid-2",
          name: "Reapit",
          keyHash: "irrelevant",
          prefix: "irrelevant",
          revokedAt: null,
          lastUsedAt: null,
          createdAt: NOW,
        }),
      });

      const ctx = await resolveAuth(makeHeaders({ "x-api-key": "raw-key" }), {
        apiKeyRepository: repo,
      });

      expect(ctx).toEqual({
        principal: "service",
        agencyId: "agency-uuid-2",
        estateAgentId: null,
        role: null,
      });
      expect(repo.findActive).toHaveBeenCalledTimes(1);
      // The hash is sha256 of "raw-key"; we don't assert the exact hex
      // value here — the contract is "repository sees a hash, not the
      // raw key". Verify by checking the argument is not the raw key.
      const arg = (repo.findActive as ReturnType<typeof vi.fn>).mock
        .calls[0]?.[0];
      expect(arg).not.toBe("raw-key");
      expect(typeof arg).toBe("string");
      expect((arg as string).length).toBe(64); // sha256 hex is 64 chars
    });

    it("touches the key on success (best-effort, errors swallowed)", async () => {
      const touch = vi.fn().mockRejectedValue(new Error("db blip"));
      const repo = makeRepo({
        findActive: vi.fn().mockResolvedValue({
          id: "key-uuid-1",
          agencyId: "agency-uuid-2",
          name: "Reapit",
          keyHash: "x",
          prefix: "x",
          revokedAt: null,
          lastUsedAt: null,
          createdAt: NOW,
        }),
        touch,
      });

      // Touch failure must not surface to the caller.
      const ctx = await resolveAuth(makeHeaders({ "x-api-key": "raw-key" }), {
        apiKeyRepository: repo,
      });
      expect(ctx.principal).toBe("service");
      // Touch was scheduled (fire-and-forget). Drain the microtask queue.
      await new Promise((resolve) => setImmediate(resolve));
      expect(touch).toHaveBeenCalledTimes(1);
    });

    it("throws 401 on a missing / revoked key (even in soft mode)", async () => {
      const repo = makeRepo(); // findActive resolves to null by default
      await expect(
        resolveAuth(makeHeaders({ "x-api-key": "raw-key" }), {
          apiKeyRepository: repo,
        }),
      ).rejects.toMatchObject({ status: 401, message: "Invalid API key" });
    });
  });

  // ── Missing creds ──────────────────────────────────────────────────────────

  describe("missing credentials", () => {
    it("resolves to anonymous when AUTH_ENFORCED is unset", async () => {
      const ctx = await resolveAuth(makeHeaders());
      expect(ctx).toEqual({
        principal: "anonymous",
        agencyId: null,
        estateAgentId: null,
        role: null,
      });
    });

    it("resolves to anonymous when AUTH_ENFORCED='false'", async () => {
      process.env.AUTH_ENFORCED = "false";
      const ctx = await resolveAuth(makeHeaders());
      expect(ctx.principal).toBe("anonymous");
    });

    it("treats only the exact string 'true' as enforced", async () => {
      // Defence against ambiguous env values silently flipping behaviour.
      for (const value of ["TRUE", "1", "yes", "on", "True"]) {
        process.env.AUTH_ENFORCED = value;
        const ctx = await resolveAuth(makeHeaders());
        expect(ctx.principal).toBe("anonymous");
      }
    });

    it("throws 401 when AUTH_ENFORCED='true'", async () => {
      process.env.AUTH_ENFORCED = "true";
      await expect(resolveAuth(makeHeaders())).rejects.toMatchObject({
        status: 401,
        message: "Authentication required",
      });
    });

    it("explicit enforced=true override (used for in-handler reuse)", async () => {
      await expect(
        resolveAuth(makeHeaders(), { enforced: true }),
      ).rejects.toMatchObject({ status: 401 });
    });
  });

  // ── Cross-paths ────────────────────────────────────────────────────────────

  describe("Elysia plugin integration", () => {
    it("enriches the AsyncLocalStorage request context with agencyId when creds resolve", async () => {
      // Set JWT_SIGNING_KEY so the default verifyJwt() path picks it up via env.
      const prevKey = process.env.JWT_SIGNING_KEY;
      process.env.JWT_SIGNING_KEY = KEY;
      try {
        const token = await mintJwt();
        let seenScope: { agencyId?: string } | undefined;
        let seenCtx: AuthContext | undefined;

        const app = new Elysia()
          .use(auth)
          .get("/ping", ({ auth }: { auth: AuthContext }) => {
            seenCtx = auth;
            seenScope = getRequestContext();
            return "ok";
          });

        // Open an ALS scope around the request so updateRequestContext has
        // something to mutate. In prod the requestContextPlugin opens the
        // scope for us at the outer api.ts layer.
        await runWithRequestContext({ requestId: "req-1" }, async () => {
          await app.handle(
            new Request("http://localhost/ping", {
              headers: { authorization: `Bearer ${token}` },
            }),
          );
        });

        expect(seenCtx?.principal).toBe("user");
        expect(seenCtx?.agencyId).toBe("agency-uuid-1");
        expect(seenScope?.agencyId).toBe("agency-uuid-1");
      } finally {
        if (prevKey === undefined) delete process.env.JWT_SIGNING_KEY;
        else process.env.JWT_SIGNING_KEY = prevKey;
      }
    });

    it("falls through to anonymous (soft mode) when no creds present", async () => {
      let seenCtx: AuthContext | undefined;
      const app = new Elysia()
        .use(auth)
        .get("/ping", ({ auth }: { auth: AuthContext }) => {
          seenCtx = auth;
          return "ok";
        });

      const res = await app.handle(new Request("http://localhost/ping"));
      expect(res.status).toBe(200);
      expect(seenCtx?.principal).toBe("anonymous");
      expect(seenCtx?.agencyId).toBeNull();
    });
  });

  describe("when both headers are present", () => {
    it("the JWT path wins (Bearer evaluated before x-api-key)", async () => {
      const token = await mintJwt();
      const repo = makeRepo({
        findActive: vi.fn().mockResolvedValue({
          id: "key-uuid-1",
          agencyId: "agency-uuid-from-key",
          name: "Reapit",
          keyHash: "x",
          prefix: "x",
          revokedAt: null,
          lastUsedAt: null,
          createdAt: NOW,
        }),
      });
      const ctx = await resolveAuth(
        makeHeaders({
          authorization: `Bearer ${token}`,
          "x-api-key": "raw-key",
        }),
        { signingKey: KEY, apiKeyRepository: repo },
      );
      expect(ctx.principal).toBe("user");
      expect(ctx.agencyId).toBe("agency-uuid-1");
      // API key was never consulted.
      expect(repo.findActive).not.toHaveBeenCalled();
    });
  });
});
