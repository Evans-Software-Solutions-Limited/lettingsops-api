import Elysia from "elysia";
import { getDb } from "@lettingsops/db";
import { and, eq } from "drizzle-orm";
import { communicationLogs } from "@lettingsops/db";

type CommunicationLog = {
  id: string;
  source: string;
  subject?: string;
  body?: string;
  receivedAt: string;
  direction: "inbound";
};

export const LeadsCommunicationService = new Elysia({
  name: "LeadsCommunicationService",
}).decorate("leadsCommunicationService", {
  async getCommunication(agencyId: string, leadId: string) {
    const db = getDb();

    const logs = await db
      .select()
      .from(communicationLogs)
      .where(
        and(
          eq(communicationLogs.leadId, leadId),
          eq(communicationLogs.agencyId, agencyId),
        ),
      );

    const communications: CommunicationLog[] = logs.map((log) => {
      const comm: CommunicationLog = {
        id: log.id,
        source: log.source,
        receivedAt: log.receivedAt?.toISOString() || new Date().toISOString(),
        direction: "inbound" as const,
      };

      // Only include subject and body if they have values
      if (log.subject) {
        comm.subject = log.subject;
      }
      if (log.body) {
        comm.body = log.body;
      }

      return comm;
    });

    return {
      leadId,
      communications,
    };
  },
});
