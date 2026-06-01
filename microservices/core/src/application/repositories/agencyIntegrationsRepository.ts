/**
 * AgencyIntegrationsRepository
 *
 * Per-agency adapter configuration: which CRM and slot-source adapter
 * to use, plus the SST secret names that store each adapter's
 * credentials. Tenant-scoped — the constructor takes the caller's
 * `agencyId` and every method filters by it.
 *
 * Block C's `registry.ts` reads `findForAgency` with a 10-second TTL
 * cache to build the per-request adapter instance. The dashboard's
 * Integrations page (spec §5) reads + writes through this repo.
 *
 * Spec: `.kiro/specs/02-crm-and-booking-adapters/design.md` §2.1.
 */
import { and } from "drizzle-orm";
import {
  type Db,
  agencyIntegrations,
  type AgencyIntegrationsRow,
} from "@lettingsops/db";
import {
  TenantScopedRepository,
  filterPredicates,
} from "./tenantScopedRepository";

export interface UpdateAgencyIntegrationsInput {
  crmAdapterKind?: string;
  crmCredentialsSecret?: string | null;
  slotAdapterKind?: string;
  slotCredentialsSecret?: string | null;
  slotGranularityMinutes?: number;
}

export class AgencyIntegrationsRepository extends TenantScopedRepository {
  static readonly key = "AgencyIntegrationsRepository";

  constructor(db: Db | undefined, agencyId: string) {
    super(db, agencyId);
  }

  /**
   * Return the single configuration row for the scope's agency, or
   * `null` if the backfill hasn't created one yet (e.g. an agency
   * created before this migration ran). Callers in Block C treat
   * null as "fall back to defaults" rather than 500ing.
   */
  async findForAgency(): Promise<AgencyIntegrationsRow | null> {
    const [row] = await this.db
      .select()
      .from(agencyIntegrations)
      .where(
        and(
          ...filterPredicates([this.scopeWhere(agencyIntegrations.agencyId)]),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  /**
   * Partial update — only the keys present in `input` are written.
   * Always bumps `updated_at`. The agency-scope WHERE clause means a
   * caller can't accidentally overwrite a different agency's row even
   * if a bug elsewhere passed the wrong id through.
   */
  async update(
    input: UpdateAgencyIntegrationsInput,
  ): Promise<AgencyIntegrationsRow> {
    const [row] = await this.db
      .update(agencyIntegrations)
      .set({ ...input, updatedAt: new Date() })
      .where(
        and(
          ...filterPredicates([this.scopeWhere(agencyIntegrations.agencyId)]),
        ),
      )
      .returning();

    if (!row)
      throw new Error(
        "AgencyIntegrationsRepository.update — no row updated for this agency. Has the Block B backfill run?",
      );
    return row;
  }
}
