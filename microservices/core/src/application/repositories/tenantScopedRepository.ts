/**
 * TenantScopedRepository — base class for every repository that touches
 * a tenant-owned table.
 *
 * The contract: an instance constructed with `agencyId = "<uuid>"` will
 * filter every read by that agency and inject it into every write. An
 * instance constructed with the sentinel `ANY_AGENCY` ("__any__") bypasses
 * the filter for reads and lets the column's transitional DEFAULT
 * (`LEGACY_AGENCY_ID`, from Block E.0's migration) fill in writes.
 *
 * The sentinel is gross by design. It exists so the migration phase can
 * land in slices without breaking CI at every commit — every callsite
 * that hasn't yet been threaded with a real `agencyId` (from Block D's
 * auth context, once Block F mounts `.use(auth)` on it) passes
 * `ANY_AGENCY` with a TODO. Remove the sentinel once Block F flips
 * `AUTH_ENFORCED=true` in production — grep for `ANY_AGENCY` to find
 * every removal site.
 *
 * Why a base class rather than a method-level argument: the constructor
 * approach means a single misplaced `eq` won't leak data, because every
 * call on that instance carries the constraint by virtue of being on the
 * instance. The base class also makes the contract grep-able — every
 * tenant-owned repo `extends TenantScopedRepository`.
 */
import type { SQL } from "drizzle-orm";
import { eq } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { type Db, getDb } from "@lettingsops/db";

/**
 * Sentinel value for callers that don't yet have a real `agencyId`.
 * See the class header for the migration story.
 *
 * Type-wise this is a plain string so it can be passed anywhere an
 * `agencyId` is expected. The runtime check happens in the helper
 * methods below.
 */
export const ANY_AGENCY = "__any__" as const;
export type AgencyScope = string | typeof ANY_AGENCY;

export abstract class TenantScopedRepository {
  protected readonly db: Db;
  private readonly agencyId: AgencyScope;

  constructor(db: Db | undefined, agencyId: AgencyScope) {
    this.db = db ?? getDb();
    this.agencyId = agencyId;
  }

  /** Read the scoped agency id. The `ANY_AGENCY` sentinel is allowed. */
  protected getAgencyId(): AgencyScope {
    return this.agencyId;
  }

  /** True when the instance is sentinel-scoped (reads unfiltered). */
  protected isAny(): boolean {
    return this.agencyId === ANY_AGENCY;
  }

  /**
   * Build a tenant-scope WHERE predicate for the given `agency_id`
   * column. Returns `undefined` when the instance is sentinel-scoped —
   * subclasses should compose this with their own predicates via
   * `and(...filter([this.scopeWhere(table.agencyId), other...]))`.
   */
  protected scopeWhere(column: AnyPgColumn): SQL | undefined {
    return this.isAny() ? undefined : eq(column, this.agencyId);
  }

  /**
   * Return the value to insert into the `agency_id` column on writes.
   * Returns `undefined` when the instance is sentinel-scoped — the
   * column's transitional DEFAULT (LEGACY_AGENCY_ID) will then fill in.
   * Block E.final removes that DEFAULT, at which point every callsite
   * must construct with a real agencyId.
   */
  protected writeAgencyId(): string | undefined {
    return this.isAny() ? undefined : this.agencyId;
  }
}

/** Drop `undefined` entries from an SQL predicate list. */
export function filterPredicates(
  predicates: Array<SQL | undefined>,
): SQL[] {
  return predicates.filter((p): p is SQL => p !== undefined);
}
