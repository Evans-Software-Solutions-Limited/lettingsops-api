/**
 * Auth plugin.
 *
 * Two credential types per design §1.1:
 *
 *   - `Authorization: Bearer <jwt>` — dashboard users. Verified via
 *     `verifyJwt`, returns `{ agencyId, estateAgentId, role,
 *     principal: "user" }`.
 *   - `x-api-key: <raw>` — server-to-server callers. Hashed with sha-256
 *     and looked up via `ApiKeyRepository.findActive`. On success the
 *     row's `last_used_at` is touched.
 *
 * The plugin enriches the AsyncLocalStorage request context (from
 * `@lettingsops/api-utils/logger`) with `agencyId` and `estateAgentId`,
 * so every downstream `logger.*` call carries those fields without
 * per-call threading.
 *
 * Auth is always on. Missing creds → 401. Bad creds → 401. The previous
 * AUTH_ENFORCED env flag (soft / hard modes) was removed once every
 * HTTP handler had been migrated to `.use(auth)` — there is no longer
 * an "anonymous" principal at the HTTP layer.
 *
 * Webhook routes (ElevenLabs, SES → emailIngestion, future) stay
 * HMAC-only and must NOT mount this plugin. Per design §1.4 they're
 * tenant-bound via the webhook configuration rather than per-request
 * auth.
 */
import Elysia from "elysia";
import { createHash } from "node:crypto";
import { getDb } from "@lettingsops/db";
import {
  logger,
  updateRequestContext,
  formatError,
} from "@lettingsops/api-utils/logger";
import { ApiKeyRepository } from "./apiKeyRepository";
import { verifyJwt, JwtVerificationError } from "./jwtVerifier";
import { HttpError } from "./httpError";

export type Principal = "user" | "service";

/**
 * Resolved auth context attached to every authenticated request via
 * Elysia's `.derive`. All fields are `readonly` because Lambda re-uses
 * the same module-level state between invocations on a warm container —
 * a mutation by any one handler would leak into the next request through
 * the same container. The type-level guard is paired with a fresh
 * literal returned at each call site (no shared singletons) so the
 * runtime can't be poisoned even via `as any` escape hatches.
 */
export interface AuthContext {
  readonly principal: Principal;
  /** Resolved agency ID — always present for an authenticated caller. */
  readonly agencyId: string;
  /** Set only for JWT principals. Null for service. */
  readonly estateAgentId: string | null;
  /** Set only for JWT principals. Null for service. */
  readonly role: "admin" | "agent" | null;
}

function sha256Hex(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

/**
 * Resolve credentials from headers. Returns the auth context to attach to
 * the request, or throws `HttpError(401, ...)` on bad / missing
 * credentials.
 *
 * Factored out of the plugin so the auth resolution can be unit-tested
 * without spinning up an Elysia app for every case.
 */
export async function resolveAuth(
  headers: Headers,
  deps: {
    apiKeyRepository?: ApiKeyRepository;
    signingKey?: string;
  } = {},
): Promise<AuthContext> {
  const authz = headers.get("authorization") ?? "";
  const apiKey = headers.get("x-api-key");

  if (authz.toLowerCase().startsWith("bearer ")) {
    try {
      const claims = await verifyJwt(authz.slice(7), deps.signingKey);
      const ctx: AuthContext = {
        principal: "user",
        agencyId: claims.agencyId,
        estateAgentId: claims.estateAgentId,
        role: claims.role,
      };
      return ctx;
    } catch (err) {
      // `missing_signing_key` is an operator misconfig, not a caller
      // mistake. The verifier classifies it separately precisely so the
      // HTTP layer can keep it out of the 401 bucket — otherwise every
      // JWT-bearing request after a deploy that forgot to set the secret
      // would look identical to "lots of bad caller credentials", and
      // Block G's missing-config alarm (when it lands) would never fire.
      // Log at error level and re-raise so Elysia's default handler
      // surfaces it as 500.
      if (
        err instanceof JwtVerificationError &&
        err.reason === "missing_signing_key"
      ) {
        logger.error("JWT signing key not configured", {
          reason: err.reason,
        });
        throw err;
      }

      // Everything else is a caller mistake. Log the classification
      // bucket — `reason` is PII-free by construction — and surface a
      // generic 401. Never log the raw token.
      const reason =
        err instanceof JwtVerificationError ? err.reason : "unknown";
      logger.warn("JWT verification failed", {
        reason,
        ...formatError(err),
      });
      throw new HttpError(401, "Invalid authentication");
    }
  }

  if (apiKey) {
    const repo = deps.apiKeyRepository ?? new ApiKeyRepository(getDb());
    const row = await repo.findActive(sha256Hex(apiKey));
    if (!row) {
      logger.warn("API key lookup failed", { reason: "no_active_key" });
      throw new HttpError(401, "Invalid API key");
    }
    // Touch is fire-and-forget for the request hot path: if the lastUsedAt
    // bump fails, we'd rather serve the request than 500 the caller. Errors
    // are swallowed but logged.
    void repo.touch(row.id).catch((err) => {
      logger.warn("API key touch failed", { ...formatError(err) });
    });
    return {
      principal: "service",
      agencyId: row.agencyId,
      estateAgentId: null,
      role: null,
    };
  }

  // No credentials at all.
  throw new HttpError(401, "Authentication required");
}

/**
 * Elysia plugin. Mount with `.use(auth)` on any handler that requires
 * authentication; the handler receives `agencyId`, `principal`, etc on
 * its context via Elysia's `.derive`.
 */
export const auth = new Elysia({ name: "auth" }).derive(
  { as: "scoped" },
  async ({ request }): Promise<{ auth: AuthContext }> => {
    const ctx = await resolveAuth(request.headers);
    // Enrich the ALS request context so every downstream `logger.*` call
    // carries `agencyId` (and `estateAgentId` for user principals)
    // without each handler having to pass them.
    updateRequestContext({
      agencyId: ctx.agencyId,
      estateAgentId: ctx.estateAgentId ?? undefined,
    });
    return { auth: ctx };
  },
);
