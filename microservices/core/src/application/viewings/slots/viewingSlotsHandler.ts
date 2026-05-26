import Elysia, { t } from "elysia";
import { auth } from "../../auth/authPlugin";
import { ANY_AGENCY } from "../../repositories/tenantScopedRepository";
import { ViewingSlotsService } from "./viewingSlotsService";

export const viewingSlotsHandler = new Elysia()
  .use(auth)
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
