import Elysia, { t } from "elysia";
import { LeadsListService } from "./leadsListService";

export const leadsListHandler = new Elysia().use(LeadsListService).get(
  "/leads",
  async (ctx) => {
    return ctx.leadsListService.listLeads(ctx.query);
  },
  {
    query: t.Object({
      status: t.Optional(t.String()),
      propertyRef: t.Optional(t.String()),
      page: t.Optional(t.Numeric()),
      limit: t.Optional(t.Numeric()),
    }),
    response: {
      200: t.Object({
        leads: t.Array(
          t.Object({
            id: t.String(),
            name: t.String(),
            email: t.String(),
            status: t.String(),
            source: t.String(),
            score: t.Optional(t.Number()),
            scoreCategory: t.Optional(t.String()),
            createdAt: t.String(),
          }),
        ),
        total: t.Number(),
        page: t.Number(),
        limit: t.Number(),
      }),
    },
  },
);
