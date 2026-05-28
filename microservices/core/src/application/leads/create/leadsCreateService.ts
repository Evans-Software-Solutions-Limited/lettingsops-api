import Elysia from "elysia";
import { LeadRepository } from "../../repositories/leadRepository";
import { publishLeadCreated } from "../../metrics/cloudWatchMetrics";

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
    const source = input.source ?? "manual";
    const lead = await repo.create({
      ...input,
      status: "NEW",
      source,
    });
    // Fire-and-forget custom CloudWatch metric. The Ingestion dashboard
    // and any future "leads per source" alerting read from this.
    // `publishLeadCreated` swallows its own errors, so the await chain
    // never sees a CloudWatch failure — `void` here just makes
    // intentional-non-await readable.
    void publishLeadCreated(source, agencyId);
    return lead;
  },
});
