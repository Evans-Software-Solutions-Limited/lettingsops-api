/**
 * Request-scoped context, backed by AsyncLocalStorage.
 *
 * Lambda + Elysia each invocation runs inside an `als.run(store, fn)` scope
 * seeded by the Elysia plugin (see `elysiaPlugin.ts`). The logger reads the
 * current store via `getRequestContext()` so call sites don't have to thread
 * `requestId` / `agencyId` through every function call.
 *
 * `getRequestContext()` returns `undefined` outside a request scope (cold-start
 * code, Lambda init, unit tests without a scope) — the logger treats that as
 * "no correlation fields", not as an error.
 */
import { AsyncLocalStorage } from "node:async_hooks";

export interface RequestContext {
  requestId?: string;
  agencyId?: string;
  estateAgentId?: string;
  /** Free-form additional fields. Logger merges these into every log line. */
  [key: string]: unknown;
}

const als = new AsyncLocalStorage<RequestContext>();

/**
 * Run `fn` with `ctx` as the active request context. Any logger call inside
 * `fn` (or any async work it kicks off) will see the fields from `ctx`. The
 * scope closes when `fn` returns or throws.
 *
 * Prefer this for synchronous wrappers around a whole request — e.g. the
 * Lambda handler entry point.
 */
export function runWithRequestContext<T>(ctx: RequestContext, fn: () => T): T {
  return als.run(ctx, fn);
}

/**
 * Permanently set the request context for the current async execution chain.
 * Unlike `runWithRequestContext`, this does not require a wrapping callback —
 * the store is set on the current execution context and inherited by any
 * subsequent awaits / microtasks until the chain unwinds.
 *
 * Use this inside Elysia's `onRequest` hook, where the framework runs the
 * rest of the pipeline as awaited continuations off the same execution
 * context — we cannot wrap that pipeline in a callback from a hook, so we
 * "enter with" instead.
 */
export function enterRequestContext(ctx: RequestContext): void {
  als.enterWith(ctx);
}

/**
 * Mutate the active request context in place — useful when later middleware
 * resolves the agency (e.g. the auth plugin) and wants to enrich the scope
 * so subsequent logs include `agencyId`.
 *
 * No-op when called outside a request scope.
 */
export function updateRequestContext(patch: Partial<RequestContext>): void {
  const store = als.getStore();
  if (!store) return;
  Object.assign(store, patch);
}

/** Read the current request context. Returns `undefined` outside a scope. */
export function getRequestContext(): RequestContext | undefined {
  return als.getStore();
}
