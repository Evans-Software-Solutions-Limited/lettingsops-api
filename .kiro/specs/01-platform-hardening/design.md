# Phase 1 — Platform Hardening: Design

## 1. Authentication

### 1.1 Two credential types

- **JWT** for the dashboard. Issued at login (out-of-scope — assume an existing IdP or a simple email-magic-link path can stand up alongside this phase). Embeds `agencyId`, `estateAgentId`, role, `exp`.
- **API key** for server-to-server callers. UUIDv4 string, stored hashed in a new `api_keys` table, scoped to a single `agencyId`.

### 1.2 Storage

New table `api_keys` (Drizzle):

```ts
export const apiKeys = pgTable("api_keys", {
  id: uuid("id").primaryKey().defaultRandom(),
  agencyId: uuid("agency_id")
    .notNull()
    .references(() => agencies.id, { onDelete: "cascade" }),
  name: text("name").notNull(), // human label, e.g. "Reapit integration"
  keyHash: text("key_hash").notNull().unique(), // sha-256 of the raw key
  prefix: text("prefix").notNull(), // first 8 chars of raw key, for display
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
```

The raw key is shown to the operator once at creation time and never again. A `keyHash` lookup is what authenticates incoming requests.

JWT signing secret lives in a new SST secret `LettingsOpsJwtSigningKey`. JWT verification uses `jose` (already common) or `jsonwebtoken`. Pick `jose` for its lightweight footprint.

### 1.3 Elysia auth plugin

New plugin at `microservices/core/src/application/auth/authPlugin.ts`:

```ts
export const auth = new Elysia({ name: "auth" }).derive(async ({ request }) => {
  const authz = request.headers.get("authorization") ?? "";
  const apiKey = request.headers.get("x-api-key");

  if (authz.startsWith("Bearer ")) {
    const claims = await verifyJwt(authz.slice(7));
    return {
      agencyId: claims.agencyId,
      estateAgentId: claims.estateAgentId,
      principal: "user" as const,
    };
  }
  if (apiKey) {
    const row = await apiKeyRepository.findActive(sha256(apiKey));
    if (!row) throw new HttpError(401, "Invalid API key");
    await apiKeyRepository.touch(row.id);
    return {
      agencyId: row.agencyId,
      estateAgentId: null,
      principal: "service" as const,
    };
  }
  throw new HttpError(401, "Authentication required");
});
```

Each existing handler is updated to `.use(auth)` and to pull `agencyId` from context. The ElevenLabs and (when added) other webhook routes stay HMAC-only — they're tenant-bound via the webhook configuration rather than per-request auth.

### 1.4 Public routes

Explicit allowlist (any new route must default to private):

- `POST /webhooks/elevenlabs` — HMAC verified.
- `GET /healthz` — a new readiness check (DB ping). No tenant data.
- Email processor Lambda — not on the API at all (S3 event source).

## 2. Tenant isolation at the repository layer

### 2.1 The rule

Every repository method that touches a tenant-owned table either:

- Takes `agencyId` as a first argument, and includes `eq(table.agencyId, agencyId)` in every where-clause; **or**
- Is constructed with `agencyId` (`new LeadRepository(db, agencyId)`) so the constraint is fixed for the lifetime of the instance.

Pick **the constructor approach** for handlers — it means a single misplaced `eq` won't leak data, because every call on that instance carries the constraint. Reserve the per-method `agencyId` argument for the email processor Lambda where the agency is resolved per S3 event.

### 2.2 Refactor footprint

Existing repositories to update:

- `leadRepository.ts` — every read/write currently agency-agnostic.
- `viewingRepository.ts`
- `qualificationRepository.ts`
- `conversationRepository.ts` — already partially tenant-aware (`findByAgencyAndEmail`); audit all methods.
- `agencyRepository.ts` — `agencies` table is keyed by `id` so the question is just "did the caller pass the right id?" — no schema change needed.

Add a base class `TenantScopedRepository` with the `agencyId` private field so the pattern is consistent and the type system enforces it.

### 2.3 Contract tests

New file `microservices/core/src/application/repositories/__tests__/tenantIsolation.test.ts`. Pattern:

- Seed agencies `A` and `B`, each with one of every entity.
- For every repository × every read method, assert that an instance scoped to `A` cannot return `B`'s row.
- For every write method, assert that the row created carries `A`'s `agencyId`.

This test catches anyone who reverts the rule.

## 3. Structured logging

### 3.1 Module

New `packages/api-utils/src/logger/`:

```ts
export interface LogContext {
  requestId?: string;
  agencyId?: string;
  estateAgentId?: string;
  callId?: string;
  messageId?: string;
  [key: string]: unknown;
}

export const logger = {
  info: (msg: string, ctx?: LogContext) => emit("info", msg, ctx),
  warn: (msg: string, ctx?: LogContext) => emit("warn", msg, ctx),
  error: (msg: string, ctx?: LogContext) => emit("error", msg, ctx),
};
```

`emit` JSON-stringifies `{ level, time, msg, ...scrub(ctx) }` and writes to stdout.

### 3.2 PII scrubbing rules

Configurable list (default values shown):

```ts
const PII_KEYS = new Set([
  "email",
  "phone",
  "address",
  "name",
  "body",
  "transcript",
  "message",
  "extractedFields",
  "answers",
  "collectedFields",
]);
```

`scrub` walks the object and replaces matching keys with `<redacted>`. Nested objects are walked. Arrays are walked. The redaction is shallow on the key, not deep on the value — if a value is itself an object we still redact, because the _key_ signals PII intent.

### 3.3 Request correlation

An Elysia plugin `requestContext` reads `x-amzn-RequestId` from API Gateway and seeds it into an AsyncLocalStorage scope so the logger can pick it up without every call site passing it.

## 4. Dashboards and alarms

### 4.1 CloudWatch dashboards

Defined in `infra/observability.ts`. One dashboard per concern:

- **Ingestion** — lead creation rate by source (email/phone/portal/manual), classification mix, OpenAI call latency.
- **Lambda health** — invocations, errors, p50/p95/p99 duration for `api.handler`, `emailProcessor.handler`, and (when added) `webhook.handler`.
- **Email reputation** — SES SendEmail success vs. failure, bounce rate, complaint rate.

Metrics are CloudWatch-native (Lambda and SES already emit) plus a small set of custom metrics published from the API via `PutMetricData` for the lead-creation counters.

### 4.2 Alarms

Defined in the same file. Each alarm is a `new aws.cloudwatch.MetricAlarm` with `alarmActions: [alarmsTopic.arn]`.

- `LambdaErrorRate` — error count / invocation count > 1% over 5 min on `api.handler`.
- `EmailProcessorFailureRate` — same, > 5%.
- `ElevenLabsWebhookFailures` — any non-2xx response over 5 min.
- `SesBounceRate` — > 2% over 15 min.
- `SesComplaintRate` — > 0.1% over 15 min.

### 4.3 Notification target

A new SNS topic `LettingsOpsAlarms` with an email subscription pulled from SST secret `LettingsOpsAlarmEmail`.

## 5. Deploy pipelines

### 5.1 Workflows

- `staging-deploy.yml` already exists — verify the AWS role secret it expects and the stage name matches (`staging` or `preprod`).
- `deploy-production.yml` already exists — verify it triggers on Release Please release events, not on every push.

If gaps exist, close them per `docs/next-steps-deployments.md`.

### 5.2 Branch protection

GitHub repo settings: require PR checks, require one approving review (Bradley acts as both author and reviewer for now), disallow direct pushes to `main`.

## 6. Migration of existing code

Order of operations to avoid breaking the dashboard during rollout:

1. Build the auth plugin and the API key table behind a feature flag (`AUTH_ENFORCED=false` in env).
2. Add `agencyId` to repository constructors. Default to `"any"` (a sentinel that bypasses the filter) while the flag is off; the type system change forces every call site to be updated.
3. Update the dashboard to send the `Authorization` header.
4. Flip the flag on in preprod.
5. Fix the inevitable surprises.
6. Flip on in production once preprod is green for 24 hours.

The sentinel is gross but it lets every PR keep CI green during the migration. Remove the sentinel and the flag before Phase 1 is signed off as done.

## 7. Files touched (initial estimate)

- New: `microservices/core/src/application/auth/{authPlugin.ts, apiKeyRepository.ts, jwtVerifier.ts}` and `__tests__/` for each.
- New: `packages/api-utils/src/logger/{logger.ts, scrub.ts, requestContext.ts}` and tests.
- New: `infra/observability.ts`, wired into `sst.config.ts`.
- New: `packages/db/migrations/0001_api_keys.sql` and snapshot update.
- New: `.kiro/specs/01-platform-hardening/tasks.md` (this spec's task list — see next file).
- Updated: every repository file (constructor change), every handler file (add `.use(auth)` and read `agencyId` from context).
- Updated: `infra/api.ts` to add the JWT signing key secret and the alarms email secret.
- Updated: `infra/secrets.ts` with the two new secrets.

## 8. Risks specific to this phase

- **Auth refactor scope creep.** Mitigation: feature-flag, sentinel agency, ship in slices. The branch should never go more than a day without merging.
- **PII redaction false-positives.** Mitigation: redact keys, not values; keep the rule list small and explicit; review every new field added in code review.
- **Alarm noise.** Mitigation: start with the conservative thresholds above; tune after one week of preprod traffic.
