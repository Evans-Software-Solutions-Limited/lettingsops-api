import Elysia, { t } from "elysia";
import { LeadsCommunicationService } from "./leadsCommunicationService";

export const leadsCommunicationHandler = new Elysia()
  .use(LeadsCommunicationService)
  .get(
    "/leads/:id/communication",
    async (ctx) => {
      return ctx.leadsCommunicationService.getCommunication(ctx.params.id);
    },
    {
      params: t.Object({ id: t.String() }),
      response: {
        200: t.Object({
          leadId: t.String(),
          communications: t.Array(
            t.Object({
              id: t.String(),
              source: t.String(),
              direction: t.Optional(t.String()),
              subject: t.Optional(t.String()),
              body: t.Optional(t.String()),
              receivedAt: t.String(),
              transcript: t.Optional(
                t.Array(
                  t.Object({
                    role: t.String(),
                    message: t.String(),
                    timestamp: t.String(),
                  }),
                ),
              ),
            }),
          ),
        }),
      },
    },
  );
