import Elysia from "elysia";
import { LeadRepository } from "../../repositories/leadRepository";
import { ANY_AGENCY } from "../../repositories/tenantScopedRepository";

export const LeadsGetService = new Elysia({ name: "LeadsGetService" }).decorate(
  "leadsGetService",
  {
    async getLead(id: string) {
      // TODO(F1): pass `ctx.auth.agencyId` once `.use(auth)` is mounted
      // on the get-lead route. Until then ANY_AGENCY bypasses the
      // tenant filter — matches pre-Block-E behaviour.
      const repo = new LeadRepository(undefined, ANY_AGENCY);
      const lead = await repo.findById(id);
      if (!lead) throw new Error(`Lead not found: ${id}`);
      return lead;
    },
  },
);
