# Phase 2 — CRM & Booking Adapters: Requirements

## Objective

Introduce provider-agnostic abstractions for CRM and calendar/booking integrations, with one reference implementation each, so that LettingsOps can be configured per-agency without code changes. The agreed strategy on 2026-05-19 is: define the ports first, ship one reference adapter, let the client confirm the real provider, then plug in the real adapter.

## In scope

- A `CrmAdapter` port covering the surface needed by the lead and viewing lifecycle.
- A `SlotSourceAdapter` port covering calendar reads and booking writes.
- One reference implementation of each (mock for tests, plus a thin real implementation — Google Calendar for booking, CSV-export for CRM).
- Per-agency configuration: which adapter, with what credentials.
- Dispatcher wiring so existing services (`viewingSlotsService`, `viewingBookService`, lead creation, status transitions) route through the adapters.
- 90% test coverage on adapter contracts, dispatcher logic, and reference implementations.

## Out of scope

- A second real CRM adapter — that lands once the client confirms which CRM to support.
- Voice provider migration (Phase 3).
- Production tenant onboarding (Phase 4).

## Dependencies on Phase 1

- Tenant isolation must be live: the dispatcher reads adapter configuration scoped to `agencyId`.
- API auth must be enforced: the per-agency `agencyId` is taken from authenticated context, not from request bodies.

## User stories with acceptance criteria

### US-2.1 — As an agency, I want my LettingsOps leads pushed into my CRM automatically so that my team works from one system of record

**Acceptance criteria**

- When a lead is created (any source: email, phone, manual, portal), the `CrmAdapter.pushLead` method is called.
- When a lead's status transitions, `CrmAdapter.updateLeadStatus` is called.
- When a qualification is submitted, `CrmAdapter.pushQualification` is called.
- When a viewing is booked, `CrmAdapter.pushViewing` is called.
- All four calls are idempotent: re-invocation with the same payload does not create duplicates in the CRM (the adapter handles this either via the CRM's own dedupe or a local mapping table).
- All four calls handle failure without dropping data: a failed push is retried (in-band first, then via a DLQ-style fallback queue) and surfaced on a dashboard.

### US-2.2 — As an agency, I want my CRM choice configurable without a redeploy

**Acceptance criteria**

- A new `agency_integrations` table holds, per agency, the CRM adapter type (e.g. `mock`, `csv_export`, `reapit`, `alto`) and a credentials reference (an opaque key pointing to an SST secret).
- Changing the row swaps the active adapter on the next request, no redeploy required.
- A `NoopCrmAdapter` exists as a safe default for agencies that haven't configured CRM yet (logs the call, returns success).
- Tests cover: missing config falls back to noop; unknown type raises a clear error at startup, not at request time.

### US-2.3 — As an agency, I want my viewing slots driven by my real calendar so my agents aren't double-booked

**Acceptance criteria**

- `viewingSlotsService.getAvailableSlots(propertyRef, from, to)` returns real slots from the configured `SlotSourceAdapter` for that agency.
- Slot granularity is 30 minutes by default; configurable per agency via `agency_integrations`.
- Slots already booked in the source calendar are excluded.
- Agency availability_windows (existing schema) are honoured: a slot must fall inside an agent's working hours to appear.
- If the calendar fetch fails, the service returns a clearly-typed error (not an empty array) so the dashboard can surface "calendar unavailable" rather than "no slots".

### US-2.4 — As an agency, I want bookings written to my real calendar so the agent sees them

**Acceptance criteria**

- `viewingBookService.bookViewing` calls `SlotSourceAdapter.bookSlot(slotId, leadId, propertyRef)`.
- Booking returns an external event ID, which is persisted to `viewings.calendarEventId`.
- A booking is only confirmed in our DB if the calendar write succeeds — the existing TODO ("confirm slot is still available via calendar service") becomes a real check.
- Cancellation (when added) routes through `SlotSourceAdapter.cancelSlot(externalEventId)`.

### US-2.5 — As a developer, I want a single mock implementation of each adapter for use in tests so I don't have to mock the network

**Acceptance criteria**

- `MockCrmAdapter` and `MockSlotSourceAdapter` exist in `microservices/core/src/application/adapters/`.
- Both record every call in-memory and expose assertion helpers (`expectLeadPushed(id)`, `expectSlotBooked(slotId)`).
- All Phase 2 tests use the mocks; no real Google or external network in unit tests.

### US-2.6 — As an operator, I want a Google Calendar reference adapter so we can demo against a real calendar without picking a CRM yet

**Acceptance criteria**

- `GoogleCalendarSlotSourceAdapter` exists, authenticates with a Google service account, reads `freeBusy` against the configured calendar id, returns free slots.
- Booking creates an event with title, description (lead name + property), attendees (agent + tenant email), and reminders.
- Integration test (gated behind an env var so it doesn't run in CI without credentials) confirms the round trip against a real Google calendar in a sandbox project.

### US-2.7 — As an operator, I want a CSV-export CRM reference adapter so we can stand up an agency without picking a CRM yet

**Acceptance criteria**

- `CsvExportCrmAdapter` exists, writes one row per `pushLead` / `pushQualification` / `pushViewing` call to an S3 bucket scoped per agency.
- File naming: `{agencyId}/{yyyymmdd}/leads.csv`, `{agencyId}/{yyyymmdd}/viewings.csv`, etc., appended to throughout the day.
- A dashboard widget surfaces "last export at" timestamp per agency.

### US-2.8 — As an operator, I want failed integration calls retried and observable

**Acceptance criteria**

- Adapter failures throw a typed `IntegrationError` carrying the attempt count, the originating call, and a hint at the operator action needed.
- A per-agency `integration_events` table records every call and its outcome (success / retrying / failed-permanent).
- A simple retry policy: 3 attempts at 1s / 5s / 30s. After three failures, mark `failed-permanent` and surface on the dashboard.
- Alarm fires when more than 5 events in 15 minutes hit `failed-permanent` for a single agency.

## Non-functional requirements

- **Test coverage:** 90% on adapters, dispatcher, and contracts. Contract tests run all implementations against the same suite to prevent drift.
- **Configuration:** No adapter selection in code; everything via `agency_integrations` rows.
- **Performance budget:** Adapter dispatch adds < 10 ms p95 on top of the underlying call.
- **Documentation:** `microservices/core/src/application/adapters/CLAUDE.md` documents the port contracts and the rule that new adapters must include a contract test entry.

## Definition of done

All eight user stories' acceptance criteria pass; the pre-merge gate is green; preprod runs an end-to-end test booking a viewing into a real Google Calendar; spec's `tasks.md` is fully checked.
