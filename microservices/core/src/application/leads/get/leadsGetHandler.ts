import Elysia, { t } from "elysia";
import { LeadsGetService } from "./leadsGetService";

export const leadsGetHandler = new Elysia().use(LeadsGetService).get(
  "/leads/:id",
  async (ctx) => {
    const lead = await ctx.leadsGetService.getLead(ctx.params.id);
    return lead;
  },
  {
    params: t.Object({ id: t.String() }),
    response: {
      200: t.Object({
        id: t.String(),
        name: t.String(),
        email: t.String(),
        phone: t.Optional(t.String()),
        propertyRef: t.Optional(t.String()),
        status: t.String(),
        source: t.String(),
        score: t.Optional(t.Number()),
        scoreCategory: t.Optional(t.String()),
        createdAt: t.String(),
        updatedAt: t.String(),
      }),
    },
  },
);
