import Elysia from "elysia";
import { LeadRepository } from "../../repositories/leadRepository";

export const LeadsCreateService = new Elysia({ name: "LeadsCreateService" })
  .decorate("leadsCreateService", {
    async createLead(input: {
      name: string;
      email: string;
      phone?: string;
      propertyRef?: string;
      message?: string;
      source?: "email" | "phone" | "portal" | "manual";
    }): Promise<{ id: string; status: string; createdAt: string }> {
      const repo = new LeadRepository();
      return repo.create({
        ...input,
        status: "NEW",
        source: input.source ?? "manual",
      });
    },
  });
