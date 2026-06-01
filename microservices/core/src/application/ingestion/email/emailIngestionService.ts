import Elysia from "elysia";
import { type Db, getDb } from "@lettingsops/db";
import { LeadRepository } from "../../repositories/leadRepository";
import { HttpError } from "../../auth/httpError";
import { resolveAgencyFromInboundEmail } from "./agencyResolver";

export type EmailPayload = {
  messageId: string;
  from: string;
  fromName?: string;
  subject: string;
  body: string;
  receivedAt: string;
  propertyRef?: string;
};

/**
 * HTTP webhook body shape. Extends `EmailPayload` with the recipient
 * address (`to`) so the HTTP wrapper can resolve the owning agency
 * before calling `processEmail`. The Lambda path doesn't carry `to` —
 * it resolves earlier (see `emailProcessor.ts`).
 */
export type EmailWebhookPayload = EmailPayload & { to: string };

export type IngestionResult = {
  leadId: string;
  action: "CREATED" | "MERGED" | "IGNORED";
};

/**
 * Core logic for processing email ingestion and lead creation.
 * Can be used directly without Elysia (e.g., in Lambda).
 *
 * `agencyId` is required and must be a real UUID — the caller is
 * responsible for resolving it from the inbound recipient address
 * before calling. The Lambda path uses `resolveAgencyFromInboundEmail`
 * directly; the HTTP wrapper below does the same lookup and throws
 * `HttpError(401)` when no agency owns the recipient. The
 * `ANY_AGENCY` sentinel is no longer accepted on this path — Block I.
 */
export async function processEmail(
  payload: EmailPayload,
  agencyId: string,
  db?: Db,
): Promise<IngestionResult> {
  const repo = new LeadRepository(db, agencyId);

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
 * Elysia plugin for the `POST /webhooks/email` route. Resolves the
 * owning agency from the inbound recipient address (`payload.to`)
 * before calling `processEmail`. An unknown recipient — i.e. an email
 * that doesn't match any agency's `inbound_email` — throws
 * `HttpError(401)`, which the handler's `.onError` maps to a 401
 * response so the upstream forwarder can stop retrying.
 */
export const EmailIngestionService = new Elysia({
  name: "EmailIngestionService",
}).decorate("emailIngestionService", {
  async processEmail(payload: EmailWebhookPayload): Promise<IngestionResult> {
    const { to, ...rest } = payload;
    const db = getDb();
    const agencyId = await resolveAgencyFromInboundEmail(to, db);
    if (!agencyId) {
      throw new HttpError(401, "No agency owns the recipient address");
    }
    return processEmail(rest, agencyId, db);
  },
});
