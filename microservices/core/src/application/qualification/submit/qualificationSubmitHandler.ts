import Elysia, { t } from "elysia";
import { auth } from "../../auth/authPlugin";
import { HttpError } from "../../auth/httpError";
import { ANY_AGENCY } from "../../repositories/tenantScopedRepository";
import { QualificationSubmitService } from "./qualificationSubmitService";

export const qualificationSubmitHandler = new Elysia()
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
  .use(QualificationSubmitService)
  .post(
    "/leads/:id/qualification",
    async (ctx) => {
      return ctx.qualificationSubmitService.submitQualification(
        ctx.auth.agencyId ?? ANY_AGENCY,
        ctx.params.id,
        ctx.body,
      );
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        moveInDate: t.String({ format: "date" }),
        occupants: t.Number({ minimum: 1 }),
        employmentStatus: t.Union([
          t.Literal("employed"),
          t.Literal("self_employed"),
          t.Literal("unemployed"),
          t.Literal("student"),
          t.Literal("retired"),
        ]),
        incomeBand: t.Union([
          t.Literal("under_20k"),
          t.Literal("20k_30k"),
          t.Literal("30k_50k"),
          t.Literal("50k_75k"),
          t.Literal("over_75k"),
        ]),
        hasPets: t.Boolean(),
        viewingAvailability: t.Array(t.String()),
      }),
      response: {
        200: t.Object({
          qualificationId: t.String(),
          score: t.Number(),
          category: t.Union([
            t.Literal("LOW"),
            t.Literal("MEDIUM"),
            t.Literal("STRONG"),
          ]),
        }),
      },
    },
  );
