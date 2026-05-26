import Elysia, { t } from "elysia";
import { auth } from "../../auth/authPlugin";
import { ANY_AGENCY } from "../../repositories/tenantScopedRepository";
import { QualificationSubmitService } from "./qualificationSubmitService";

export const qualificationSubmitHandler = new Elysia()
  .use(auth)
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
