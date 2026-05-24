import Elysia from "elysia";
import { getDb } from "@lettingsops/db";
import { LeadRepository } from "../../repositories/leadRepository";
import { ANY_AGENCY } from "../../repositories/tenantScopedRepository";
import { logger } from "@lettingsops/api-utils/logger";

interface ElevenLabsPayload {
  callId: string;
  agentId: string;
  intent: "viewing_enquiry" | "maintenance" | "rent_query" | "other";
  extractedFields?: {
    name?: string;
    email?: string;
    phone?: string;
    propertyRef?: string;
    moveInDate?: string;
  };
  transcript?: Array<{
    role: "agent" | "user";
    message: string;
    timestamp: string;
  }>;
  callDurationSeconds?: number;
}

export const ElevenLabsWebhookService = new Elysia({
  name: "ElevenLabsWebhookService",
}).decorate("elevenLabsWebhookService", {
  async handleWebhook(payload: ElevenLabsPayload) {
    // Note on agencyId: ElevenLabs payloads carry `agentId`, not `agencyId`.
    // The agentId → agencyId mapping lands with the tenant-scoping refactor
    // in Block E of spec-01-platform-hardening. Until then, logs here carry
    // `callId` + `agentId` as the primary correlation fields; downstream
    // `agencyId` enrichment will be added once the agent-to-agency lookup
    // exists. See `.kiro/specs/01-platform-hardening/tasks.md` E1–E4.
    logger.info("ElevenLabs webhook received", {
      callId: payload.callId,
      agentId: payload.agentId,
      intent: payload.intent,
      transcriptTurns: payload.transcript?.length ?? 0,
    });

    const db = getDb();
    // ElevenLabs payloads carry `agentId`, not `agencyId`. The
    // agentId → agencyId mapping lands in a later block (tracked in
    // C4's note in tasks.md). Until then this webhook is tenant-blind
    // and falls through the ANY_AGENCY sentinel.
    // TODO(F1/agent-mapping): resolve agencyId from agentId.
    const leadRepo = new LeadRepository(db, ANY_AGENCY);

    const extractedFields = payload.extractedFields || {};
    const email =
      extractedFields.email || `call-${payload.callId}@elevenlabs.local`;
    const name = extractedFields.name || "Unknown Caller";

    // Find or create lead
    let lead = await leadRepo.findByEmail(email);
    let action: "matched" | "created";

    if (!lead) {
      lead = await leadRepo.create({
        name,
        email,
        phone: extractedFields.phone,
        propertyRef: extractedFields.propertyRef,
        source: "phone",
        status: "NEW",
        message: `ElevenLabs call: ${payload.intent}`,
        metadata: {
          callId: payload.callId,
          agentId: payload.agentId,
          intent: payload.intent,
          moveInDate: extractedFields.moveInDate,
          callDurationSeconds: payload.callDurationSeconds,
        },
      });
      action = "created";
    } else {
      action = "matched";
    }

    logger.info("ElevenLabs lead resolved", {
      callId: payload.callId,
      agentId: payload.agentId,
      leadId: lead.id,
      action,
    });

    // Store transcript as communication log
    if (payload.transcript && payload.transcript.length > 0) {
      // Join transcript turns as "role: message\n"
      const transcriptBody = payload.transcript
        .map((turn) => `${turn.role}: ${turn.message}`)
        .join("\n");

      await leadRepo.addNote(lead.id, {
        source: "phone",
        messageId: payload.callId,
        subject: `Call: ${payload.intent}`,
        body: transcriptBody,
        receivedAt: new Date().toISOString(),
      });
    }

    return {
      success: true,
      leadId: lead.id,
    };
  },
});
