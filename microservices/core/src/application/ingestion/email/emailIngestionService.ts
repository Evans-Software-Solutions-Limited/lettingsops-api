import Elysia from "elysia";
import { LeadRepository } from "../../repositories/leadRepository";

export type EmailPayload = {
  messageId: string;
  from: string;
  fromName?: string;
  subject: string;
  body: string;
  receivedAt: string;
  propertyRef?: string;
};

export type IngestionResult = {
  leadId: string;
  action: "CREATED" | "MERGED" | "IGNORED";
};

export const EmailIngestionService = new Elysia({
  name: "EmailIngestionService",
}).decorate("emailIngestionService", {
  async processEmail(payload: EmailPayload): Promise<IngestionResult> {
    const repo = new LeadRepository();

    // Idempotency: check if we've already processed this messageId
    const existing = await repo.findByMessageId(payload.messageId);
    if (existing) {
      return { leadId: existing.id, action: "IGNORED" };
    }

    // Dedup by email address — merge into existing lead if found
    const existingByEmail = await repo.findByEmail(payload.from);
    if (existingByEmail) {
      await repo.addNote(existingByEmail.id, {
        source: "email",
        messageId: payload.messageId,
        subject: payload.subject,
        receivedAt: payload.receivedAt,
      });
      return { leadId: existingByEmail.id, action: "MERGED" };
    }

    // Create new lead
    // TODO: use Tier 1 LLM to extract name from email body/fromName
    const lead = await repo.create({
      name: payload.fromName ?? payload.from.split("@")[0],
      email: payload.from,
      propertyRef: payload.propertyRef,
      message: payload.body,
      source: "email",
      status: "NEW",
      metadata: { messageId: payload.messageId, subject: payload.subject },
    });

    return { leadId: lead.id, action: "CREATED" };
  },
});
