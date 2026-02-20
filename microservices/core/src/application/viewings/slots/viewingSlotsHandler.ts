import Elysia, { t } from "elysia";
import { ViewingSlotsService } from "./viewingSlotsService";

export const viewingSlotsHandler = new Elysia().use(ViewingSlotsService).get(
  "/viewings/slots",
  async (ctx) => {
    return ctx.viewingSlotsService.getAvailableSlots(ctx.query);
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
