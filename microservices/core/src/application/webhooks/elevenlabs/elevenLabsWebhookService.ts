import Elysia from "elysia";
import { getDb } from "@lettingsops/db";
import { LeadRepository } from "../../repositories/leadRepository";
import { AgentAgencyRepository } from "../../auth/agentAgencyRepository";
import { HttpError } from "../../auth/httpError";
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
    // Resolve the owning agency from the ElevenLabs `agentId` via the
    // `agent_agency_map` table (Block I-PR-A added the table; I-PR-C
    // wires it here). An unknown agentId — i.e. one that hasn't been
    // seeded into the map — throws `HttpError(401)` so the upstream
    // ElevenLabs caller gets a definitive 4xx and stops retrying. The
    // ElevenLabsWebhookFailures alarm (Block G) catches sustained
    // misses operationally.
    const db = getDb();
    const agencyId = await new AgentAgencyRepository(db).findAgencyForAgent(
      payload.agentId,
    );
    if (!agencyId) {
      // Log BEFORE throwing so the agentId is in the audit trail even
      // if the .onError handler swallows the message. PII-safe — the
      // agentId is an opaque provider identifier, not user data.
      logger.warn("Unknown ElevenLabs agent — no agency mapping", {
        callId: payload.callId,
        agentId: payload.agentId,
      });
      throw new HttpError(
        401,
        "Unknown agent — no agency mapping for this ElevenLabs agent",
      );
    }

    logger.info("ElevenLabs webhook received", {
      callId: payload.callId,
      agentId: payload.agentId,
      agencyId,
      intent: payload.intent,
      transcriptTurns: payload.transcript?.length ?? 0,
    });

    const leadRepo = new LeadRepository(db, agencyId);

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
