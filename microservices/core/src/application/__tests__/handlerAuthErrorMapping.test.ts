/**
 * Regression test for Inspector Brad's 3rd-sweep HIGH finding (PR #37):
 *
 * Every handler that mounts `.use(auth)` must carry an `.onError` block that
 * maps `HttpError` to its HTTP status code, otherwise an auth failure (e.g.
 * a malformed `Authorization` header in soft mode, or any missing creds once
 * F4 flips `AUTH_ENFORCED=true`) collapses to Elysia's default 500 instead of
 * the intended 401/403.
 *
 * The auth plugin is mocked to throw `HttpError(401, "Invalid authentication")`
 * from `.derive` — mirroring what `resolveAuth` does on bad creds. The test
 * then drives each handler with `handler.fetch(new Request(...))` and asserts
 * the response status is 401 (not 500) and the body carries the expected
 * `{ error }` envelope.
 *
 * If a future handler is added under `.use(auth)` without the same `.onError`
 * mapping, add a case below and watch this test fail.
 */
import { describe, it, expect } from "vitest";
import { vi } from "vitest";
import type Elysia from "elysia";

// ── Mocks (must precede handler imports) ─────────────────────────────────────

vi.mock("@lettingsops/db", () => ({ getDb: vi.fn(() => ({})) }));

vi.mock("../auth/authPlugin", async () => {
  const { default: Elysia } = await import("elysia");
  const { HttpError } = await import("../auth/httpError");
  return {
    // Replace the real auth plugin with one whose `.derive` always throws
    // HttpError(401) — the same shape `resolveAuth` produces for bad creds.
    auth: new Elysia({ name: "auth" }).derive({ as: "scoped" }, () => {
      throw new HttpError(401, "Invalid authentication");
    }),
  };
});

// The real auth plugin pulls in ApiKeyRepository; mock so the import graph
// stays stable even though the mocked auth above never calls it.
vi.mock("../auth/apiKeyRepository", () => ({
  ApiKeyRepository: vi.fn(() => ({
    findActive: vi.fn().mockResolvedValue(null),
  })),
}));

// ── Handler imports (after mocks) ────────────────────────────────────────────

import { leadsCreateHandler } from "../leads/create/leadsCreateHandler";
import { leadsGetHandler } from "../leads/get/leadsGetHandler";
import { leadsListHandler } from "../leads/list/leadsListHandler";
import { leadsCommunicationHandler } from "../leads/communication/leadsCommunicationHandler";
import { viewingBookHandler } from "../viewings/book/viewingBookHandler";
import { viewingSlotsHandler } from "../viewings/slots/viewingSlotsHandler";
import { qualificationSubmitHandler } from "../qualification/submit/qualificationSubmitHandler";

// ── Test cases ───────────────────────────────────────────────────────────────

type HandlerCase = {
  name: string;
  handler: Elysia;
  method: "GET" | "POST";
  path: string;
  body?: unknown;
};

const cases: HandlerCase[] = [
  {
    name: "leadsCreateHandler",
    handler: leadsCreateHandler as unknown as Elysia,
    method: "POST",
    path: "/leads",
    body: { name: "Test", email: "test@example.com" },
  },
  {
    name: "leadsListHandler",
    handler: leadsListHandler as unknown as Elysia,
    method: "GET",
    path: "/leads",
  },
  {
    name: "leadsGetHandler",
    handler: leadsGetHandler as unknown as Elysia,
    method: "GET",
    path: "/leads/lead-uuid-1",
  },
  {
    name: "leadsCommunicationHandler",
    handler: leadsCommunicationHandler as unknown as Elysia,
    method: "GET",
    path: "/leads/lead-uuid-1/communication",
  },
  {
    name: "viewingBookHandler",
    handler: viewingBookHandler as unknown as Elysia,
    method: "POST",
    path: "/viewings/book",
    body: { leadId: "L", propertyRef: "P", slotId: "S" },
  },
  {
    name: "viewingSlotsHandler",
    handler: viewingSlotsHandler as unknown as Elysia,
    method: "GET",
    path: "/viewings/slots?propertyRef=P&from=2024-01-01&to=2024-01-31",
  },
  {
    name: "qualificationSubmitHandler",
    handler: qualificationSubmitHandler as unknown as Elysia,
    method: "POST",
    path: "/leads/lead-uuid-1/qualification",
    body: {
      moveInDate: "2024-06-01",
      occupants: 1,
      employmentStatus: "employed",
      incomeBand: "30k_50k",
      hasPets: false,
      viewingAvailability: [],
    },
  },
];

describe("handler .onError maps HttpError(401) → 401 (not Elysia default 500)", () => {
  for (const c of cases) {
    it(`${c.name}: ${c.method} ${c.path} returns 401 when auth throws HttpError(401)`, async () => {
      const req = new Request(`http://localhost${c.path}`, {
        method: c.method,
        headers: c.body
          ? { "Content-Type": "application/json" }
          : ({} as Record<string, string>),
        body: c.body !== undefined ? JSON.stringify(c.body) : undefined,
      });

      const res = await c.handler.fetch(req);

      // The critical assertion: 401 (mapped via .onError), not 500.
      expect(res.status).toBe(401);
      const body = (await res.json()) as { error?: string };
      expect(body.error).toBe("Invalid authentication");
    });
  }
});
