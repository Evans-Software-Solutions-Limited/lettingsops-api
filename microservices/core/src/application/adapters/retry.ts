/**
 * retryIntegrationCall — runs an outbound adapter call with bounded
 * in-process retry and a full audit trail in `integration_events`.
 *
 * Contract (spec §2.4):
 *   - Records one `integration_events` row up front (`pending`), then
 *     updates it after every attempt (`retrying` / `succeeded` /
 *     `failed_permanent`). The call ALWAYS lands a row.
 *   - On a retryable `IntegrationError`, backs off `1s → 5s → 30s`
 *     (three waits ⇒ up to four attempts).
 *   - A non-retryable failure short-circuits: no backoff, the event is
 *     marked `failed_permanent` immediately. "Non-retryable" means an
 *     `IntegrationError` with `retryable: false`, OR any non-
 *     `IntegrationError` throw (a plain `Error` is, by the adapters'
 *     convention, an unrecoverable bug/misconfig — burning 36s of
 *     backoff on it helps no one).
 *   - NEVER throws out of the caller. A CRM/calendar failure must not
 *     block lead creation, qualification, or booking. The outcome is
 *     returned as a discriminated result so a caller that *does* care
 *     (e.g. booking, where the calendar write gates the local write)
 *     can branch on `ok` — but the default is fire-and-forget.
 *
 * Why a result object rather than a thrown error: the audit row is the
 * durable signal (surfaced on the dashboard, spec §5); the return value
 * is the in-process convenience. Booking is the one hook point that
 * reads `ok` before persisting; every other hook point ignores it.
 *
 * LATENCY WARNING for Block F: the full schedule is 1+5+30 = 36s of
 * in-process sleep, which exceeds API Gateway's ~29s integration timeout.
 * Do NOT `await` a full retry on the synchronous request path — the
 * client gets a 504 while the retry runs on orphaned. Two safe shapes:
 *   - fire-and-forget: kick off the retry without awaiting (CRM push on
 *     lead-create / qualification — the local write already committed); or
 *   - if the result genuinely gates the response (booking reads `ok`),
 *     only the FIRST attempt should sit on the request path and longer
 *     retries belong to the async re-driver (spec §2.4, future SQS work).
 * The backoff schedule here is correct per §2.4; this is about where the
 * helper is called from, not the schedule itself.
 *
 * ABANDONED-`retrying` CAVEAT for dashboard consumers (spec §5): the
 * in-process `sleep` is not cancellable, and a Lambda container frozen
 * (or reaped) mid-backoff can leave a row stuck at `retrying` with no
 * process left to reconcile it to `succeeded` / `failed_permanent`.
 * Until the async re-driver lands, treat `retrying` rows older than the
 * max schedule (~40s) as presumed-abandoned rather than in-progress.
 *
 * Design: `.kiro/specs/02-crm-and-booking-adapters/design.md` §2.4.
 */
import { logger, formatError } from "@lettingsops/api-utils/logger";
import { IntegrationError } from "./integrationError";
import type {
  IntegrationEventsRepository,
  IntegrationStatus,
} from "../repositories/integrationEventsRepository";

/** Max length persisted to `integration_events.last_error`. */
const MAX_AUDIT_MESSAGE_LENGTH = 300;

// Coarse PII shapes scrubbed from audit messages as a backstop (see
// `sanitiseAuditMessage`). Deliberately conservative — over-redaction in
// an audit field is harmless; a leaked email/phone is not.
//
// EMAIL_RE is written WITHOUT an overlapping host quantifier
// (`[A-Za-z0-9-]+` segments separated by literal dots, not a single
// `[A-Za-z0-9.-]+\.` run) so it can't backtrack super-linearly. Belt and
// braces: `sanitiseAuditMessage` also truncates BEFORE scrubbing so the
// regex never sees more than MAX_AUDIT_MESSAGE_LENGTH chars regardless.
const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+/g;
const PHONE_RE = /\+?\d[\d\s().-]{7,}\d/g;

/**
 * Backoff schedule between attempts, in milliseconds (spec §2.4).
 * Length + 1 = the maximum number of attempts: attempt 1 runs
 * immediately, then a failure waits `BACKOFF_MS[0]` before attempt 2,
 * and so on. The final attempt has no trailing wait.
 */
export const BACKOFF_MS: readonly number[] = [1000, 5000, 30000];
export const MAX_ATTEMPTS = BACKOFF_MS.length + 1;

export interface RetryContext {
  /**
   * Tenant-scoped audit repository. The CALLER constructs it for the
   * acting agency (`new IntegrationEventsRepository(db, agencyId)`) — this
   * is intentional: the helper is agency-agnostic and trusts the repo's
   * scope, so Block F hook points own repo construction rather than the
   * helper inventing a second convention. A future SQS re-driver (§2.4)
   * reconstructs scope from the persisted `integration_events` row, not
   * from this `ctx`, so there's deliberately no `agencyId`/`db` here.
   */
  events: IntegrationEventsRepository;
  /** Entity this call acts on (leadId / viewingId), stored on the event row. */
  refId?: string;
}

export type RetryOutcome<T> =
  | { ok: true; value: T; attempts: number }
  | { ok: false; error: unknown; attempts: number };

/** Resolves after `ms` — isolated so tests can drive it with fake timers. */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryable(error: unknown): boolean {
  // Only an IntegrationError flagged retryable earns a backoff. Anything
  // else (plain Error, thrown string) is treated as permanent.
  return error instanceof IntegrationError && error.retryable;
}

/**
 * Truncate + scrub a string before it lands in `integration_events
 * .last_error`. The convention is that `IntegrationError.message` is
 * author-controlled and PII-free — but "by convention" is not a
 * guarantee, and a Block D adapter that interpolates a provider
 * response (`429: ${body}`) would otherwise write PII into an audit
 * row the dashboard renders. This backstop redacts obvious email /
 * phone shapes and caps length so a single bad message can't dump a
 * payload into the table. Inspector Brad HIGH finding (sweep 2).
 */
function sanitiseAuditMessage(message: string): string {
  // Truncate BEFORE scrubbing. The redaction regexes can backtrack on
  // adversarial input (a huge provider error body is exactly the trigger
  // this function exists for), so bounding the input to MAX first caps
  // the work at MAX² ops — microseconds — no matter the pattern. Scrubbing
  // after truncation, not before, is the load-bearing order here.
  const wasTruncated = message.length > MAX_AUDIT_MESSAGE_LENGTH;
  const scrubbed = (
    wasTruncated ? message.slice(0, MAX_AUDIT_MESSAGE_LENGTH) : message
  )
    .replace(EMAIL_RE, "[redacted-email]")
    .replace(PHONE_RE, "[redacted-phone]");

  // A replacement token can be longer than what it replaced, so the
  // scrubbed string may exceed MAX even after the pre-truncation; re-cap.
  // Append an ellipsis whenever any of the original was dropped.
  if (scrubbed.length <= MAX_AUDIT_MESSAGE_LENGTH) {
    return wasTruncated ? `${scrubbed}…` : scrubbed;
  }
  return `${scrubbed.slice(0, MAX_AUDIT_MESSAGE_LENGTH)}…`;
}

/**
 * Best-effort message for the audit row's `last_error`. For an
 * `IntegrationError` we persist the (sanitised) author message; for
 * anything else we fall back to the classified error name so we never
 * write a raw provider message (which may carry PII) into the table.
 */
function auditMessage(error: unknown): string {
  if (error instanceof IntegrationError) {
    return sanitiseAuditMessage(error.message);
  }
  return formatError(error).errorName;
}

export async function retryIntegrationCall<T>(
  call: string,
  fn: (attempt: number) => Promise<T>,
  ctx: RetryContext,
): Promise<RetryOutcome<T>> {
  // Create the audit row up front. If even this fails (DB down), we log
  // and still run `fn` — the integration attempt itself must not be
  // gated on the audit log being writable. `eventId` stays undefined and
  // every later status write becomes a no-op via `recordStatus`.
  let eventId: string | undefined;
  try {
    const event = await ctx.events.create({
      call,
      refId: ctx.refId,
      status: "pending",
    });
    eventId = event.id;
  } catch (err) {
    logger.warn("retryIntegrationCall: failed to create integration_event", {
      call,
      refId: ctx.refId,
      ...formatError(err),
    });
  }

  // Status writes never affect control flow — a flaky audit log must not
  // turn a successful CRM push into a reported failure, nor vice versa.
  const recordStatus = async (
    // Sourced from the repo's own union so a status rename can't drift —
    // `"pending"` is excluded because it's only ever the create-time state.
    status: Exclude<IntegrationStatus, "pending">,
    attempts: number,
    lastError?: string,
  ): Promise<void> => {
    if (eventId === undefined) return;
    try {
      await ctx.events.updateStatus(eventId, {
        status,
        attempts,
        lastError: lastError ?? null,
      });
    } catch (err) {
      logger.error("retryIntegrationCall: failed to update integration_event", {
        call,
        eventId,
        status,
        ...formatError(err),
      });
    }
  };

  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const value = await fn(attempt);
      await recordStatus("succeeded", attempt);
      return { ok: true, value, attempts: attempt };
    } catch (err) {
      lastError = err;
      const permanent = !isRetryable(err);
      const isFinalAttempt = attempt === MAX_ATTEMPTS;

      if (permanent || isFinalAttempt) {
        await recordStatus("failed_permanent", attempt, auditMessage(err));
        logger.error("retryIntegrationCall: integration call failed", {
          call,
          refId: ctx.refId,
          attempts: attempt,
          permanent,
          ...formatError(err),
        });
        return { ok: false, error: err, attempts: attempt };
      }

      // Retryable and attempts remain — record the interim state, back
      // off, and try again. `BACKOFF_MS[attempt - 1]` is always defined
      // here because `isFinalAttempt` guards the last index.
      await recordStatus("retrying", attempt, auditMessage(err));
      await sleep(BACKOFF_MS[attempt - 1]);
    }
  }

  // Unreachable: the loop returns on the final attempt. Kept as a
  // defensive backstop so a future change to the loop bounds can't fall
  // through to `undefined`.
  return { ok: false, error: lastError, attempts: MAX_ATTEMPTS };
}
