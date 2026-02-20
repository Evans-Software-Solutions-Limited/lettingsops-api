/**
 * ViewingRepository
 *
 * Data access for Viewing records — backed by Neon via Drizzle ORM.
 */
import { eq } from "drizzle-orm";
import { type Db, getDb, viewings } from "@lettingsops/db";

export type Viewing = {
  id: string;
  leadId: string;
  propertyRef: string;
  slotId: string;
  calendarEventId?: string;
  confirmedAt: string;
  cancelledAt?: string;
  createdAt: string;
};

export type CreateViewingInput = {
  leadId: string;
  propertyRef: string;
  slotId: string;
  calendarEventId?: string;
  confirmedAt: string;
};

function rowToViewing(row: typeof viewings.$inferSelect): Viewing {
  return {
    id: row.id,
    leadId: row.leadId,
    propertyRef: row.propertyRef,
    slotId: row.slotId,
    calendarEventId: row.calendarEventId ?? undefined,
    confirmedAt: row.confirmedAt.toISOString(),
    cancelledAt: row.cancelledAt?.toISOString(),
    createdAt: row.createdAt.toISOString(),
  };
}

export class ViewingRepository {
  static readonly key = "ViewingRepository";

  private db: Db;

  constructor(db?: Db) {
    this.db = db ?? getDb();
  }

  async create(input: CreateViewingInput): Promise<Viewing> {
    const [row] = await this.db
      .insert(viewings)
      .values({
        leadId: input.leadId,
        propertyRef: input.propertyRef,
        slotId: input.slotId,
        calendarEventId: input.calendarEventId,
        confirmedAt: new Date(input.confirmedAt),
      })
      .returning();

    if (!row) throw new Error("Failed to create viewing — no row returned");
    return rowToViewing(row);
  }

  async findById(id: string): Promise<Viewing | null> {
    const [row] = await this.db
      .select()
      .from(viewings)
      .where(eq(viewings.id, id))
      .limit(1);

    return row ? rowToViewing(row) : null;
  }

  async findByLeadId(leadId: string): Promise<Viewing[]> {
    const rows = await this.db
      .select()
      .from(viewings)
      .where(eq(viewings.leadId, leadId))
      .orderBy(viewings.confirmedAt);

    return rows.map(rowToViewing);
  }

  async cancel(id: string): Promise<void> {
    await this.db
      .update(viewings)
      .set({ cancelledAt: new Date() })
      .where(eq(viewings.id, id));
  }
}
