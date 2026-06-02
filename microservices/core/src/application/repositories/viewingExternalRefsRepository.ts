/**
 * ViewingExternalRefsRepository
 *
 * Idempotency store for outbound CRM viewing pushes. Mirrors
 * `LeadExternalRefsRepository` against `viewing_external_refs`:
 * one row per `(viewing_id, crm_kind)`, enforced by a unique index,
 * so a retry after a transient failure updates the existing CRM row
 * rather than inserting a duplicate.
 *
 * Spec: `.kiro/specs/02-crm-and-booking-adapters/design.md` §2.1.
 */
import { and, eq } from "drizzle-orm";
import {
  type Db,
  viewingExternalRefs,
  type ViewingExternalRefRow,
} from "@lettingsops/db";
import {
  TenantScopedRepository,
  filterPredicates,
} from "./tenantScopedRepository";

export class ViewingExternalRefsRepository extends TenantScopedRepository {
  static readonly key = "ViewingExternalRefsRepository";

  constructor(db: Db | undefined, agencyId: string) {
    super(db, agencyId);
  }

  async findByViewingAndKind(
    viewingId: string,
    crmKind: string,
  ): Promise<ViewingExternalRefRow | null> {
    const [row] = await this.db
      .select()
      .from(viewingExternalRefs)
      .where(
        and(
          ...filterPredicates([
            eq(viewingExternalRefs.viewingId, viewingId),
            eq(viewingExternalRefs.crmKind, crmKind),
            this.scopeWhere(viewingExternalRefs.agencyId),
          ]),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  /**
   * `where:` on the conflict update scopes the UPDATE branch to this
   * repo's agency — same defence as `LeadExternalRefsRepository.upsert`.
   * Without it, a caller in tenant A with a forged viewingId
   * belonging to tenant B could overwrite B's external_id while
   * preserving B's agency_id, silently poisoning B's CRM idempotency
   * map. The mismatched-tenant case now lands on the `Failed to
   * upsert` throw below instead. Inspector Brad HIGH finding, PR #45.
   */
  async upsert(input: {
    viewingId: string;
    crmKind: string;
    externalId: string;
  }): Promise<ViewingExternalRefRow> {
    const [row] = await this.db
      .insert(viewingExternalRefs)
      .values({
        agencyId: this.writeAgencyId(),
        viewingId: input.viewingId,
        crmKind: input.crmKind,
        externalId: input.externalId,
      })
      .onConflictDoUpdate({
        target: [viewingExternalRefs.viewingId, viewingExternalRefs.crmKind],
        set: { externalId: input.externalId },
        where: eq(viewingExternalRefs.agencyId, this.writeAgencyId()),
      })
      .returning();

    if (!row)
      throw new Error(
        "Failed to upsert viewing_external_refs — no row returned",
      );
    return row;
  }
}
