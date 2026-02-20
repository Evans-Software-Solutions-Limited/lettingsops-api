import Elysia from "elysia";
import { LeadRepository } from "../../repositories/leadRepository";

export const LeadsGetService = new Elysia({ name: "LeadsGetService" })
  .decorate("leadsGetService", {
    async getLead(id: string) {
      const repo = new LeadRepository();
      const lead = await repo.findById(id);
      if (!lead) throw new Error(`Lead not found: ${id}`);
      return lead;
    },
  });
