/**
 * LeadExternalRefsRepository
 *
 * Idempotency store for outbound CRM lead pushes. One row per
 * `(lead_id, crm_kind)` (enforced by a unique index) records the CRM's
 * own id for the lead. The retry helper (Block C) reads this before
 * each `pushLead` so a transient failure followed by a retry updates
 * the existing CRM row rather than inserting a duplicate.
 *
 * Tenant-scoped — the constructor takes `agencyId` and every method
 * filters reads by it. Writes use the agency-side path so an attacker
 * with a forged `leadId` for a different tenant can't poison this
 * agency's idempotency map.
 *
 * Spec: `.kiro/specs/02-crm-and-booking-adapters/design.md` §2.1.
 */
import { and, eq } from "drizzle-orm";
import {
  type Db,
  leadExternalRefs,
  type LeadExternalRefRow,
} from "@lettingsops/db";
import {
  TenantScopedRepository,
  filterPredicates,
} from "./tenantScopedRepository";

export class LeadExternalRefsRepository extends TenantScopedRepository {
  static readonly key = "LeadExternalRefsRepository";

  constructor(db: Db | undefined, agencyId: string) {
    super(db, agencyId);
  }

  /**
   * Look up the CRM's external id for a lead. Returns `null` when this
   * lead hasn't been pushed to the named CRM yet — the caller (the
   * retry helper) then treats the upcoming `pushLead` as an insert.
   */
  async findByLeadAndKind(
    leadId: string,
    crmKind: string,
  ): Promise<LeadExternalRefRow | null> {
    const [row] = await this.db
      .select()
      .from(leadExternalRefs)
      .where(
        and(
          ...filterPredicates([
            eq(leadExternalRefs.leadId, leadId),
            eq(leadExternalRefs.crmKind, crmKind),
            this.scopeWhere(leadExternalRefs.agencyId),
          ]),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  /**
   * Insert-or-update on the `(lead_id, crm_kind)` unique index.
   *
   * The unique index does NOT include `agency_id` (per the schema —
   * `lead_id` is itself globally unique so adding agency_id would be
   * redundant for the constraint, but it's load-bearing here for a
   * different reason). A caller in tenant A passing a `leadId` that
   * belongs to tenant B would otherwise conflict on tenant B's row,
   * `DO UPDATE set: { externalId }` would silently overwrite B's
   * mapping while preserving B's `agency_id`, and B's next
   * idempotency check would return the poisoned external id.
   *
   * The `where` guard below scopes the UPDATE branch to rows owned by
   * this repo's agency. A mismatched-tenant conflict means the
   * `where` filter fails, no row is updated, `.returning()` yields
   * `[]`, and the `Failed to upsert` throw below fires — surfacing
   * the bug instead of silently corrupting cross-tenant state.
   *
   * Inspector Brad HIGH finding, PR #45 2nd sweep.
   */
  async upsert(input: {
    leadId: string;
    crmKind: string;
    externalId: string;
  }): Promise<LeadExternalRefRow> {
    const [row] = await this.db
      .insert(leadExternalRefs)
      .values({
        agencyId: this.writeAgencyId(),
        leadId: input.leadId,
        crmKind: input.crmKind,
        externalId: input.externalId,
      })
      .onConflictDoUpdate({
        target: [leadExternalRefs.leadId, leadExternalRefs.crmKind],
        set: { externalId: input.externalId },
        where: eq(leadExternalRefs.agencyId, this.writeAgencyId()),
      })
      .returning();

    if (!row)
      throw new Error("Failed to upsert lead_external_refs — no row returned");
    return row;
  }
}
