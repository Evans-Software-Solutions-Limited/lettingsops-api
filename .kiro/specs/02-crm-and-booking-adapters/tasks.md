# Phase 2 — CRM & Booking Adapters: Tasks

## Block A — Ports & registry (foundations)

- [x] **A1.** `microservices/core/src/application/adapters/CLAUDE.md` added: covers when to add a new adapter, the type-only-port convention, the `kind`-is-persisted "never rename" rule, the contract-test registration rule, and the `IntegrationError` policy (transient via `IntegrationError`, permanent misconfig via plain `Error`). Cross-references the spec + the upcoming Block C/D/E files. _Landed in the spec-02 Block A kickoff PR._
- [x] **A2.** `adapters/crm/crmAdapter.ts` — type-only port. `CrmLead`, `CrmQualification`, `CrmViewing` payload shapes + `CrmAdapter` interface (`kind`, `pushLead`, `updateLeadStatus`, `pushQualification`, `pushViewing`). `LeadStatus` imported from `repositories/leadRepository` (canonical owner — extracting domain types to a shared module is out of scope for Block A and recorded as a future refactor in the file header). Idempotency contract documented inline.
- [x] **A3.** `adapters/booking/slotSourceAdapter.ts` — type-only port. `Slot`, `BookingRequest` payload shapes + `SlotSourceAdapter` interface (`kind`, `getAvailableSlots`, `bookSlot`, `cancelSlot`). External-event-id idempotency contract documented.
- [x] **A4.** `adapters/integrationError.ts` — class with `call`, `attempt`, `retryable` (default `true`), uses the standard ES2022 `cause` slot for chained errors so `formatError`-style helpers walk it. 8 unit tests cover construction, defaults, retryable false (permanent), cause attached + unset, name field, `instanceof` checks.

## Block B — Schema

- [x] **B1.** All 4 tables added to `packages/db/src/schema.ts`. `agency_integrations` (one-row-per-agency via UNIQUE on `agency_id`, defaults `crmAdapterKind="noop"` / `slotAdapterKind="mock"` / `slotGranularityMinutes=30`). `lead_external_refs` (unique index on `(lead_id, crm_kind)`). `viewing_external_refs` (unique index on `(viewing_id, crm_kind)`). `integration_events` (status as `text` not enum so future states don't need migrations — `IntegrationEventsRepository` is the validation surface). Row + NewRow types exported for each.
- [x] **B2.** Migration `0005_agency_integrations_and_supporting.sql` generated via `drizzle-kit generate`. Hand-edited to append the backfill: `INSERT INTO agency_integrations (agency_id) SELECT id FROM agencies ON CONFLICT (agency_id) DO NOTHING` — idempotent on re-run, gives every existing agency the noop/mock defaults without an operator step. Snapshot + journal updated.
- [x] **B3.** Four new tenant-scoped repos under `microservices/core/src/application/repositories/`: `agencyIntegrationsRepository.ts` (`findForAgency`, `update` with partial-input + always-bumps-updatedAt), `leadExternalRefsRepository.ts` (`findByLeadAndKind`, `upsert` via `ON CONFLICT (lead_id, crm_kind) DO UPDATE`), `viewingExternalRefsRepository.ts` (same shape against viewings), `integrationEventsRepository.ts` (`create`, `updateStatus`, `listForAgency` with status/call/refId filters + 50-row default / 500-row cap). All extend `TenantScopedRepository`. 24 unit tests across the four files using the chainable-Drizzle mock pattern from Phase 1.

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
