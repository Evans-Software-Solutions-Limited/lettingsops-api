/**
 * SlotSourceAdapter — outbound port for reading viewing availability
 * and booking against a tenant's calendar.
 *
 * Design: `.kiro/specs/02-crm-and-booking-adapters/design.md` §1.2.
 * Pattern: see sibling `../CLAUDE.md`.
 *
 * **Type-only file** — no implementation. Reference adapters live in
 * `./mock.ts`, `./googleCalendar.ts`, etc. (Block D).
 */

export interface Slot {
  /**
   * Adapter-defined id, stable for the day. Used as the booking-side
   * handle in `BookingRequest.slotId` and in dashboard URLs.
   */
  id: string;
  propertyRef: string;
  /** ISO 8601 timestamp. */
  startsAt: string;
  /** ISO 8601 timestamp. */
  endsAt: string;
  /** `estate_agents.id` if the slot is bound to a specific agent. */
  agentId?: string;
}

export interface BookingRequest {
  slotId: string;
  leadId: string;
  propertyRef: string;
  tenantName: string;
  tenantEmail: string;
  tenantPhone?: string;
}

/**
 * Provider-agnostic calendar port.
 *
 * `bookSlot` returns an `externalEventId` which the caller persists
 * into `viewing_external_refs`. The retry helper uses this to
 * idempotently update / cancel the same event on subsequent attempts
 * — a transient failure mid-call must not produce a duplicate calendar
 * entry.
 */
export interface SlotSourceAdapter {
  /**
   * Identifier persisted in `agency_integrations.slot_adapter_kind`.
   * Examples: `"mock"`, `"google_calendar"`, `"outlook_365"`.
   *
   * Don't rename once live — agency rows reference by value.
   */
  readonly kind: string;

  /**
   * Return slots within `[from, to)` for the given property. The
   * window bounds are ISO 8601 date or date-time strings; adapters
   * may treat date-only inputs as midnight in the property's locale.
   * Filtering by `availability_windows` happens in the calling
   * service — adapters return raw provider availability.
   */
  getAvailableSlots(
    propertyRef: string,
    from: string,
    to: string,
  ): Promise<Slot[]>;

  bookSlot(
    request: BookingRequest,
  ): Promise<{ externalEventId: string; confirmedAt: string }>;

  cancelSlot(externalEventId: string): Promise<void>;
}
