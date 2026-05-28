import Elysia, { t } from "elysia";
import { auth } from "../../auth/authPlugin";
import { HttpError } from "../../auth/httpError";
import { LeadsCreateService } from "./leadsCreateService";

export const leadsCreateHandler = new Elysia()
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
  .use(LeadsCreateService)
  .post(
    "/leads",
    async (ctx) => {
      const lead = await ctx.leadsCreateService.createLead(
        ctx.auth.agencyId,
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
