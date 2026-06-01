/**
 * TenantScopedRepository — base class for every repository that touches
 * a tenant-owned table.
 *
 * The contract: an instance is constructed with `agencyId = "<uuid>"`
 * and every read filters by that agency, every write injects it. The
 * constructor approach means a single misplaced `eq` won't leak data
 * because every call on that instance carries the constraint by
 * virtue of being on the instance. The base class also makes the
 * contract grep-able — every tenant-owned repo `extends
 * TenantScopedRepository`.
 *
 * History — the `ANY_AGENCY` sentinel: from Block E.0 through Block I
 * the constructor accepted a `"__any__"` sentinel that bypassed the
 * WHERE clause for reads and let the column DEFAULT fill in writes.
 * It existed so the auth-introduction migration (Block D → F) and the
 * two webhook subsystems (email ingestion, ElevenLabs phone) could
 * land in slices without ever leaving a state where every callsite
 * had to thread a real `agencyId`. Block F retired it from the HTTP
 * layer and Block I-PR-B+C retired it from the webhook services
 * (email via `resolveAgencyFromInboundEmail`, ElevenLabs via the
 * `agent_agency_map` table + `AgentAgencyRepository.findAgencyForAgent`).
 * Block I-PR-D (this PR) deletes the sentinel apparatus entirely —
 * the constructor now requires a real UUID string and the type system
 * blocks any regression.
 */
import type { SQL } from "drizzle-orm";
import { eq } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { type Db, getDb } from "@lettingsops/db";

export abstract class TenantScopedRepository {
  protected readonly db: Db;
  private readonly agencyId: string;

  constructor(db: Db | undefined, agencyId: string) {
    this.db = db ?? getDb();
    this.agencyId = agencyId;
  }

  /** Read the scoped agency id. */
  protected getAgencyId(): string {
    return this.agencyId;
  }

  /**
   * Build a tenant-scope WHERE predicate for the given `agency_id`
   * column. Compose with subclasses' own predicates via
   * `and(this.scopeWhere(table.agencyId), other...)`.
   */
  protected scopeWhere(column: AnyPgColumn): SQL {
    return eq(column, this.agencyId);
  }

  /** Value to insert into the `agency_id` column on writes. */
  protected writeAgencyId(): string {
    return this.agencyId;
  }
}

/**
 * Drop `undefined` entries from an SQL predicate list. Useful when
 * subclasses build predicates conditionally — though now that
 * `scopeWhere()` always returns a defined SQL, the only practical
 * callers are subclasses that mix optional filters of their own.
 */
export function filterPredicates(predicates: Array<SQL | undefined>): SQL[] {
  return predicates.filter((p): p is SQL => p !== undefined);
}
