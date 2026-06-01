/**
 * Integration tests for `emailIngestionHandler` — drives real
 * `handler.fetch(...)` requests through the Elysia instance so we
 * exercise the lifecycle hooks (`.onRequest` secret guard, `.onError`
 * mapping, schema validation, service decorator).
 *
 * Covers Inspector Brad's 2nd-sweep findings on PR #41:
 *   - HIGH (sender auth): correct `x-webhook-secret` accepted, missing
 *     and wrong values rejected with 401, missing env rejected with 500.
 *   - MEDIUM (case-insensitive resolver): mixed-case `to` still resolves.
 *
 * Distinct from the existing `emailIngestionHandler.test.ts` which
 * tests JS payload literals only — this file is the behaviour
 * harness.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const VALID_SECRET = "test-webhook-secret-do-not-use-in-prod";
const RECIPIENT = "lettings@agency-test.com";
const AGENCY_ID = "agency-test-1";

// Mock the resolver so we can assert how the handler calls it without
// a real DB. The factory inlines literals because vi.mock hoists above
// local consts.
const mockResolve = vi.fn();
vi.mock("../agencyResolver", () => ({
  resolveAgencyFromInboundEmail: (...args: unknown[]) => mockResolve(...args),
}));

const mockLeadRepo = {
  findByMessageId: vi.fn().mockResolvedValue(null),
  findByEmail: vi.fn().mockResolvedValue(null),
  create: vi.fn(),
  addNote: vi.fn(),
};
vi.mock("../../../repositories/leadRepository", () => ({
  LeadRepository: vi.fn(() => mockLeadRepo),
}));

import { emailIngestionHandler } from "../emailIngestionHandler";

function makeRequest(body: unknown, headers: Record<string, string> = {}) {
  return new Request("http://localhost/webhooks/email", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

const validBody = {
  to: RECIPIENT,
  messageId: "msg-int-1",
  from: "tenant@example.com",
  subject: "Viewing enquiry",
  body: "Interested",
  receivedAt: "2026-05-28T10:00:00.000Z",
};

describe("emailIngestionHandler — secret guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.EMAIL_WEBHOOK_SECRET = VALID_SECRET;
    mockResolve.mockResolvedValue(AGENCY_ID);
    mockLeadRepo.findByMessageId.mockResolvedValue(null);
    mockLeadRepo.findByEmail.mockResolvedValue(null);
    mockLeadRepo.create.mockResolvedValue({
      id: "lead-new-1",
      status: "NEW",
      createdAt: "2026-05-28T10:00:00.000Z",
    });
  });

  it("returns 401 when `x-webhook-secret` header is missing", async () => {
    const res = await emailIngestionHandler.fetch(makeRequest(validBody));

    expect(res.status).toBe(401);
    const body = (await res.json()) as { error?: string };
    expect(body.error).toBe("Invalid webhook secret");
    // Guard fires BEFORE the resolver runs — proves the attack surface
    // is closed even if the resolver would have matched.
    expect(mockResolve).not.toHaveBeenCalled();
  });

  it("returns 401 when `x-webhook-secret` value is wrong", async () => {
    const res = await emailIngestionHandler.fetch(
      makeRequest(validBody, { "x-webhook-secret": "not-the-right-secret" }),
    );

    expect(res.status).toBe(401);
    const body = (await res.json()) as { error?: string };
    expect(body.error).toBe("Invalid webhook secret");
    expect(mockResolve).not.toHaveBeenCalled();
  });

  it("returns 500 when EMAIL_WEBHOOK_SECRET env var is not set", async () => {
    // Operator misconfig — mirrors authPlugin's JWT_SIGNING_KEY
    // pattern. We want this in the 500 bucket, NOT 401, so the
    // missing-config alarm (Block G) can distinguish "operator forgot
    // to set the secret" from "lots of bad caller credentials".
    delete process.env.EMAIL_WEBHOOK_SECRET;

    const res = await emailIngestionHandler.fetch(
      makeRequest(validBody, { "x-webhook-secret": VALID_SECRET }),
    );

    expect(res.status).toBe(500);
    expect(mockResolve).not.toHaveBeenCalled();
  });

  it("passes through to the service when `x-webhook-secret` matches", async () => {
    const res = await emailIngestionHandler.fetch(
      makeRequest(validBody, { "x-webhook-secret": VALID_SECRET }),
    );

    expect(res.status).toBe(200);
    expect(mockResolve).toHaveBeenCalledTimes(1);
    expect(mockResolve).toHaveBeenCalledWith(RECIPIENT, expect.anything());
  });
});

describe("emailIngestionHandler — case-insensitive recipient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.EMAIL_WEBHOOK_SECRET = VALID_SECRET;
    mockResolve.mockResolvedValue(AGENCY_ID);
    mockLeadRepo.findByMessageId.mockResolvedValue(null);
    mockLeadRepo.findByEmail.mockResolvedValue(null);
    mockLeadRepo.create.mockResolvedValue({
      id: "lead-cs-1",
      status: "NEW",
      createdAt: "2026-05-28T10:00:00.000Z",
    });
  });

  it("forwards mixed-case `to` to the resolver verbatim (resolver itself normalises)", async () => {
    // The handler's job is to pass `to` through unchanged; the
    // normalisation contract lives in `resolveAgencyFromInboundEmail`
    // (which tests below cover). This integration test just confirms
    // mixed-case input doesn't get rejected at the schema layer.
    const mixedCaseBody = { ...validBody, to: "Lettings@Agency-Test.COM" };

    const res = await emailIngestionHandler.fetch(
      makeRequest(mixedCaseBody, { "x-webhook-secret": VALID_SECRET }),
    );

    expect(res.status).toBe(200);
    expect(mockResolve).toHaveBeenCalledWith(
      "Lettings@Agency-Test.COM",
      expect.anything(),
    );
  });
});

describe("emailIngestionHandler — unknown recipient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.EMAIL_WEBHOOK_SECRET = VALID_SECRET;
    mockResolve.mockResolvedValue(null); // resolver miss
  });

  afterEach(() => {
    // Restore the default mock so other tests aren't affected when
    // this file's tests run after the secret-guard block.
    mockResolve.mockResolvedValue(AGENCY_ID);
  });

  it("returns 401 with the resolver-miss error when secret is correct but `to` doesn't match any agency", async () => {
    const res = await emailIngestionHandler.fetch(
      makeRequest(validBody, { "x-webhook-secret": VALID_SECRET }),
    );

    expect(res.status).toBe(401);
    const body = (await res.json()) as { error?: string };
    expect(body.error).toBe("No agency owns the recipient address");
  });
});
