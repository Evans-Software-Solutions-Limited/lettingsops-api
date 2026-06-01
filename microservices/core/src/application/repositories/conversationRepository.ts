/**
 * ConversationRepository
 *
 * Data access for EmailConversation entities — backed by Neon
 * (serverless Postgres) via Drizzle ORM.
 *
 * Tenant-scoped: every instance carries a real `agencyId` UUID. The
 * `email_conversations` table has carried `agency_id` since the
 * phase-1 schema; constructor injection moves the scoping out of
 * per-method args so reads / writes that previously took no
 * `agencyId` (findById, appendMessageId, setCollectedFields,
 * markComplete) all gain the scope filter — they previously could in
 * principle return / mutate cross-tenant rows if a caller passed the
 * wrong conversationId. The `ANY_AGENCY` sentinel was retired in
 * Block I-PR-D.
 */
import { and, eq } from "drizzle-orm";
import {
  type Db,
  emailConversations,
  type EmailConversationRow,
  type ConversationTypeEnum,
} from "@lettingsops/db";
import {
  TenantScopedRepository,
  filterPredicates,
} from "./tenantScopedRepository";

export interface CreateConversationInput {
  tenantEmail: string;
  leadId?: string;
  conversationType?: ConversationTypeEnum;
}

export class ConversationRepository extends TenantScopedRepository {
  static readonly key = "ConversationRepository";

  constructor(db: Db | undefined, agencyId: string) {
    super(db, agencyId);
  }

  /**
   * Find by tenant email within the instance's agency scope.
   *
   * Signature kept for source-compat with pre-Block-E callers; the
   * `agencyId` parameter is asserted to match the instance's scope so
   * we catch any caller still passing a stale value during the
   * migration window. Once every caller has been updated to construct
   * with the right agency, the param can be dropped.
   */
  async findByAgencyAndEmail(
    agencyId: string,
    tenantEmail: string,
  ): Promise<EmailConversationRow | null> {
    if (agencyId !== this.getAgencyId()) {
      throw new Error(
        "ConversationRepository.findByAgencyAndEmail called with an agencyId that does not match the repository scope. Construct the repo with the right agencyId instead.",
      );
    }
    const [row] = await this.db
      .select()
      .from(emailConversations)
      .where(
        and(
          ...filterPredicates([
            this.scopeWhere(emailConversations.agencyId),
            eq(emailConversations.tenantEmail, tenantEmail),
          ]),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  async findById(conversationId: string): Promise<EmailConversationRow | null> {
    const [row] = await this.db
      .select()
      .from(emailConversations)
      .where(
        and(
          ...filterPredicates([
            eq(emailConversations.id, conversationId),
            this.scopeWhere(emailConversations.agencyId),
          ]),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  async create(input: CreateConversationInput): Promise<EmailConversationRow> {
    const [row] = await this.db
      .insert(emailConversations)
      .values({
        agencyId: this.writeAgencyId(),
        tenantEmail: input.tenantEmail,
        leadId: input.leadId,
        conversationType: input.conversationType ?? "OTHER",
        threadMessageIds: [],
        collectedFields: {},
        status: "active",
      })
      .returning();

    if (!row)
      throw new Error("Failed to create conversation — no row returned");
    return row;
  }

  async appendMessageId(
    conversationId: string,
    messageId: string,
  ): Promise<void> {
    // Fetch the current row (scoped) — refuses to operate on a row that
    // belongs to a different agency.
    const row = await this.findById(conversationId);
    if (!row) throw new Error("Conversation not found");

    const updated = [...(row.threadMessageIds ?? []), messageId];

    await this.db
      .update(emailConversations)
      .set({ threadMessageIds: updated, updatedAt: new Date() })
      .where(
        and(
          ...filterPredicates([
            eq(emailConversations.id, conversationId),
            this.scopeWhere(emailConversations.agencyId),
          ]),
        ),
      );
  }

  async setCollectedFields(
    conversationId: string,
    fields: Record<string, string>,
  ): Promise<void> {
    await this.db
      .update(emailConversations)
      .set({ collectedFields: fields, updatedAt: new Date() })
      .where(
        and(
          ...filterPredicates([
            eq(emailConversations.id, conversationId),
            this.scopeWhere(emailConversations.agencyId),
          ]),
        ),
      );
  }

  async markComplete(conversationId: string): Promise<void> {
    await this.db
      .update(emailConversations)
      .set({ status: "completed", updatedAt: new Date() })
      .where(
        and(
          ...filterPredicates([
            eq(emailConversations.id, conversationId),
            this.scopeWhere(emailConversations.agencyId),
          ]),
        ),
      );
  }
}
