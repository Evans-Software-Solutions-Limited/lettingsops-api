import Elysia, { t } from "elysia";
import { auth } from "../../auth/authPlugin";
import { HttpError } from "../../auth/httpError";
import { ANY_AGENCY } from "../../repositories/tenantScopedRepository";
import { LeadsCommunicationService } from "./leadsCommunicationService";

export const leadsCommunicationHandler = new Elysia()
  .use(auth)
  // Map HttpError to its HTTP status code. Until a global onError hook is
  // wired in api.ts (planned for Block G), each handler that can throw
  // HttpError must carry its own mapping so callers get 401/403/404 rather
  // than the Elysia default 500. Auth failures from `.use(auth)` throw
  // HttpError(401) — without this mapping they collapse to 500.
  .onError(({ error, set }) => {
    if (error instanceof HttpError) {
      set.status = error.status;
      return { error: error.message };
    }
  })
  .use(LeadsCommunicationService)
  .get(
    "/leads/:id/communication",
    async (ctx) => {
      return ctx.leadsCommunicationService.getCommunication(
        ctx.auth.agencyId ?? ANY_AGENCY,
        ctx.params.id,
      );
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
