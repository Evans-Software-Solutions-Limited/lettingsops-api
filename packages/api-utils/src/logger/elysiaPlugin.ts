/**
 * Elysia plugin that seeds the request context for every incoming request.
 *
 * Reads `x-amzn-RequestId` from API Gateway (Lambda passes it through as a
 * header) and opens an AsyncLocalStorage scope before the rest of the route
 * pipeline runs. All `logger.*` calls inside the handler — including ones
 * triggered by awaited downstream calls — pick up the requestId
 * automatically, with no per-call threading.
 *
 * The scope is opened with `enterRequestContext()` (i.e. `als.enterWith`),
 * not `runWithRequestContext()`. Elysia's `onRequest` hook fires once per
 * request and returns; the rest of the pipeline runs as awaited
 * continuations off the same execution context, so the scope keeps flowing
 * via Node's `async_hooks` propagation.
 *
 * Outside the API Gateway path (local dev, tests) the header is missing —
 * the plugin generates a `req-…` id so single-request logs still correlate.
 */
import Elysia from "elysia";
import { enterRequestContext } from "./requestContext";

function randomRequestId(): string {
  // Crypto.randomUUID is available in Node 18+ and the Lambda runtime.
  // Fall back to a coarse timestamp+random if it's missing (test envs that
  // stub global `crypto`).
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (c?.randomUUID) return c.randomUUID();
  return `req-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export const requestContextPlugin = new Elysia({
  name: "request-context",
}).onRequest(({ request }) => {
  // Headers are case-insensitive in Fetch's Headers API, but read both
  // canonical and lowercase variants defensively — some test harnesses use
  // plain objects-as-headers that don't normalise.
  const requestId =
    request.headers.get("x-amzn-requestid") ??
    request.headers.get("x-amzn-RequestId") ??
    randomRequestId();

  enterRequestContext({ requestId });
});
