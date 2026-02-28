import Elysia from "elysia";
import { getDb } from "@lettingsops/db";
import { eq } from "drizzle-orm";
import { communicationLogs } from "@lettingsops/db";

export const LeadsCommunicationService = new Elysia({
  name: "LeadsCommunicationService",
}).decorate("leadsCommunicationService", {
  async getCommunication(leadId: string) {
    const db = getDb();

    const logs = await db
      .select()
      .from(communicationLogs)
      .where(eq(communicationLogs.leadId, leadId));

    const communications = logs.map((log) => ({
      id: log.id,
      source: log.source,
      subject: log.subject || undefined,
      body: log.body || undefined,
      receivedAt: log.receivedAt?.toISOString() || new Date().toISOString(),
      direction: "inbound" as const,
    }));

    return {
      leadId,
      communications,
    };
  },
});
