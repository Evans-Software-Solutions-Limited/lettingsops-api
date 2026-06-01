import Elysia, { t } from "elysia";
import { logger } from "@lettingsops/api-utils/logger";
import { HttpError } from "../../auth/httpError";
import { EmailIngestionService } from "./emailIngestionService";

/**
 * Webhook endpoint — called by email forwarder (Gmail/Outlook webhook or
 * IMAP bridge). Idempotent: duplicate messageId is safely ignored.
 *
 * **Authentication (Block I-PR-B+C 2nd-sweep fix):** every request MUST
 * carry an `x-webhook-secret` header whose value matches the
 * `EMAIL_WEBHOOK_SECRET` env var (set via the
 * `LettingsOpsEmailWebhookSecret` SST secret). Without this guard an
 * attacker who knows an agency's inbound address could inject leads
 * under that tenant's id — the resolver now maps the supplied `to` to
 * a real `agency.id`, so forged leads would land in the target
 * agency's pipeline indistinguishable from legitimate ones. See
 * Inspector Brad's HIGH finding on PR #41 and the broader webhook
 * policy in `application/webhooks/CLAUDE.md`.
 *
 * **Block I contract change (I-PR-B):** the body requires `to` — the
 * inbound recipient address — so the wrapper can resolve the owning
 * agency. An unknown recipient throws `HttpError(401)`, mapped to a
 * 401 response by the `.onError` block below.
 */

/**
 * Validate the `x-webhook-secret` header against `EMAIL_WEBHOOK_SECRET`.
 * Throws `HttpError(500)` when the env is missing (operator misconfig;
 * mirrors the `JWT_SIGNING_KEY` pattern in `authPlugin.ts`) and
 * `HttpError(401)` when the header is missing or doesn't match.
 *
 * Factored out so the guard can be unit-tested without spinning up the
 * Elysia app for every case.
 */
export function requireEmailWebhookSecret(headers: Headers): void {
  const expected = process.env.EMAIL_WEBHOOK_SECRET;
  if (!expected) {
    logger.error("EMAIL_WEBHOOK_SECRET env var not configured");
    throw new HttpError(500, "Webhook secret not configured");
  }
  const supplied = headers.get("x-webhook-secret");
  if (!supplied || supplied !== expected) {
    logger.warn("Email webhook secret mismatch", {
      reason: supplied ? "wrong_secret" : "missing_header",
    });
    throw new HttpError(401, "Invalid webhook secret");
  }
}

export const emailIngestionHandler = new Elysia()
  // Map HttpError to its HTTP status code so an "unknown recipient"
  // 401 from the service surfaces correctly instead of collapsing to
  // Elysia's default 500. Same pattern as the 7 business handlers
  // (see e.g. leadsCreateHandler); planned for promotion to a global
  // hook in api.ts under Block G's follow-up.
  .onError(({ error, set }) => {
    if (error instanceof HttpError) {
      set.status = error.status;
      return { error: error.message };
    }
  })
  // Reject unauthenticated callers BEFORE schema validation runs so we
  // don't leak schema-error responses to unauthorised probes.
  .onRequest(({ request }) => {
    requireEmailWebhookSecret(request.headers);
  })
  .use(EmailIngestionService)
  .post(
    "/webhooks/email",
    async (ctx) => {
      return ctx.emailIngestionService.processEmail(ctx.body);
    },
    {
      body: t.Object({
        /** Inbound recipient address — used to resolve the owning agency. */
        to: t.String({ format: "email" }),
        messageId: t.String(),
        from: t.String(),
        fromName: t.Optional(t.String()),
        subject: t.String(),
        body: t.String(),
        receivedAt: t.String(),
        propertyRef: t.Optional(t.String()),
      }),
      response: {
        200: t.Object({
          leadId: t.String(),
          action: t.Union([
            t.Literal("CREATED"),
            t.Literal("MERGED"),
            t.Literal("IGNORED"),
          ]),
        }),
      },
    },
  );
