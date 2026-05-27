import Elysia from "elysia";
import { LeadRepository } from "../../repositories/leadRepository";
import { type AgencyScope } from "../../repositories/tenantScopedRepository";

export const LeadsListService = new Elysia({
  name: "LeadsListService",
}).decorate("leadsListService", {
  async listLeads(
    agencyId: AgencyScope,
    filters: {
      status?: string;
      propertyRef?: string;
      page?: number;
      limit?: number;
    },
  ) {
    const repo = new LeadRepository(undefined, agencyId);
    return repo.list({
      status: filters.status,
      propertyRef: filters.propertyRef,
      page: filters.page ?? 1,
      limit: filters.limit ?? 20,
    });
  },
});
