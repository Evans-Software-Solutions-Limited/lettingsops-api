import { describe, it, expect } from "vitest";
import { SignJWT } from "jose";
import { verifyJwt, assertClaims, JwtVerificationError } from "../jwtVerifier";

const KEY = "test-signing-key-32-chars-min-padded-x";
const WRONG_KEY = "different-signing-key-32-chars-min-pad";

function encode(secret: string): Uint8Array {
  return new TextEncoder().encode(secret);
}

interface ClaimOverrides {
  sub?: unknown;
  agencyId?: unknown;
  estateAgentId?: unknown;
  role?: unknown;
  // Provide as ISO string ("1h", "-5m") so the test reads naturally;
  // jose handles both ISO offsets and numeric exp.
  expIn?: string;
}

async function mintToken(
  signingKey: string,
  overrides: ClaimOverrides = {},
): Promise<string> {
  // Start from a valid claim set. If the override key is present, honour
  // its value (including the explicit-undefined "omit this claim" case);
  // otherwise apply the default.
  const claims: Record<string, unknown> = {};
  claims.sub = "sub" in overrides ? overrides.sub : "agent-uuid-1";
  claims.agencyId =
    "agencyId" in overrides ? overrides.agencyId : "agency-uuid-1";
  claims.estateAgentId =
    "estateAgentId" in overrides ? overrides.estateAgentId : "agent-uuid-1";
  claims.role = "role" in overrides ? overrides.role : "agent";
  for (const k of Object.keys(claims)) {
    if (claims[k] === undefined) delete claims[k];
  }
  return new SignJWT(claims as Record<string, string>)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(overrides.expIn ?? "1h")
    .sign(encode(signingKey));
}

describe("verifyJwt", () => {
  it("returns typed claims for a valid token", async () => {
    const token = await mintToken(KEY);
    const claims = await verifyJwt(token, KEY);

    expect(claims.sub).toBe("agent-uuid-1");
    expect(claims.agencyId).toBe("agency-uuid-1");
    expect(claims.estateAgentId).toBe("agent-uuid-1");
    expect(claims.role).toBe("agent");
    expect(claims.exp).toBeGreaterThan(claims.iat);
  });

  it("rejects an expired token with reason 'expired'", async () => {
    const token = await mintToken(KEY, { expIn: "-1m" });
    await expect(verifyJwt(token, KEY)).rejects.toMatchObject({
      name: "JwtVerificationError",
      reason: "expired",
    });
  });

  it("rejects a token signed with a different key as 'bad_signature'", async () => {
    const token = await mintToken(WRONG_KEY);
    await expect(verifyJwt(token, KEY)).rejects.toMatchObject({
      reason: "bad_signature",
    });
  });

  it("rejects a malformed token string as 'malformed'", async () => {
    await expect(verifyJwt("not-a-jwt", KEY)).rejects.toMatchObject({
      reason: "malformed",
    });
  });

  it("rejects an empty signing key with reason 'missing_signing_key'", async () => {
    const token = await mintToken(KEY);
    await expect(verifyJwt(token, "")).rejects.toMatchObject({
      reason: "missing_signing_key",
    });
  });

  it("falls back to JWT_SIGNING_KEY env when no key passed", async () => {
    const token = await mintToken(KEY);
    const prev = process.env.JWT_SIGNING_KEY;
    process.env.JWT_SIGNING_KEY = KEY;
    try {
      const claims = await verifyJwt(token);
      expect(claims.agencyId).toBe("agency-uuid-1");
    } finally {
      if (prev === undefined) delete process.env.JWT_SIGNING_KEY;
      else process.env.JWT_SIGNING_KEY = prev;
    }
  });

  describe("claim validation", () => {
    it("rejects missing agencyId as 'missing_claim'", async () => {
      const token = await mintToken(KEY, { agencyId: undefined });
      await expect(verifyJwt(token, KEY)).rejects.toMatchObject({
        reason: "missing_claim",
      });
    });

    it("rejects missing estateAgentId as 'missing_claim'", async () => {
      const token = await mintToken(KEY, { estateAgentId: undefined });
      await expect(verifyJwt(token, KEY)).rejects.toMatchObject({
        reason: "missing_claim",
      });
    });

    it("rejects missing role as 'missing_claim'", async () => {
      const token = await mintToken(KEY, { role: undefined });
      await expect(verifyJwt(token, KEY)).rejects.toMatchObject({
        reason: "missing_claim",
      });
    });

    it("rejects role outside the allowed set as 'wrong_claim_type'", async () => {
      const token = await mintToken(KEY, { role: "superuser" });
      await expect(verifyJwt(token, KEY)).rejects.toMatchObject({
        reason: "wrong_claim_type",
      });
    });

    it("rejects non-string agencyId as 'wrong_claim_type'", async () => {
      const token = await mintToken(KEY, { agencyId: 42 });
      await expect(verifyJwt(token, KEY)).rejects.toMatchObject({
        reason: "wrong_claim_type",
      });
    });
  });

  // `assertClaims` is exported so the defence-in-depth wrong-type branches —
  // which jose's own claim validation makes unreachable through `verifyJwt` —
  // can be exercised directly. Production code should not call it.
  describe("assertClaims (defence-in-depth branches)", () => {
    const validPayload = {
      sub: "agent-uuid-1",
      agencyId: "agency-uuid-1",
      estateAgentId: "agent-uuid-1",
      role: "agent",
      exp: 1_700_000_000,
      iat: 1_700_000_000,
    };

    it("returns typed claims for a well-formed payload", () => {
      expect(assertClaims({ ...validPayload }).role).toBe("agent");
    });

    it("rejects non-string sub as 'wrong_claim_type'", () => {
      expect(() => assertClaims({ ...validPayload, sub: 42 })).toThrow(
        expect.objectContaining({ reason: "wrong_claim_type" }),
      );
    });

    it("rejects non-string estateAgentId as 'wrong_claim_type'", () => {
      expect(() =>
        assertClaims({ ...validPayload, estateAgentId: null }),
      ).toThrow(expect.objectContaining({ reason: "wrong_claim_type" }));
    });

    it("rejects non-number exp as 'wrong_claim_type'", () => {
      expect(() => assertClaims({ ...validPayload, exp: "soon" })).toThrow(
        expect.objectContaining({ reason: "wrong_claim_type" }),
      );
    });

    it("rejects non-number iat as 'wrong_claim_type'", () => {
      expect(() => assertClaims({ ...validPayload, iat: "now" })).toThrow(
        expect.objectContaining({ reason: "wrong_claim_type" }),
      );
    });
  });

  it("the thrown error is a JwtVerificationError (subclass of Error)", async () => {
    try {
      await verifyJwt("not-a-jwt", KEY);
      throw new Error("expected throw");
    } catch (err) {
      expect(err).toBeInstanceOf(JwtVerificationError);
      expect(err).toBeInstanceOf(Error);
    }
  });
});
