import Elysia, { t } from "elysia";
import { auth } from "../../auth/authPlugin";
import { ANY_AGENCY } from "../../repositories/tenantScopedRepository";
import { LeadsCreateService } from "./leadsCreateService";

export const leadsCreateHandler = new Elysia()
  .use(auth)
  .use(LeadsCreateService)
  .post(
    "/leads",
    async (ctx) => {
      // ctx.auth.agencyId is non-null when AUTH_ENFORCED=true (Block F4).
      // While AUTH_ENFORCED=false the sentinel preserves pre-auth behaviour.
      const lead = await ctx.leadsCreateService.createLead(
        ctx.auth.agencyId ?? ANY_AGENCY,
        ctx.body,
      );
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
        t.Union([
          t.Literal("email"),
          t.Literal("phone"),
          t.Literal("portal"),
          t.Literal("manual"),
        ]),
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
