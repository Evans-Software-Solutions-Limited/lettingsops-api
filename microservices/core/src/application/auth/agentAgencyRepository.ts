/**
 * AgentAgencyRepository
 *
 * Resolves an external "agent" identifier (today: ElevenLabs phone-call
 * `agent_id`) to an internal `agency_id`. The mapping lives in the
 * `agent_agency_map` table — see `packages/db/src/schema.ts` for the
 * shape and security note.
 *
 * Foundation for Block I (retiring the `ANY_AGENCY` sentinel from
 * `application/webhooks/elevenlabs/`). The wiring into the ElevenLabs
 * webhook handler lands in I-PR-C; this PR is purely additive.
 *
 * NOT tenant-scoped by design — this is a meta-table that spans all
 * agencies. The security boundary is operational: only server-side
 * webhook code reads it, never the public API.
 */
import { eq } from "drizzle-orm";
import {
  type Db,
  agentAgencyMap,
  type AgentAgencyMapRow,
  getDb,
} from "@lettingsops/db";

export interface CreateAgentAgencyMapInput {
  agentId: string;
  agencyId: string;
  /** Optional operator-facing label (e.g. "Reapit demo agent"). */
  notes?: string;
}

export class AgentAgencyRepository {
  static readonly key = "AgentAgencyRepository";

  private db: Db;

  constructor(db?: Db) {
    this.db = db ?? getDb();
  }

  /**
   * Resolve an external agent identifier to its agency. Returns `null`
   * when no mapping exists — callers must treat that as an
   * authentication failure (HTTP 401), not a 500, because an unknown
   * agent ID is almost always either a misconfigured ElevenLabs agent
   * or a spoofed webhook.
   */
  async findAgencyForAgent(agentId: string): Promise<string | null> {
    const [row] = await this.db
      .select({ agencyId: agentAgencyMap.agencyId })
      .from(agentAgencyMap)
      .where(eq(agentAgencyMap.agentId, agentId))
      .limit(1);
    return row?.agencyId ?? null;
  }

  /**
   * Upsert a mapping. Used by seed scripts and the eventual admin UI
   * (not by request-path webhook code). `agentId` is the primary key,
   * so a second call with the same agentId updates the agencyId and
   * notes — handy when an ElevenLabs agent is re-pointed at a different
   * tenant without minting a new id.
   */
  async upsert(input: CreateAgentAgencyMapInput): Promise<AgentAgencyMapRow> {
    const now = new Date();
    const [row] = await this.db
      .insert(agentAgencyMap)
      .values({
        agentId: input.agentId,
        agencyId: input.agencyId,
        notes: input.notes,
      })
      .onConflictDoUpdate({
        target: agentAgencyMap.agentId,
        set: {
          agencyId: input.agencyId,
          notes: input.notes,
          updatedAt: now,
        },
      })
      .returning();

    if (!row)
      throw new Error("Failed to upsert agent_agency_map — no row returned");
    return row;
  }
}
