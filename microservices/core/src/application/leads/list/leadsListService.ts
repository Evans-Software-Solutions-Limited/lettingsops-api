import Elysia from "elysia";
import { LeadRepository } from "../../repositories/leadRepository";

export const LeadsListService = new Elysia({
  name: "LeadsListService",
}).decorate("leadsListService", {
  async listLeads(
    agencyId: string,
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
