import Elysia, { t } from "elysia";
import { auth } from "../../auth/authPlugin";
import { HttpError } from "../../auth/httpError";
import { ViewingBookService } from "./viewingBookService";

export const viewingBookHandler = new Elysia()
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
  .use(ViewingBookService)
  .post(
    "/viewings/book",
    async (ctx) => {
      return ctx.viewingBookService.bookViewing(ctx.auth.agencyId, ctx.body);
    },
    {
      body: t.Object({
        leadId: t.String(),
        propertyRef: t.String(),
        slotId: t.String(),
      }),
      response: {
        200: t.Object({
          viewingId: t.String(),
          confirmedAt: t.String(),
          calendarEventId: t.Optional(t.String()),
        }),
      },
    },
  );
