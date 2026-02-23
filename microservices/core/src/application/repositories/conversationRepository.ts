/**
 * ConversationRepository
 *
 * Data access for EmailConversation entities — backed by Neon (serverless Postgres) via Drizzle ORM.
 * Pass a `db` instance to the constructor to inject a test database.
 */
import { and, eq } from "drizzle-orm";
import {
  type Db,
  emailConversations,
  type EmailConversationRow,
  getDb,
} from "@lettingsops/db";

export interface CreateConversationInput {
  agencyId: string;
  tenantEmail: string;
  leadId?: string;
}

export class ConversationRepository {
  static readonly key = "ConversationRepository";

  private db: Db;

  constructor(db?: Db) {
    this.db = db ?? getDb();
  }

  async findByAgencyAndEmail(
    agencyId: string,
    tenantEmail: string,
  ): Promise<EmailConversationRow | null> {
    const [row] = await this.db
      .select()
      .from(emailConversations)
      .where(
        and(
          eq(emailConversations.agencyId, agencyId),
          eq(emailConversations.tenantEmail, tenantEmail),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  async findById(conversationId: string): Promise<EmailConversationRow | null> {
    const [row] = await this.db
      .select()
      .from(emailConversations)
      .where(eq(emailConversations.id, conversationId))
      .limit(1);
    return row ?? null;
  }

  async create(input: CreateConversationInput): Promise<EmailConversationRow> {
    const [row] = await this.db
      .insert(emailConversations)
      .values({
        agencyId: input.agencyId,
        tenantEmail: input.tenantEmail,
        leadId: input.leadId,
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
    // Fetch the current row
    const [row] = await this.db
      .select()
      .from(emailConversations)
      .where(eq(emailConversations.id, conversationId))
      .limit(1);

    if (!row) throw new Error("Conversation not found");

    // Append the messageId to threadMessageIds
    const updated = [...(row.threadMessageIds ?? []), messageId];

    await this.db
      .update(emailConversations)
      .set({ threadMessageIds: updated, updatedAt: new Date() })
      .where(eq(emailConversations.id, conversationId));
  }

  async setCollectedFields(
    conversationId: string,
    fields: Record<string, string>,
  ): Promise<void> {
    await this.db
      .update(emailConversations)
      .set({ collectedFields: fields, updatedAt: new Date() })
      .where(eq(emailConversations.id, conversationId));
  }

  async markComplete(conversationId: string): Promise<void> {
    await this.db
      .update(emailConversations)
      .set({ status: "completed", updatedAt: new Date() })
      .where(eq(emailConversations.id, conversationId));
  }
}
