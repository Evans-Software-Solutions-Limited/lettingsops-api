import Elysia, { t } from "elysia";
import { auth } from "../../auth/authPlugin";
import { HttpError } from "../../auth/httpError";
import { ANY_AGENCY } from "../../repositories/tenantScopedRepository";
import { ViewingSlotsService } from "./viewingSlotsService";

export const viewingSlotsHandler = new Elysia()
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
  .use(ViewingSlotsService)
  .get(
    "/viewings/slots",
    async (ctx) => {
      return ctx.viewingSlotsService.getAvailableSlots(
        ctx.auth.agencyId ?? ANY_AGENCY,
        ctx.query,
      );
    },
    {
      query: t.Object({
        propertyRef: t.String(),
        from: t.String({ format: "date" }),
        to: t.String({ format: "date" }),
      }),
      response: {
        200: t.Object({
          slots: t.Array(
            t.Object({
              id: t.String(),
              startsAt: t.String(),
              endsAt: t.String(),
              available: t.Boolean(),
            }),
          ),
        }),
      },
    },
  );
