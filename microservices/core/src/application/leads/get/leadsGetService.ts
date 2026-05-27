import Elysia from "elysia";
import { LeadRepository } from "../../repositories/leadRepository";
import { type AgencyScope } from "../../repositories/tenantScopedRepository";

export const LeadsGetService = new Elysia({ name: "LeadsGetService" }).decorate(
  "leadsGetService",
  {
    async getLead(agencyId: AgencyScope, id: string) {
      const repo = new LeadRepository(undefined, agencyId);
      const lead = await repo.findById(id);
      if (!lead) throw new Error(`Lead not found: ${id}`);
      return lead;
    },
  },
);
