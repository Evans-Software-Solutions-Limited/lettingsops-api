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
  viewings,
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
   * Insert-or-update on the `(viewing_id, crm_kind)` unique index.
   * Same two-layer cross-tenant defence as
   * `LeadExternalRefsRepository.upsert` — see its header for the
   * full reasoning. Pre-insert verify against `viewings WHERE
   * id=$viewingId AND agency_id=scope` rejects a forged viewingId
   * before any write; the `where:` on `onConflictDoUpdate` rejects
   * a cross-tenant UPDATE on a legitimately-conflicting row.
   *
   * Inspector Brad findings on PR #45: HIGH (2nd sweep, conflict
   * branch) and MEDIUM (3rd sweep, insert branch).
   */
  async upsert(input: {
    viewingId: string;
    crmKind: string;
    externalId: string;
  }): Promise<ViewingExternalRefRow> {
    // (1) Pre-insert verify — reject cross-tenant viewingId.
    const [owned] = await this.db
      .select({ id: viewings.id })
      .from(viewings)
      .where(
        and(
          eq(viewings.id, input.viewingId),
          this.scopeWhere(viewings.agencyId),
        ),
      )
      .limit(1);
    if (!owned) {
      throw new Error(
        `ViewingExternalRefsRepository.upsert — viewing ${input.viewingId} does not belong to this agency`,
      );
    }

    // (2) INSERT … ON CONFLICT … WHERE agency_id = scope.
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
