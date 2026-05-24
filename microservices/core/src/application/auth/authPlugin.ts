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
 * AUTH_ENFORCED feature flag (D4):
 *
 *   - `AUTH_ENFORCED=true`  : missing creds throw 401. Bad creds throw 401.
 *   - `AUTH_ENFORCED=false` : missing creds pass through as
 *     `principal: "anonymous"` (no agencyId enrichment).
 *     Bad creds STILL throw 401 — soft mode lowers the bar for "no header"
 *     callers, not for "broken header" callers; the latter is always an
 *     operator mistake worth surfacing.
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

export type Principal = "user" | "service" | "anonymous";

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
  /** Resolved agency ID. Null for `anonymous` (soft mode, no creds). */
  readonly agencyId: string | null;
  /** Set only for JWT principals. Null for service / anonymous. */
  readonly estateAgentId: string | null;
  /** Set only for JWT principals. Null for service / anonymous. */
  readonly role: "admin" | "agent" | null;
}

function sha256Hex(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

function isEnforced(): boolean {
  // Explicit string "true" — being strict here avoids ambiguous truthy
  // values like "TRUE" / "1" / "on" silently behaving differently across
  // stages. Operator must use the lowercase string.
  return process.env.AUTH_ENFORCED === "true";
}

/**
 * Construct a fresh anonymous auth context. We deliberately do NOT cache
 * a shared singleton — Lambda warm containers re-use module-level state,
 * and a stray mutation by any handler would leak the previous request's
 * fields into every subsequent anonymous request on the same container.
 * Combined with the `readonly` typing on `AuthContext`, this rules out
 * both compile-time and runtime poisoning.
 */
function anonymousContext(): AuthContext {
  return {
    principal: "anonymous",
    agencyId: null,
    estateAgentId: null,
    role: null,
  };
}

/**
 * Resolve credentials from headers. Returns the auth context to attach to
 * the request, or throws `HttpError(401, ...)` on bad / missing (when
 * enforced) credentials.
 *
 * Factored out of the plugin so the auth resolution can be unit-tested
 * without spinning up an Elysia app for every case.
 */
export async function resolveAuth(
  headers: Headers,
  deps: {
    apiKeyRepository?: ApiKeyRepository;
    signingKey?: string;
    enforced?: boolean;
  } = {},
): Promise<AuthContext> {
  const enforced = deps.enforced ?? isEnforced();
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
  if (enforced) {
    throw new HttpError(401, "Authentication required");
  }
  return anonymousContext();
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
    if (ctx.agencyId) {
      updateRequestContext({
        agencyId: ctx.agencyId,
        estateAgentId: ctx.estateAgentId ?? undefined,
      });
    }
    return { auth: ctx };
  },
);
