import Elysia from "elysia";
import { LeadRepository } from "../../repositories/leadRepository";
import { ANY_AGENCY } from "../../repositories/tenantScopedRepository";

export const LeadsListService = new Elysia({
  name: "LeadsListService",
}).decorate("leadsListService", {
  async listLeads(filters: {
    status?: string;
    propertyRef?: string;
    page?: number;
    limit?: number;
  }) {
    // TODO(F1): pass `ctx.auth.agencyId` once `.use(auth)` is mounted.
    const repo = new LeadRepository(undefined, ANY_AGENCY);
    return repo.list({
      status: filters.status,
      propertyRef: filters.propertyRef,
      page: filters.page ?? 1,
      limit: filters.limit ?? 20,
    });
  },
});
