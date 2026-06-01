/**
 * IntegrationEventsRepository
 *
 * Audit + retry-state log for every outbound adapter call. The retry
 * helper (Block C) creates one row per logical operation up front,
 * then calls `updateStatus` after each attempt. The dashboard
 * Integrations page (spec §5) reads `listForAgency` for the
 * per-tenant success/failure timeline and the per-event drilldown.
 *
 * `status` is `text` rather than a pg enum so adding new states
 * later doesn't require a migration. This repository is the single
 * source of validation — callers should use the `IntegrationStatus`
 * union below, and the type-checker enforces it.
 *
 * Spec: `.kiro/specs/02-crm-and-booking-adapters/design.md` §2.4 + §5.
 */
import { and, desc, eq } from "drizzle-orm";
import {
  type Db,
  integrationEvents,
  type IntegrationEventRow,
} from "@lettingsops/db";
import {
  TenantScopedRepository,
  filterPredicates,
} from "./tenantScopedRepository";

export type IntegrationStatus =
  | "pending"
  | "succeeded"
  | "retrying"
  | "failed_permanent";

export interface CreateIntegrationEventInput {
  /** Named operation, e.g. `crm.pushLead`. */
  call: string;
  /** Optional entity id this event acts on. */
  refId?: string;
  /** Initial status — usually `"pending"`. */
  status: IntegrationStatus;
}

export interface UpdateIntegrationEventInput {
  status: IntegrationStatus;
  /** New attempts total (the retry helper passes the current count). */
  attempts: number;
  /** Last error message, if any. Stored as plain text — keep PII-free. */
  lastError?: string | null;
}

export interface ListFilters {
  status?: IntegrationStatus;
  call?: string;
  refId?: string;
  /** Number of rows to return. Default 50; cap 500 to protect the dashboard. */
  limit?: number;
}

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 500;

export class IntegrationEventsRepository extends TenantScopedRepository {
  static readonly key = "IntegrationEventsRepository";

  constructor(db: Db | undefined, agencyId: string) {
    super(db, agencyId);
  }

  async create(
    input: CreateIntegrationEventInput,
  ): Promise<IntegrationEventRow> {
    const [row] = await this.db
      .insert(integrationEvents)
      .values({
        agencyId: this.writeAgencyId(),
        call: input.call,
        refId: input.refId,
        status: input.status,
        attempts: 0,
      })
      .returning();

    if (!row)
      throw new Error("Failed to create integration_event — no row returned");
    return row;
  }

  /**
   * Update status + attempts + lastError on an existing event. The
   * agency-scope WHERE clause prevents a buggy caller passing the
   * wrong agency from overwriting another tenant's event. Always
   * bumps `updated_at` so the dashboard's "latest activity" column
   * reflects the actual attempt time, not the original create time.
   */
  async updateStatus(
    eventId: string,
    input: UpdateIntegrationEventInput,
  ): Promise<void> {
    await this.db
      .update(integrationEvents)
      .set({
        status: input.status,
        attempts: input.attempts,
        lastError: input.lastError ?? null,
        updatedAt: new Date(),
      })
      .where(
        and(
          ...filterPredicates([
            eq(integrationEvents.id, eventId),
            this.scopeWhere(integrationEvents.agencyId),
          ]),
        ),
      );
  }

  /**
   * Read for the dashboard. Ordered newest-first; `limit` capped at
   * `MAX_LIMIT` so a malformed query string can't drag the database.
   */
  async listForAgency(
    filters: ListFilters = {},
  ): Promise<IntegrationEventRow[]> {
    const limit = Math.min(filters.limit ?? DEFAULT_LIMIT, MAX_LIMIT);

    return this.db
      .select()
      .from(integrationEvents)
      .where(
        and(
          ...filterPredicates([
            this.scopeWhere(integrationEvents.agencyId),
            filters.status
              ? eq(integrationEvents.status, filters.status)
              : undefined,
            filters.call ? eq(integrationEvents.call, filters.call) : undefined,
            filters.refId
              ? eq(integrationEvents.refId, filters.refId)
              : undefined,
          ]),
        ),
      )
      .orderBy(desc(integrationEvents.createdAt))
      .limit(limit);
  }
}
