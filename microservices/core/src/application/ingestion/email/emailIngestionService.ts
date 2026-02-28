import Elysia from "elysia";
import { type Db } from "@lettingsops/db";
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

/**
 * Core logic for processing email ingestion and lead creation
 * Can be used directly without Elysia (e.g., in Lambda)
 */
export async function processEmail(
  payload: EmailPayload,
  db?: Db,
): Promise<IngestionResult> {
  const repo = new LeadRepository(db);

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
  // LLM extraction now happens upstream in emailProcessor.ts
  // Treat empty or whitespace-only fromName as missing (?? only catches null/undefined; LLMs can return "")
  const fromName = payload.fromName?.trim();
  const lead = await repo.create({
    name: fromName || payload.from.split("@")[0],
    email: payload.from,
    propertyRef: payload.propertyRef,
    message: payload.body,
    source: "email",
    status: "NEW",
    metadata: { messageId: payload.messageId, subject: payload.subject },
  });

  return { leadId: lead.id, action: "CREATED" };
}

/**
 * Elysia plugin for HTTP handlers
 */
export const EmailIngestionService = new Elysia({
  name: "EmailIngestionService",
}).decorate("emailIngestionService", {
  async processEmail(payload: EmailPayload): Promise<IngestionResult> {
    return processEmail(payload);
  },
});
