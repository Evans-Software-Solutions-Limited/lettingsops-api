/**
 * TenantScopedRepository — base class for every repository that touches
 * a tenant-owned table.
 *
 * The contract: an instance constructed with `agencyId = "<uuid>"` will
 * filter every read by that agency and inject it into every write. An
 * instance constructed with the sentinel `ANY_AGENCY` ("__any__")
 * bypasses the filter for reads and lets the column's transitional
 * DEFAULT (`LEGACY_AGENCY_ID`) fill in writes.
 *
 * Why the sentinel still exists: the HTTP layer no longer needs it —
 * `.use(auth)` is mounted on every business handler and resolves a real
 * `agencyId` before service code runs (auth is always on; missing creds
 * → 401). The remaining users of `ANY_AGENCY` are the two webhook
 * subsystems that legitimately have NO caller-supplied auth context:
 *
 *   - **Email ingestion** (`application/ingestion/email/`) — inbound
 *     mail. The Lambda path resolves agencyId from the recipient
 *     address; the HTTP wrapper currently falls through to the sentinel
 *     until that resolver is shared.
 *   - **ElevenLabs phone webhook** (`application/webhooks/elevenlabs/`)
 *     — payload carries `agentId`, not `agencyId`. The
 *     `agentId → agencyId` lookup table is the planned follow-up that
 *     finally retires the sentinel.
 *
 * Both follow-ups are tracked in `.kiro/specs/01-platform-hardening/
 * tasks.md` (Block I — Webhook agency resolution). Until then the
 * sentinel must stay; grep for `ANY_AGENCY` to find every escape-hatch
 * callsite.
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
 * Sentinel value for webhook callers that cannot supply an `agencyId`
 * at construction time (see the class header — email ingestion and
 * ElevenLabs phone). HTTP handlers MUST NOT use this sentinel; the auth
 * plugin always resolves a real `agencyId` before service code runs.
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
   * column's transitional DEFAULT (LEGACY_AGENCY_ID) fills in. Once
   * Block I lands the webhook agency-resolution lookups, the DEFAULT
   * and this branch can be removed together.
   */
  protected writeAgencyId(): string | undefined {
    return this.isAny() ? undefined : this.agencyId;
  }
}

/** Drop `undefined` entries from an SQL predicate list. */
export function filterPredicates(predicates: Array<SQL | undefined>): SQL[] {
  return predicates.filter((p): p is SQL => p !== undefined);
}
