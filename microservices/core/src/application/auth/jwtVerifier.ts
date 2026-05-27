/**
 * JWT verifier.
 *
 * Dashboard auth path. The JWT is symmetrically signed (HS256) with a
 * single shared secret loaded from the `JWT_SIGNING_KEY` env var (sourced
 * from the SST secret `LettingsOpsJwtSigningKey` — see infra/api.ts and
 * infra/secrets.ts).
 *
 * Token shape — required claims (rejecting any token missing one of these):
 *
 *   {
 *     "sub": "<estate-agent-uuid>",
 *     "agencyId": "<agency-uuid>",
 *     "estateAgentId": "<estate-agent-uuid>",
 *     "role": "admin" | "agent",
 *     "exp": <unix-seconds>,
 *     "iat": <unix-seconds>
 *   }
 *
 * Issuer / audience: not enforced in this phase — the IdP wiring is
 * out-of-scope and JWTs are minted by the same service that consumes them.
 * Re-add `issuer` / `audience` checks here when an external IdP lands.
 */
import { jwtVerify, errors as joseErrors } from "jose";

export interface JwtClaims {
  /** Subject — typically the estate agent UUID. */
  sub: string;
  agencyId: string;
  estateAgentId: string;
  role: "admin" | "agent";
  /** Expiry (unix seconds). */
  exp: number;
  /** Issued-at (unix seconds). */
  iat: number;
}

export class JwtVerificationError extends Error {
  override name = "JwtVerificationError";
  /** Coarse classification used for log triage and metric filters. */
  readonly reason:
    | "missing_signing_key"
    | "malformed"
    | "expired"
    | "bad_signature"
    | "missing_claim"
    | "wrong_claim_type";

  constructor(message: string, reason: JwtVerificationError["reason"]) {
    super(message);
    this.reason = reason;
  }
}

/**
 * Verify a Bearer JWT and return its typed claims. Throws
 * `JwtVerificationError` on every failure mode — callers (the auth plugin)
 * map the `.reason` field to an HTTP response.
 *
 * The signing-key parameter is optional and defaults to
 * `process.env.JWT_SIGNING_KEY` so the auth plugin can call this with no
 * arguments; tests pass an explicit key.
 */
export async function verifyJwt(
  token: string,
  signingKey: string | undefined = process.env.JWT_SIGNING_KEY,
): Promise<JwtClaims> {
  if (!signingKey) {
    // Hard error rather than 401: a deploy without the secret bound is an
    // operator mistake, not a caller mistake. Surfacing it as a 500 lets
    // the alarm wiring (Block G) catch the missing-config case.
    throw new JwtVerificationError(
      "JWT signing key is not configured",
      "missing_signing_key",
    );
  }

  const keyBytes = new TextEncoder().encode(signingKey);

  let payload: Record<string, unknown>;
  try {
    const result = await jwtVerify(token, keyBytes, {
      algorithms: ["HS256"],
    });
    payload = result.payload as Record<string, unknown>;
  } catch (err) {
    if (err instanceof joseErrors.JWTExpired) {
      throw new JwtVerificationError("JWT expired", "expired");
    }
    if (err instanceof joseErrors.JWSSignatureVerificationFailed) {
      throw new JwtVerificationError(
        "JWT signature verification failed",
        "bad_signature",
      );
    }
    // Anything else from jose (invalid encoding, wrong algorithm, missing
    // segments, header mismatch) collapses into a single "malformed" bucket
    // — these are all "the caller sent us something that can't be trusted".
    throw new JwtVerificationError("JWT could not be parsed", "malformed");
  }

  return assertClaims(payload);
}

/**
 * Validate that an already-verified jose payload conforms to `JwtClaims`.
 *
 * Exported for tests so the wrong-type branches (which jose's own claim
 * validation makes unreachable through the public `verifyJwt` path) can
 * be exercised directly. Production code should not call this — use
 * `verifyJwt` instead.
 */
export function assertClaims(payload: Record<string, unknown>): JwtClaims {
  const required = ["sub", "agencyId", "estateAgentId", "role", "exp", "iat"];
  for (const key of required) {
    if (!(key in payload)) {
      throw new JwtVerificationError(
        `JWT missing required claim: ${key}`,
        "missing_claim",
      );
    }
  }

  if (typeof payload.sub !== "string") {
    throw new JwtVerificationError(
      "JWT claim `sub` must be a string",
      "wrong_claim_type",
    );
  }
  if (typeof payload.agencyId !== "string") {
    throw new JwtVerificationError(
      "JWT claim `agencyId` must be a string",
      "wrong_claim_type",
    );
  }
  if (typeof payload.estateAgentId !== "string") {
    throw new JwtVerificationError(
      "JWT claim `estateAgentId` must be a string",
      "wrong_claim_type",
    );
  }
  if (payload.role !== "admin" && payload.role !== "agent") {
    throw new JwtVerificationError(
      "JWT claim `role` must be 'admin' or 'agent'",
      "wrong_claim_type",
    );
  }
  if (typeof payload.exp !== "number") {
    throw new JwtVerificationError(
      "JWT claim `exp` must be a number",
      "wrong_claim_type",
    );
  }
  if (typeof payload.iat !== "number") {
    throw new JwtVerificationError(
      "JWT claim `iat` must be a number",
      "wrong_claim_type",
    );
  }

  return {
    sub: payload.sub,
    agencyId: payload.agencyId,
    estateAgentId: payload.estateAgentId,
    role: payload.role,
    exp: payload.exp,
    iat: payload.iat,
  };
}
