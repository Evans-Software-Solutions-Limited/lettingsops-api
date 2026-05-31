import Elysia from "elysia";
import { LeadRepository } from "../../repositories/leadRepository";

export const LeadsCreateService = new Elysia({
  name: "LeadsCreateService",
}).decorate("leadsCreateService", {
  async createLead(
    agencyId: string,
    input: {
      name: string;
      email: string;
      phone?: string;
      propertyRef?: string;
      message?: string;
      source?: "email" | "phone" | "portal" | "manual";
    },
  ): Promise<{ id: string; status: string; createdAt: string }> {
    const repo = new LeadRepository(undefined, agencyId);
    // `LeadsCreated` CloudWatch metric is published inside
    // `repo.create` so every ingestion path (HTTP, email, phone) is
    // counted through the same choke point — don't add a publish call
    // here too or webhook-vs-HTTP comparisons will be skewed.
    return repo.create({
      ...input,
      status: "NEW",
      source: input.source ?? "manual",
    });
  },
});
