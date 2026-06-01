/**
 * Regression test for Block I-PR-B + I-PR-C:
 *
 * The two webhook handlers (`emailIngestionHandler`,
 * `elevenLabsWebhookHandler`) now throw `HttpError(401)` when the
 * inbound payload references an unknown recipient / agent. Each
 * handler MUST carry an `.onError` block that maps the HttpError to
 * its HTTP status code — otherwise the throw collapses to Elysia's
 * default 500, the upstream caller retries indefinitely, and the
 * `ElevenLabsWebhookFailures` alarm (Block G) trips for the wrong
 * reason.
 *
 * Mocks the resolver / repository so each handler's service code
 * deterministically takes the "unknown agency" branch; then drives
 * the handler via `handler.fetch(new Request(...))` and asserts the
 * response status is 401 (not 500). Mirrors the business-handler
 * version of this test at `handlerAuthErrorMapping.test.ts`.
 */
import { createHmac } from "node:crypto";
import { describe, it, expect, vi } from "vitest";
import type Elysia from "elysia";

// ── Mocks (must precede handler imports) ─────────────────────────────────────

// Resolver returns null → service throws HttpError(401) from the
// email wrapper. Hoisted-safe: the factory references no outer locals.
vi.mock("../ingestion/email/agencyResolver", () => ({
  resolveAgencyFromInboundEmail: vi.fn().mockResolvedValue(null),
}));

// AgentAgencyRepository.findAgencyForAgent returns null → service
// throws HttpError(401) from the ElevenLabs handler.
vi.mock("../auth/agentAgencyRepository", () => ({
  AgentAgencyRepository: vi.fn(() => ({
    findAgencyForAgent: vi.fn().mockResolvedValue(null),
  })),
}));

// db stub — both services build a getDb() but never reach it after the
// resolver throws.
vi.mock("@lettingsops/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@lettingsops/db")>();
  return { ...actual, getDb: vi.fn(() => ({})) };
});

// ── Handler imports (after mocks) ────────────────────────────────────────────

import { emailIngestionHandler } from "../ingestion/email/emailIngestionHandler";
import { elevenLabsWebhookHandler } from "../webhooks/elevenlabs/elevenLabsWebhookHandler";

// ── Test cases ───────────────────────────────────────────────────────────────

type HandlerCase = {
  name: string;
  handler: Elysia;
  buildRequest: () => Request;
};

// ── Per-case request builders ────────────────────────────────────────────────
//
// Each case constructs its own request so per-handler auth requirements
// (email shared secret, ElevenLabs HMAC) can be threaded in correctly.
// Without the right auth headers each handler would 401 on the auth
// check itself rather than the unknown-agency path this test is meant
// to exercise.

const EMAIL_BODY = {
  to: "unknown@nowhere.example",
  messageId: "msg-unknown-1",
  from: "tenant@example.com",
  subject: "Test",
  body: "Body",
  receivedAt: "2026-05-28T10:00:00.000Z",
};

const ELEVENLABS_BODY = {
  callId: "call-unknown-1",
  agentId: "agent_unknown_999",
  intent: "other",
  transcript: [],
};

function buildEmailRequest(): Request {
  return new Request("http://localhost/webhooks/email", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-webhook-secret":
        process.env.EMAIL_WEBHOOK_SECRET ??
        "test-webhook-secret-do-not-use-in-prod",
    },
    body: JSON.stringify(EMAIL_BODY),
  });
}

function buildElevenLabsRequest(): Request {
  const secret =
    process.env.ELEVENLABS_WEBHOOK_SECRET ??
    "test-elevenlabs-secret-do-not-use-in-prod";
  const body = JSON.stringify(ELEVENLABS_BODY);
  const ts = Math.floor(Date.now() / 1000);
  const sig = createHmac("sha256", secret)
    .update(`${ts}.${body}`)
    .digest("hex");
  return new Request("http://localhost/webhooks/elevenlabs", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "ElevenLabs-Signature": `t=${ts},v0=${sig}`,
    },
    body,
  });
}

const cases: HandlerCase[] = [
  {
    name: "emailIngestionHandler — unknown recipient → 401",
    handler: emailIngestionHandler as unknown as Elysia,
    buildRequest: buildEmailRequest,
  },
  {
    name: "elevenLabsWebhookHandler — unknown agentId → 401",
    handler: elevenLabsWebhookHandler as unknown as Elysia,
    buildRequest: buildElevenLabsRequest,
  },
];

describe("webhook handlers .onError maps HttpError(401) → 401", () => {
  for (const c of cases) {
    it(c.name, async () => {
      const res = await c.handler.fetch(c.buildRequest());

      expect(res.status).toBe(401);
      const body = (await res.json()) as { error?: string };
      expect(body.error).toBeTruthy();
    });
  }
});
