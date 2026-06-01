/**
 * CrmAdapter — outbound port for pushing lead lifecycle events into a
 * tenant's CRM of choice.
 *
 * Design: `.kiro/specs/02-crm-and-booking-adapters/design.md` §1.1.
 * Pattern: see sibling `../CLAUDE.md`.
 *
 * **Type-only file** — no implementation. Reference adapters live in
 * `./noop.ts`, `./mock.ts`, `./csvExport.ts`, etc. (Block D).
 *
 * Why `LeadStatus` is imported from `leadRepository` rather than
 * redefined or extracted to a shared types module: the repo is today's
 * canonical owner of the lead-status enum (lead_status pg enum in the
 * schema, the TypeScript union). Re-declaring it here would drift; a
 * future refactor extracting domain types to a top-level `types/`
 * folder is fine, but out of scope for Phase 2 Block A.
 */
import type { LeadStatus } from "../../repositories/leadRepository";

export interface CrmLead {
  /** Our internal lead id (`leads.id` UUID). */
  leadId: string;
  name: string;
  email: string;
  phone?: string;
  propertyRef?: string;
  source: "email" | "phone" | "portal" | "manual";
  status: LeadStatus;
  metadata?: Record<string, unknown>;
}

export interface CrmQualification {
  leadId: string;
  qualificationId: string;
  score: number;
  category: "LOW" | "MEDIUM" | "STRONG";
  answers: Record<string, unknown>;
}

export interface CrmViewing {
  leadId: string;
  viewingId: string;
  propertyRef: string;
  /** ISO 8601 timestamp. */
  startsAt: string;
  /** ISO 8601 timestamp. */
  endsAt: string;
  /** Set when the calendar adapter produced one (e.g. Google event id). */
  externalCalendarEventId?: string;
}

/**
 * Provider-agnostic CRM port. Implementations live in this directory.
 *
 * Idempotency contract: `pushLead` and `pushViewing` return an
 * `externalId` that the caller persists into the matching
 * `*_external_refs` table. On retry the adapter is expected to use the
 * stored `externalId` to update-rather-than-insert, so a transient
 * failure followed by a retry must NOT create a duplicate record in
 * the CRM.
 */
export interface CrmAdapter {
  /**
   * Identifier persisted in `agency_integrations.crm_adapter_kind`.
   * Examples: `"noop"`, `"mock"`, `"csv_export"`, `"reapit"`, `"alto"`.
   *
   * Don't rename a `kind` once it's live in production —
   * `agency_integrations` rows reference it by value, and rename =
   * silent breakage. Add new kinds; deprecate old ones with a
   * migration.
   */
  readonly kind: string;

  pushLead(lead: CrmLead): Promise<{ externalId: string }>;

  updateLeadStatus(leadId: string, status: LeadStatus): Promise<void>;

  pushQualification(qualification: CrmQualification): Promise<void>;

  pushViewing(viewing: CrmViewing): Promise<{ externalId: string }>;
}
