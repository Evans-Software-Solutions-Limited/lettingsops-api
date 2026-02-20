import Elysia, { t } from "elysia";
import { ViewingBookService } from "./viewingBookService";

export const viewingBookHandler = new Elysia()
  .use(ViewingBookService)
  .post(
    "/viewings/book",
    async (ctx) => {
      return ctx.viewingBookService.bookViewing(ctx.body);
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
