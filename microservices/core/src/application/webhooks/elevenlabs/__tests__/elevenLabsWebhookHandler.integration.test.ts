/**
 * Integration tests for `elevenLabsWebhookHandler` — drives real
 * `handler.fetch(...)` requests so we exercise the `.onRequest` HMAC
 * verifier added in Block I-PR-B+C 3rd-sweep (Inspector Brad MEDIUM
 * finding on PR #41: signature parity with the email webhook).
 *
 * Cases:
 *   - valid signature + valid agent → 200
 *   - missing `ElevenLabs-Signature` header → 401
 *   - malformed signature (missing `t=` or `v0=`) → 401
 *   - timestamp outside ±5 min tolerance → 401 (replay protection)
 *   - HMAC mismatch → 401 (forgery protection)
 *   - missing `ELEVENLABS_WEBHOOK_SECRET` env → 500 (operator misconfig)
 */
import { createHmac } from "node:crypto";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const VALID_SECRET = "test-elevenlabs-secret-do-not-use-in-prod";
const AGENCY_ID = "agency-test-1";

// Service-side mock for the agent → agency lookup. Returns AGENCY_ID
// by default so the signature-validation tests don't trip on the
// downstream "unknown agent" branch.
const mockFindAgencyForAgent = vi.fn();
vi.mock("../../../auth/agentAgencyRepository", () => ({
  AgentAgencyRepository: vi.fn(() => ({
    findAgencyForAgent: mockFindAgencyForAgent,
  })),
}));

// `@lettingsops/db` is mocked globally in `vitest.setup.ts` — every
// `getDb()` call returns a chainable that resolves repository
// operations against in-memory fixtures. We intentionally do NOT
// override it here; touching the real client (via `importOriginal`)
// would try to connect to a real DB and 500 the happy-path test.

import { elevenLabsWebhookHandler } from "../elevenLabsWebhookHandler";

const validBody = {
  callId: "call-sig-1",
  agentId: "agent_xyz_001",
  intent: "viewing_enquiry" as const,
  extractedFields: { email: "tenant@example.com" },
  transcript: [],
};

/**
 * Build a request whose body and `ElevenLabs-Signature` header are
 * consistent — the signature covers exactly the JSON the handler will
 * read off the request. Caller can override `ts` to test the
 * tolerance window or `secret` to test forgery.
 */
function signedRequest(
  opts: {
    body?: unknown;
    ts?: number;
    secret?: string;
    v0?: string;
    /** When true, omit the `ElevenLabs-Signature` header entirely. */
    omitHeader?: boolean;
    /** Override the header value verbatim (overrides ts/v0). */
    rawHeader?: string;
  } = {},
): Request {
  const body = JSON.stringify(opts.body ?? validBody);
  const ts = opts.ts ?? Math.floor(Date.now() / 1000);
  const secret = opts.secret ?? VALID_SECRET;
  const sig =
    opts.v0 ??
    createHmac("sha256", secret).update(`${ts}.${body}`).digest("hex");
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (!opts.omitHeader) {
    headers["ElevenLabs-Signature"] = opts.rawHeader ?? `t=${ts},v0=${sig}`;
  }
  return new Request("http://localhost/webhooks/elevenlabs", {
    method: "POST",
    headers,
    body,
  });
}

describe("elevenLabsWebhookHandler — HMAC signature validator", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ELEVENLABS_WEBHOOK_SECRET = VALID_SECRET;
    mockFindAgencyForAgent.mockResolvedValue(AGENCY_ID);
  });

  it("accepts a valid signature and passes through to the service", async () => {
    const res = await elevenLabsWebhookHandler.fetch(signedRequest());
    expect(res.status).toBe(200);
    expect(mockFindAgencyForAgent).toHaveBeenCalledTimes(1);
  });

  it("rejects requests with no signature header (401)", async () => {
    const res = await elevenLabsWebhookHandler.fetch(
      signedRequest({ omitHeader: true }),
    );
    expect(res.status).toBe(401);
    // Verifier fires BEFORE the service — proves agency resolution
    // never runs for unauthenticated callers.
    expect(mockFindAgencyForAgent).not.toHaveBeenCalled();
  });

  it("rejects malformed signature headers — missing `v0=` (401)", async () => {
    const res = await elevenLabsWebhookHandler.fetch(
      signedRequest({ rawHeader: `t=${Math.floor(Date.now() / 1000)}` }),
    );
    expect(res.status).toBe(401);
    expect(mockFindAgencyForAgent).not.toHaveBeenCalled();
  });

  it("rejects malformed signature headers — non-numeric timestamp (401)", async () => {
    const res = await elevenLabsWebhookHandler.fetch(
      signedRequest({ rawHeader: "t=not-a-number,v0=abc" }),
    );
    expect(res.status).toBe(401);
    expect(mockFindAgencyForAgent).not.toHaveBeenCalled();
  });

  it("rejects timestamps outside the ±5 minute tolerance (401, replay protection)", async () => {
    // 10 minutes in the past — well outside the window.
    const tenMinAgo = Math.floor(Date.now() / 1000) - 10 * 60;
    const res = await elevenLabsWebhookHandler.fetch(
      signedRequest({ ts: tenMinAgo }),
    );
    expect(res.status).toBe(401);
    expect(mockFindAgencyForAgent).not.toHaveBeenCalled();
  });

  it("rejects signatures computed with the wrong secret (401, forgery protection)", async () => {
    const res = await elevenLabsWebhookHandler.fetch(
      signedRequest({ secret: "attacker-guessed-secret" }),
    );
    expect(res.status).toBe(401);
    expect(mockFindAgencyForAgent).not.toHaveBeenCalled();
  });

  it("rejects signatures over a tampered body (401, integrity check)", async () => {
    // Sign one body, send another. This is the canonical forgery
    // shape — the signature is well-formed, the timestamp is current,
    // the secret was the right one at sign time, but the body the
    // attacker put on the wire isn't the body that was signed.
    const ts = Math.floor(Date.now() / 1000);
    const signedBody = JSON.stringify(validBody);
    const sig = createHmac("sha256", VALID_SECRET)
      .update(`${ts}.${signedBody}`)
      .digest("hex");
    const tamperedBody = JSON.stringify({
      ...validBody,
      callId: "different-call-id-injected",
    });
    const req = new Request("http://localhost/webhooks/elevenlabs", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "ElevenLabs-Signature": `t=${ts},v0=${sig}`,
      },
      body: tamperedBody,
    });

    const res = await elevenLabsWebhookHandler.fetch(req);
    expect(res.status).toBe(401);
    expect(mockFindAgencyForAgent).not.toHaveBeenCalled();
  });
});

describe("elevenLabsWebhookHandler — missing-env operator misconfig", () => {
  let savedSecret: string | undefined;
  beforeEach(() => {
    savedSecret = process.env.ELEVENLABS_WEBHOOK_SECRET;
    delete process.env.ELEVENLABS_WEBHOOK_SECRET;
    vi.clearAllMocks();
    mockFindAgencyForAgent.mockResolvedValue(AGENCY_ID);
  });
  afterEach(() => {
    if (savedSecret !== undefined) {
      process.env.ELEVENLABS_WEBHOOK_SECRET = savedSecret;
    }
  });

  it("returns 500 (not 401) when ELEVENLABS_WEBHOOK_SECRET env var is unset", async () => {
    // Operator forgot to set the secret. Kept distinct from 401 so
    // the missing-config alarm (Block G follow-up) can fire — mirrors
    // authPlugin's JWT_SIGNING_KEY classification and the email
    // webhook's matching branch.
    const res = await elevenLabsWebhookHandler.fetch(signedRequest());
    expect(res.status).toBe(500);
    expect(mockFindAgencyForAgent).not.toHaveBeenCalled();
  });
});
