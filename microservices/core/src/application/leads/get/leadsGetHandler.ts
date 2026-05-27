import Elysia, { t } from "elysia";
import { auth } from "../../auth/authPlugin";
import { ANY_AGENCY } from "../../repositories/tenantScopedRepository";
import { LeadsGetService } from "./leadsGetService";

export const leadsGetHandler = new Elysia()
  .use(auth)
  .use(LeadsGetService)
  .get(
    "/leads/:id",
    async (ctx) => {
      const lead = await ctx.leadsGetService.getLead(
        ctx.auth.agencyId ?? ANY_AGENCY,
        ctx.params.id,
      );
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
