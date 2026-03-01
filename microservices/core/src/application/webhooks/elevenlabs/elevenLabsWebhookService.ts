import Elysia from "elysia";
import { getDb } from "@lettingsops/db";
import { LeadRepository } from "../../repositories/leadRepository";

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
    const db = getDb();
    const leadRepo = new LeadRepository(db);

    const extractedFields = payload.extractedFields || {};
    const email =
      extractedFields.email || `call-${payload.callId}@elevenlabs.local`;
    const name = extractedFields.name || "Unknown Caller";

    // Find or create lead
    let lead = await leadRepo.findByEmail(email);

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
    }

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
