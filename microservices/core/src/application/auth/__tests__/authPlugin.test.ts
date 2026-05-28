import { describe, it, expect, beforeEach, vi } from "vitest";
import Elysia from "elysia";
import { SignJWT } from "jose";
import { auth, resolveAuth, type AuthContext } from "../authPlugin";
import { HttpError } from "../httpError";
import { JwtVerificationError } from "../jwtVerifier";
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
  beforeEach(() => {
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

    it("throws 401 on an invalid token", async () => {
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

    it("does NOT collapse missing_signing_key to 401 — re-raises as 500-class JwtVerificationError", async () => {
      // Regression for Inspector Brad's lead on PR #34: a deploy that
      // forgot `sst secret set LettingsOpsJwtSigningKey ...` is an
      // operator mistake. If the plugin collapsed this to 401 every
      // JWT-bearing request would look like "bad caller credentials"
      // and Block G's missing-config alarm would never fire. The
      // verifier's classification must survive past the plugin.
      const token = await mintJwt();
      try {
        await resolveAuth(
          makeHeaders({ authorization: `Bearer ${token}` }),
          { signingKey: "" }, // simulate the missing-secret deploy
        );
        throw new Error("expected throw");
      } catch (err) {
        // Specifically NOT an HttpError — Elysia's default handler 500s
        // it, which is what we want.
        expect(err).toBeInstanceOf(JwtVerificationError);
        expect(err).not.toBeInstanceOf(HttpError);
        expect((err as JwtVerificationError).reason).toBe(
          "missing_signing_key",
        );
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

    it("throws 401 on a missing / revoked key", async () => {
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
    it("throws 401 when no Authorization or x-api-key header is present", async () => {
      await expect(resolveAuth(makeHeaders())).rejects.toMatchObject({
        status: 401,
        message: "Authentication required",
      });
    });

    it("the thrown error is an HttpError (so handler .onError can map 401)", async () => {
      try {
        await resolveAuth(makeHeaders());
        throw new Error("expected throw");
      } catch (err) {
        expect(err).toBeInstanceOf(HttpError);
        expect((err as HttpError).status).toBe(401);
      }
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

    it("missing creds bubble HttpError(401) up to Elysia (handler .onError maps to 401)", async () => {
      // The plugin throws HttpError(401, "Authentication required") from
      // .derive when no Authorization or x-api-key header is present.
      // Elysia surfaces the throw via onError — verify it reaches the app
      // boundary unchanged so each handler's local onError can map it.
      let caught: unknown;
      const app = new Elysia()
        .use(auth)
        .onError(({ error }) => {
          caught = error;
          // Mirror the per-handler .onError pattern (see e.g.
          // leadsCreateHandler) so the status reaches the response.
          if (error instanceof HttpError) {
            return new Response(error.message, { status: error.status });
          }
        })
        .get("/ping", () => "ok");

      const res = await app.handle(new Request("http://localhost/ping"));
      expect(res.status).toBe(401);
      expect(caught).toBeInstanceOf(HttpError);
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
