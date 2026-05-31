import Elysia, { t } from "elysia";
import { HttpError } from "../../auth/httpError";
import { EmailIngestionService } from "./emailIngestionService";

/**
 * Webhook endpoint — called by email forwarder (Gmail/Outlook webhook or
 * IMAP bridge). Idempotent: duplicate messageId is safely ignored.
 *
 * **Block I contract change (I-PR-B):** the body now requires `to` —
 * the inbound recipient address — so the wrapper can resolve the
 * owning agency. An unknown recipient throws `HttpError(401)`, mapped
 * to a 401 response by the `.onError` block below.
 */
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
