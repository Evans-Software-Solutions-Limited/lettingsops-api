# Phase 2 — CRM & Booking Adapters: Design

## 1. The ports

Two TypeScript interfaces, one file each, no implementation in the same file.

### 1.1 `CrmAdapter`

```ts
// microservices/core/src/application/adapters/crm/crmAdapter.ts

export interface CrmLead {
  leadId: string; // our internal id
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
  startsAt: string; // ISO 8601
  endsAt: string;
  externalCalendarEventId?: string;
}

export interface CrmAdapter {
  readonly kind: string; // "noop" | "csv_export" | "reapit" | "alto" | ...
  pushLead(lead: CrmLead): Promise<{ externalId: string }>;
  updateLeadStatus(leadId: string, status: LeadStatus): Promise<void>;
  pushQualification(q: CrmQualification): Promise<void>;
  pushViewing(v: CrmViewing): Promise<{ externalId: string }>;
}
```

`externalId` is the CRM's id for the entity, persisted into a new `lead_external_refs` table so the adapter knows whether a `pushLead` is an insert or an update on retry.

### 1.2 `SlotSourceAdapter`

```ts
// microservices/core/src/application/adapters/booking/slotSourceAdapter.ts

export interface Slot {
  id: string; // adapter-defined; stable for the day
  propertyRef: string;
  startsAt: string; // ISO 8601
  endsAt: string;
  agentId?: string; // estate_agent.id if assignable
}

export interface BookingRequest {
  slotId: string;
  leadId: string;
  propertyRef: string;
  tenantName: string;
  tenantEmail: string;
  tenantPhone?: string;
}

export interface SlotSourceAdapter {
  readonly kind: string; // "mock" | "google_calendar" | "outlook_365" | ...
  getAvailableSlots(
    propertyRef: string,
    from: string,
    to: string,
  ): Promise<Slot[]>;
  bookSlot(
    req: BookingRequest,
  ): Promise<{ externalEventId: string; confirmedAt: string }>;
  cancelSlot(externalEventId: string): Promise<void>;
}
```

## 2. Configuration & dispatch

### 2.1 Schema

New table `agency_integrations`:

```ts
export const agencyIntegrations = pgTable("agency_integrations", {
  id: uuid("id").primaryKey().defaultRandom(),
  agencyId: uuid("agency_id")
    .notNull()
    .references(() => agencies.id, { onDelete: "cascade" })
    .unique(),
  crmAdapterKind: text("crm_adapter_kind").notNull().default("noop"), // matches CrmAdapter.kind
  crmCredentialsSecret: text("crm_credentials_secret"), // SST secret name
  slotAdapterKind: text("slot_adapter_kind").notNull().default("mock"), // matches SlotSourceAdapter.kind
  slotCredentialsSecret: text("slot_credentials_secret"),
  slotGranularityMinutes: integer("slot_granularity_minutes")
    .notNull()
    .default(30),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
```

One row per agency. Defaults are safe (`noop` CRM, `mock` slots) so a newly created agency keeps working even before configuration.

New table `lead_external_refs` to support idempotent CRM push:

```ts
export const leadExternalRefs = pgTable(
  "lead_external_refs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    agencyId: uuid("agency_id")
      .notNull()
      .references(() => agencies.id, { onDelete: "cascade" }),
    leadId: uuid("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    crmKind: text("crm_kind").notNull(), // matches the adapter kind it came from
    externalId: text("external_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("lead_external_refs_lead_kind_idx").on(t.leadId, t.crmKind),
  ],
);
```

A parallel `viewing_external_refs` table for the viewing case.

### 2.2 Dispatcher

A small factory `microservices/core/src/application/adapters/registry.ts`:

```ts
export async function getCrmAdapter(agencyId: string): Promise<CrmAdapter> {
  const cfg = await agencyIntegrationsRepo.findForAgency(agencyId);
  switch (cfg.crmAdapterKind) {
    case "noop":        return new NoopCrmAdapter();
    case "csv_export":  return new CsvExportCrmAdapter(await loadCreds(cfg.crmCredentialsSecret), agencyId);
    case "reapit":      return new ReapitCrmAdapter(await loadCreds(cfg.crmCredentialsSecret));
    default:            throw new Error(`Unknown CRM adapter: ${cfg.crmAdapterKind}`);
  }
}

export async function getSlotSourceAdapter(agencyId: string): Promise<SlotSourceAdapter> { ... }
```

A small in-memory cache (10 second TTL) sits in front of `findForAgency` to avoid hitting the DB on every request. Cache key is `agencyId`; invalidation is on `agency_integrations` write.

`loadCreds(secretName)` reads from SST secrets at runtime. Each adapter accepts its credentials object in the constructor — no env-var sprinkling inside adapters.

### 2.3 Hook points in existing services

| Service                                 | Existing behaviour                          | New behaviour                                                                                                         |
| --------------------------------------- | ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `leadsCreateService`                    | Writes lead row only                        | Writes lead row, then `await getCrmAdapter(agencyId).pushLead(...)` via the retry helper                              |
| `leadsRepository.updateStatus`          | Persists status only                        | After persist, enqueues a `crm.updateLeadStatus` retry event                                                          |
| `qualificationSubmitService`            | Writes qualification row                    | After persist, enqueues `crm.pushQualification`                                                                       |
| `viewingSlotsService.getAvailableSlots` | Throws Not Implemented                      | Returns `await getSlotSourceAdapter(agencyId).getAvailableSlots(...)`, filtered through agency `availability_windows` |
| `viewingBookService.bookViewing`        | Persists viewing row with no calendar write | First calls `getSlotSourceAdapter(...).bookSlot(...)`, persists `externalEventId`, then enqueues `crm.pushViewing`    |
| `elevenLabsWebhookService`              | Creates lead from call                      | Same plus CRM push via the lead-create path                                                                           |
| `emailProcessor` (Lambda)               | Creates lead from email                     | Same plus CRM push                                                                                                    |

### 2.4 Retry helper

A single function `retryIntegrationCall(name, fn, ctx)`:

- Records the attempt in `integration_events` table.
- Runs `fn`. On `IntegrationError` retries at 1s, 5s, 30s; on success marks the row succeeded.
- On final failure marks `failed-permanent`. Does **not** throw out of the calling service — CRM failures must not block lead creation. Surfacing happens via the dashboard.

`integration_events` table:

```ts
export const integrationEvents = pgTable("integration_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  agencyId: uuid("agency_id").notNull(),
  call: text("call").notNull(), // "crm.pushLead" | ...
  refId: text("ref_id"), // leadId / viewingId / etc.
  status: text("status").notNull(), // "pending" | "succeeded" | "retrying" | "failed_permanent"
  attempts: integer("attempts").notNull().default(0),
  lastError: text("last_error"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
```

In-process retries cover transient failure. For longer-term retry (e.g. CRM down for an hour) introduce an SQS queue + scheduled re-driver Lambda in a follow-up; the design here keeps Phase 2 scope tight and uses a dashboard alarm to surface the case.

## 3. Reference implementations

### 3.1 `NoopCrmAdapter`

```ts
class NoopCrmAdapter implements CrmAdapter {
  readonly kind = "noop";
  pushLead = async (lead: CrmLead) => ({ externalId: `noop-${lead.leadId}` });
  updateLeadStatus = async () => {};
  pushQualification = async () => {};
  pushViewing = async (v: CrmViewing) => ({
    externalId: `noop-${v.viewingId}`,
  });
}
```

Safe default for un-configured agencies. Logs every call at `info`.

### 3.2 `CsvExportCrmAdapter`

- Construction: `new CsvExportCrmAdapter(creds, agencyId)` where `creds` contains S3 bucket name (creds object format: `{ bucket: string }`).
- `pushLead` / `pushQualification` / `pushViewing` append rows to `s3://{bucket}/{agencyId}/{yyyymmdd}/{kind}.csv`.
- Daily file rotation by date; concurrency safety via `S3:GetObject + PutObject` with an If-Match precondition on the ETag.
- Returns `externalId` as `csv-{agencyId}-{yyyymmdd}-{rowNumber}`.

### 3.3 `MockCrmAdapter` and `MockSlotSourceAdapter`

- Live in `microservices/core/src/application/adapters/__mocks__/`.
- Both expose `calls` arrays and `recorded.{methodName}` getters for assertions.
- Both honour an injected clock so booking timestamps are deterministic in tests.

### 3.4 `GoogleCalendarSlotSourceAdapter`

- Uses `googleapis` npm package; auth via service account JSON in SST secret.
- One Google Calendar per estate_agent — the calendar id is on `estate_agents.calendarId`.
- `getAvailableSlots`: `freeBusy.query` for the relevant calendars in the window, intersect with `availability_windows`, partition into `slotGranularityMinutes` slices.
- `bookSlot`: `events.insert` with `attendees` and `reminders`.
- `cancelSlot`: `events.delete`.
- Quotas: log when within 10% of the daily quota; alarm if exceeded.

## 4. Contract tests

A single shared suite at `microservices/core/src/application/adapters/__tests__/crmAdapterContract.test.ts` and a sibling for slot source. The suite is parameterised:

```ts
const adapters: Array<[string, () => CrmAdapter]> = [
  ["NoopCrmAdapter", () => new NoopCrmAdapter()],
  [
    "CsvExportCrmAdapter",
    () => new CsvExportCrmAdapter(testBucket, "agency-1"),
  ],
  ["MockCrmAdapter", () => new MockCrmAdapter()],
];

adapters.forEach(([name, factory]) => {
  describe(`${name} (contract)`, () => {
    /* shared spec */
  });
});
```

A new adapter cannot land without adding itself to this list. This is the rule that prevents drift.

## 5. Dashboard surface

New `Integrations` page in `packages/web`:

- A table of agencies × adapter kinds × last-success / last-failure timestamps.
- A drilldown showing the latest 50 `integration_events` rows for that agency.
- A "Re-run" button that re-enqueues a failed event (admin-only, API-key auth).

## 6. Files touched (initial estimate)

- New: `microservices/core/src/application/adapters/{crm,booking}/*.ts` plus `__mocks__/`, `__tests__/`, and a top-level `registry.ts` and `retry.ts`.
- New: `microservices/core/src/application/adapters/CLAUDE.md` documenting the ports.
- New: `packages/db/migrations/0002_agency_integrations.sql` (and snapshot update) covering `agency_integrations`, `lead_external_refs`, `viewing_external_refs`, `integration_events`.
- New: SST secret `LettingsOpsGoogleServiceAccount` (per agency credentials reference is what's stored; the actual credential payload is per-secret).
- Updated: `leadsCreateService`, `viewingSlotsService`, `viewingBookService`, `qualificationSubmitService`, `elevenLabsWebhookService`, `emailProcessor`.
- Updated: `packages/web/src/pages` to add the Integrations page; new `useIntegrationEvents` hook.

## 7. Risks

- **Google Calendar quota.** Mitigation: in-process slot cache (per propertyRef × window, 60s TTL); fallback to `MockSlotSourceAdapter` on quota exhaustion with a clear dashboard signal.
- **Adapter "abstraction tax" with one real provider.** Mitigation: keep the port surface as small as possible; resist adding methods until a second adapter pulls them in.
- **CRM push timing — when exactly to call.** Mitigation: defer the CRM call to _after_ the local write commits, never inside the same transaction; this gives us "best-effort + retry" semantics rather than a distributed-transaction headache.
