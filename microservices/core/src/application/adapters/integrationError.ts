/**
 * IntegrationError — typed exception for outbound adapter failures.
 *
 * Carries enough context for the retry helper (Block C of spec-02) to
 * decide whether to back off and retry, and for the
 * `integration_events` audit row to record the failure shape:
 *
 *   - `call`     — the named operation, e.g. `"crm.pushLead"` or
 *                  `"slotSource.bookSlot"`. Persisted into the event
 *                  row so the dashboard can filter by call type.
 *   - `attempt`  — the 1-indexed attempt number this error came from.
 *                  Lets the retry helper enforce a max-attempts cap
 *                  without re-counting from the throw site.
 *   - `retryable` — `true` (default) for transient failures the helper
 *                  should retry against the backoff schedule; `false`
 *                  for permanent ones (e.g. auth misconfig, malformed
 *                  request) so the helper marks the event
 *                  `failed-permanent` immediately rather than burning
 *                  retries on a hopeless call.
 *
 * Adapters throw plain `Error` for failures that are neither caller-
 * recoverable nor worth recording — those bubble up to the route
 * handler's `.onError` mapper as 500s.
 *
 * Design: `.kiro/specs/02-crm-and-booking-adapters/design.md` §2.4.
 */
export interface IntegrationErrorOptions {
  /**
   * Named operation, e.g. `"crm.pushLead"`. Convention: `<port>.<method>`.
   * Persisted verbatim into `integration_events.call` so the
   * dashboard can group by it — keep the value PII-free.
   */
  call: string;
  /** 1-indexed attempt number this error was thrown from. */
  attempt: number;
  /**
   * Whether the retry helper should keep going against the backoff
   * schedule. Defaults to `true` (transient). Set `false` for
   * permanent failures the helper shouldn't waste attempts on.
   */
  retryable?: boolean;
  /**
   * Optional cause attached for log/debug context. Not persisted into
   * `integration_events` — the helper records `error.message` instead
   * to keep PII out of the audit table.
   */
  cause?: unknown;
}

export class IntegrationError extends Error {
  override name = "IntegrationError";
  readonly call: string;
  readonly attempt: number;
  readonly retryable: boolean;

  constructor(message: string, opts: IntegrationErrorOptions) {
    // Stash `cause` on the Error itself so `formatError`-style helpers
    // can walk it. We deliberately don't expose it as an own readonly
    // field — the standard ES2022 `cause` slot covers it.
    super(
      message,
      opts.cause !== undefined ? { cause: opts.cause } : undefined,
    );
    this.call = opts.call;
    this.attempt = opts.attempt;
    this.retryable = opts.retryable ?? true;
  }
}
