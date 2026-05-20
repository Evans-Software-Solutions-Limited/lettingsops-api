# Phase 2 — CRM & Booking Adapters: Tasks

## Block A — Ports & registry (foundations)

- [ ] **A1.** Add `microservices/core/src/application/adapters/CLAUDE.md` describing the port-and-adapter pattern and the contract-test rule.
- [ ] **A2.** Create `adapters/crm/crmAdapter.ts` per design §1.1. Type-only file, no implementation.
- [ ] **A3.** Create `adapters/booking/slotSourceAdapter.ts` per design §1.2. Type-only.
- [ ] **A4.** Add the `IntegrationError` class with attempt-count, call name, and a `retryable` flag.

## Block B — Schema

- [ ] **B1.** Add `agency_integrations`, `lead_external_refs`, `viewing_external_refs`, and `integration_events` tables to `packages/db/src/schema.ts`. Defaults: `crmAdapterKind="noop"`, `slotAdapterKind="mock"`.
- [ ] **B2.** Generate the migration and snapshot. Backfill: for every existing agency, insert a default `agency_integrations` row.
- [ ] **B3.** New repos: `AgencyIntegrationsRepository`, `LeadExternalRefsRepository`, `ViewingExternalRefsRepository`, `IntegrationEventsRepository`. All tenant-scoped (Phase 1 base class).

## Block C — Retry helper & registry

- [ ] **C1.** Implement `retryIntegrationCall` in `adapters/retry.ts`. Backoff schedule from design §2.4. Always records into `integration_events`.
- [ ] **C2.** Implement `registry.ts` with `getCrmAdapter(agencyId)` and `getSlotSourceAdapter(agencyId)`. 10-second TTL cache. Unknown kind → startup-time error during a warm-up call (see C4), not request-time.
- [ ] **C3.** Add adapter credential loading helper that reads SST secrets at runtime.
- [ ] **C4.** Add a startup warm-up step in `microservices/core/src/api.ts` that loads each agency's configured adapters once and fails loudly on unknown kinds. (Not blocking; logs and alerts if anything fails.)

## Block D — Reference adapters

- [ ] **D1.** Implement `NoopCrmAdapter` per design §3.1. Tests assert the four methods are no-ops and return the right shape.
- [ ] **D2.** Implement `MockCrmAdapter` per design §3.3 with the `calls` recorder.
- [ ] **D3.** Implement `MockSlotSourceAdapter` per design §3.3.
- [ ] **D4.** Implement `CsvExportCrmAdapter` per design §3.2. S3 client wrapper with ETag precondition for concurrent appends. Integration test using LocalStack (or the SST equivalent).
- [ ] **D5.** Implement `GoogleCalendarSlotSourceAdapter` per design §3.4. Unit tests mock `googleapis`. Add a gated integration test that runs only when `GOOGLE_INTEGRATION=1` is set.

## Block E — Contract tests

- [ ] **E1.** Add `adapters/__tests__/crmAdapterContract.test.ts` parameterised over the list of implementations. Tests cover: pushLead returns externalId, pushLead idempotent on retry (same input → same externalId), updateLeadStatus accepts every status enum value, pushQualification persists, pushViewing returns externalId.
- [ ] **E2.** Add `adapters/__tests__/slotSourceAdapterContract.test.ts`. Tests cover: getAvailableSlots returns slots within window, bookSlot returns externalEventId, cancelSlot succeeds, bookSlot on already-booked slot raises a typed error.
- [ ] **E3.** CI gate: any new adapter must register itself in the parameter list; lint rule (or convention test) checks for it.

## Block F — Service wiring

- [ ] **F1.** Update `leadsCreateService` to call `getCrmAdapter(agencyId).pushLead` via `retryIntegrationCall` after the lead row commits. Record the resulting `externalId` in `lead_external_refs`.
- [ ] **F2.** Update `leadRepository.updateStatus` to enqueue `crm.updateLeadStatus` via `retryIntegrationCall` after persist. Same for `qualificationSubmitService`.
- [ ] **F3.** Replace `viewingSlotsService.getAvailableSlots`'s Not-Implemented stub with adapter dispatch + availability_windows filter.
- [ ] **F4.** Update `viewingBookService.bookViewing` to: (a) call `bookSlot` on the adapter, (b) persist `viewings.calendarEventId` from `externalEventId`, (c) enqueue `crm.pushViewing`. If `bookSlot` fails, do not persist the viewing row — propagate as 409 to the API caller.
- [ ] **F5.** Update `elevenLabsWebhookService` and `emailProcessor` to push the created lead through the CRM (same lead-create path as F1).

## Block G — Dashboard

- [ ] **G1.** Add `useIntegrationEvents(agencyId)` hook in `packages/web/src/hooks/api/`.
- [ ] **G2.** Add Integrations page with the table per design §5. Container/Presenter split. Tests for both.
- [ ] **G3.** Add "Re-run" action that calls a new admin endpoint to re-enqueue a failed event.
- [ ] **G4.** Surface the per-agency last-success / last-failure timestamps on the home dashboard (no drilldown — just a chip).

## Block H — Observability

- [ ] **H1.** Add custom CloudWatch metrics: `IntegrationCallCount` and `IntegrationCallFailures` with dimensions (call, agencyId, adapter).
- [ ] **H2.** Add alarm: > 5 `failed_permanent` events in 15 min for a single agency. SNS target from Phase 1.
- [ ] **H3.** Add Phase 1 PII-scrubbing keys for the new payloads (e.g. `tenantName`, `tenantEmail` already covered).

## Acceptance checklist

- [ ] All tasks above ticked.
- [ ] Pre-merge gate green; coverage maintained at 90%+.
- [ ] Contract suite runs all adapter implementations and passes.
- [ ] Preprod demo: configure agency `A` for Google Calendar + Csv-export CRM; book a viewing end-to-end; event appears in real Google Calendar; CSV row appears in S3.
- [ ] Spec's `requirements.md` definition of done is satisfied.
