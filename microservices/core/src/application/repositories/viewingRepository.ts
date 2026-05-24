/**
 * ViewingRepository
 *
 * Data access for Viewing records — backed by Neon via Drizzle ORM.
 *
 * Tenant-scoped: every instance carries an `agencyId` (real UUID or
 * the `ANY_AGENCY` sentinel). Reads filter by it; writes inject it.
 * See `TenantScopedRepository`.
 */
import { and, eq } from "drizzle-orm";
import { type Db, viewings } from "@lettingsops/db";
import {
  type AgencyScope,
  TenantScopedRepository,
  filterPredicates,
} from "./tenantScopedRepository";

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

export class ViewingRepository extends TenantScopedRepository {
  static readonly key = "ViewingRepository";

  constructor(db: Db | undefined, agencyId: AgencyScope) {
    super(db, agencyId);
  }

  async create(input: CreateViewingInput): Promise<Viewing> {
    const [row] = await this.db
      .insert(viewings)
      .values({
        agencyId: this.writeAgencyId(),
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
      .where(
        and(
          ...filterPredicates([
            eq(viewings.id, id),
            this.scopeWhere(viewings.agencyId),
          ]),
        ),
      )
      .limit(1);

    return row ? rowToViewing(row) : null;
  }

  async findByLeadId(leadId: string): Promise<Viewing[]> {
    const rows = await this.db
      .select()
      .from(viewings)
      .where(
        and(
          ...filterPredicates([
            eq(viewings.leadId, leadId),
            this.scopeWhere(viewings.agencyId),
          ]),
        ),
      )
      .orderBy(viewings.confirmedAt);

    return rows.map(rowToViewing);
  }

  async cancel(id: string): Promise<void> {
    await this.db
      .update(viewings)
      .set({ cancelledAt: new Date() })
      .where(
        and(
          ...filterPredicates([
            eq(viewings.id, id),
            this.scopeWhere(viewings.agencyId),
          ]),
        ),
      );
  }
}
