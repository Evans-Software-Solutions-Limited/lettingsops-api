import Elysia, { t } from "elysia";
import { EmailIngestionService } from "./emailIngestionService";

/**
 * Webhook endpoint — called by email forwarder (Gmail/Outlook webhook or IMAP bridge).
 * Idempotent: duplicate messageId is safely ignored.
 */
export const emailIngestionHandler = new Elysia()
  .use(EmailIngestionService)
  .post(
    "/webhooks/email",
    async (ctx) => {
      return ctx.emailIngestionService.processEmail(ctx.body);
    },
    {
      body: t.Object({
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
