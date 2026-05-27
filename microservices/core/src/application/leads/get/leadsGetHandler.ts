import Elysia, { t } from "elysia";
import { auth } from "../../auth/authPlugin";
import { HttpError } from "../../auth/httpError";
import { ANY_AGENCY } from "../../repositories/tenantScopedRepository";
import { LeadsGetService } from "./leadsGetService";

export const leadsGetHandler = new Elysia()
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
