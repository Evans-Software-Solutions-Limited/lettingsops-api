import Elysia, { t } from "elysia";
import { ElevenLabsWebhookService } from "./elevenLabsWebhookService";

export const elevenLabsWebhookHandler = new Elysia()
  .use(ElevenLabsWebhookService)
  .post(
    "/webhooks/elevenlabs",
    async (ctx) => {
      return ctx.elevenLabsWebhookService.handleWebhook(ctx.body);
    },
    {
      body: t.Object({
        callId: t.String(),
        agentId: t.String(),
        intent: t.Union([
          t.Literal("viewing_enquiry"),
          t.Literal("maintenance"),
          t.Literal("rent_query"),
          t.Literal("other"),
        ]),
        extractedFields: t.Optional(
          t.Object({
            name: t.Optional(t.String()),
            email: t.Optional(t.String()),
            phone: t.Optional(t.String()),
            propertyRef: t.Optional(t.String()),
            moveInDate: t.Optional(t.String()),
          }),
        ),
        transcript: t.Optional(
          t.Array(
            t.Object({
              role: t.Union([t.Literal("agent"), t.Literal("user")]),
              message: t.String(),
              timestamp: t.String(),
            }),
          ),
        ),
        callDurationSeconds: t.Optional(t.Number()),
      }),
      response: {
        200: t.Object({
          success: t.Boolean(),
          leadId: t.String(),
        }),
      },
    },
  );
