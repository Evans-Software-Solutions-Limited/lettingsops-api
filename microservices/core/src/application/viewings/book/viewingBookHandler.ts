import Elysia, { t } from "elysia";
import { auth } from "../../auth/authPlugin";
import { ANY_AGENCY } from "../../repositories/tenantScopedRepository";
import { ViewingBookService } from "./viewingBookService";

export const viewingBookHandler = new Elysia()
  .use(auth)
  .use(ViewingBookService)
  .post(
    "/viewings/book",
    async (ctx) => {
      return ctx.viewingBookService.bookViewing(
        ctx.auth.agencyId ?? ANY_AGENCY,
        ctx.body,
      );
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
