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
  leads,
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
   * Cross-tenant defence runs in TWO places — both are load-bearing:
   *
   *   1. **Pre-insert verify** (the SELECT below). A `leadId` is
   *      sufficient to satisfy the FK on `leads.id`, but the FK
   *      doesn't constrain the lead's agency. A caller in tenant A
   *      passing tenant B's leadId — before B has ever pushed —
   *      would otherwise INSERT a row with `agency_id=A` and
   *      `lead_id=<B's lead>`, and B's later legitimate upsert would
   *      hit the conflict + the `where` filter would fail + B would
   *      be permanently locked out of pushing that lead. The verify
   *      check rejects the bogus leadId before we ever INSERT.
   *
   *   2. **Conflict-update `where:`** (further below). The first
   *      protection only fires on the INSERT branch. If a row
   *      already exists for `(leadId, crmKind)` from a legitimate
   *      tenant write, the conflict-update path still has to refuse
   *      a cross-tenant overwrite. Adding `where: agency_id =
   *      scope` to `onConflictDoUpdate` means a mismatched-tenant
   *      conflict fails the WHERE, `.returning()` yields `[]`, and
   *      the throw below fires — surfacing the bug loudly.
   *
   * Both protections were added in response to Inspector Brad's
   * findings on PR #45 (HIGH in the 2nd sweep, MEDIUM in the 3rd
   * for the INSERT-path follow-up). `leads.id` is a UUIDv4 so the
   * realistic exploit window is narrow, but the application
   * defence is independent of guessability.
   *
   * A future hardening pass could replace this with a compound FK
   * `(lead_id, agency_id) REFERENCES leads(id, agency_id)` for
   * DB-level enforcement, but that's a migration change for
   * another PR.
   */
  async upsert(input: {
    leadId: string;
    crmKind: string;
    externalId: string;
  }): Promise<LeadExternalRefRow> {
    // (1) Pre-insert verify — reject cross-tenant leadId before any write.
    const [owned] = await this.db
      .select({ id: leads.id })
      .from(leads)
      .where(and(eq(leads.id, input.leadId), this.scopeWhere(leads.agencyId)))
      .limit(1);
    if (!owned) {
      throw new Error(
        `LeadExternalRefsRepository.upsert — lead ${input.leadId} does not belong to this agency`,
      );
    }

    // (2) INSERT … ON CONFLICT … WHERE agency_id = scope.
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
