/**
 * Format a thrown value into a structured shape that's safe to log.
 *
 * The PII scrub in this module is **key-based** — it does not inspect string
 * values for tenant emails / phones / addresses. That means raw error
 * messages and stack traces cannot be logged safely under generic keys
 * like `error` or `stack`, because real-world error messages routinely
 * embed PII:
 *
 * - SES MessageRejected in sandbox: "Email address is not verified. The
 *   following identities failed the check in region X: alice@example.com"
 * - Postgres unique-constraint violation via Drizzle: "DETAIL: Key
 *   (email)=(alice@example.com) already exists."
 * - `error.stack` begins with `${name}: ${message}` and carries the same
 *   PII a second time.
 *
 * `formatError()` captures the failure shape (name + code + statusCode)
 * without the message string. That's enough to triage in CloudWatch:
 * combine `errorName`/`errorCode` with the surrounding `requestId` /
 * `agencyId` to pinpoint the call site, then drill into the structured
 * context fields for the rest.
 *
 * Use this helper in every catch block before passing the result to
 * `logger.error`. The lint rule for "no raw error in logger.error" can
 * be added once Block D's auth refactor has settled.
 */
export interface FormattedError {
  errorName: string;
  errorCode?: string;
  errorStatusCode?: number;
}

export function formatError(err: unknown): FormattedError {
  if (err instanceof Error) {
    // AWS SDK errors carry `name`, `$metadata.httpStatusCode`, and
    // sometimes a string `Code`. Postgres errors via Drizzle expose the
    // SQLSTATE via `code`. Generic Errors only have `name`. We pull the
    // common shape and skip the message/stack entirely.
    const e = err as Error & {
      code?: unknown;
      statusCode?: unknown;
      $metadata?: { httpStatusCode?: unknown };
    };
    return {
      errorName: err.name,
      errorCode: typeof e.code === "string" ? e.code : undefined,
      errorStatusCode:
        typeof e.statusCode === "number"
          ? e.statusCode
          : typeof e.$metadata?.httpStatusCode === "number"
            ? e.$metadata.httpStatusCode
            : undefined,
    };
  }
  // Non-Error throws: strings, numbers, undefined. We can't introspect a
  // structured shape — fall back to a coarse "Unknown" classification so
  // CloudWatch queries still group these consistently.
  return { errorName: "Unknown" };
}
