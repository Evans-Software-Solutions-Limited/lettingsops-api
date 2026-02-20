import Elysia, { t } from "elysia";
import { LeadsCreateService } from "./leadsCreateService";

export const leadsCreateHandler = new Elysia()
  .use(LeadsCreateService)
  .post(
    "/leads",
    async (ctx) => {
      const lead = await ctx.leadsCreateService.createLead(ctx.body);
      return lead;
    },
    {
      body: t.Object({
        name: t.String(),
        email: t.String({ format: "email" }),
        phone: t.Optional(t.String()),
        propertyRef: t.Optional(t.String()),
        message: t.Optional(t.String()),
        source: t.Optional(
          t.Union([t.Literal("email"), t.Literal("phone"), t.Literal("portal"), t.Literal("manual")]),
        ),
      }),
      response: {
        200: t.Object({
          id: t.String(),
          status: t.String(),
          createdAt: t.String(),
        }),
      },
    },
  );
