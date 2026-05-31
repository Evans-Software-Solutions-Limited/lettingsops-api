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
  path: string;
  body: unknown;
};

const cases: HandlerCase[] = [
  {
    name: "emailIngestionHandler — unknown recipient → 401",
    handler: emailIngestionHandler as unknown as Elysia,
    path: "/webhooks/email",
    body: {
      to: "unknown@nowhere.example",
      messageId: "msg-unknown-1",
      from: "tenant@example.com",
      subject: "Test",
      body: "Body",
      receivedAt: "2026-05-28T10:00:00.000Z",
    },
  },
  {
    name: "elevenLabsWebhookHandler — unknown agentId → 401",
    handler: elevenLabsWebhookHandler as unknown as Elysia,
    path: "/webhooks/elevenlabs",
    body: {
      callId: "call-unknown-1",
      agentId: "agent_unknown_999",
      intent: "other",
      transcript: [],
    },
  },
];

describe("webhook handlers .onError maps HttpError(401) → 401", () => {
  for (const c of cases) {
    it(c.name, async () => {
      const req = new Request(`http://localhost${c.path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(c.body),
      });

      const res = await c.handler.fetch(req);

      expect(res.status).toBe(401);
      const body = (await res.json()) as { error?: string };
      expect(body.error).toBeTruthy();
    });
  }
});
