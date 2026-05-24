import Elysia from "elysia";
import { LeadRepository } from "../../repositories/leadRepository";
import { ANY_AGENCY } from "../../repositories/tenantScopedRepository";

export const LeadsCreateService = new Elysia({
  name: "LeadsCreateService",
}).decorate("leadsCreateService", {
  async createLead(input: {
    name: string;
    email: string;
    phone?: string;
    propertyRef?: string;
    message?: string;
    source?: "email" | "phone" | "portal" | "manual";
  }): Promise<{ id: string; status: string; createdAt: string }> {
    // TODO(F1): pass `ctx.auth.agencyId` once `.use(auth)` is mounted.
    // Writes via ANY_AGENCY fall back to the LEGACY_AGENCY_ID column
    // DEFAULT until then.
    const repo = new LeadRepository(undefined, ANY_AGENCY);
    return repo.create({
      ...input,
      status: "NEW",
      source: input.source ?? "manual",
    });
  },
});
