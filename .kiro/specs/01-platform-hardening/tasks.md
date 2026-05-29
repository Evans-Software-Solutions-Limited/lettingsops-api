# Phase 1 — Platform Hardening: Tasks

Work top to bottom. Each task is small enough to land in a single PR. Cross-cutting refactors are broken into "introduce" + "migrate callers" steps to keep CI green at every commit.

## Block A — Branch sync and ground rules

- [x] **A1.** Fast-forward local `main` to `origin/main`. Resolve any divergent local state by archiving the diff to a branch and discarding from `main`. _Divergent WIP archived to `archive/pre-spec01-local-main-2026-05-19` (commit `1f8f6b5`); `main` fast-forwarded `a54b85d → 7c6e107` on 2026-05-19._
- [x] **A2.** Add a `CONTRIBUTING.md` (or appendix to root `CLAUDE.md`) capturing the branch hygiene rule and the spec-driven workflow.
- [ ] **A3.** Confirm branch protection is enabled on `main` (settings change in GitHub UI, document in `docs/next-steps-deployments.md`). _Required settings documented in `docs/next-steps-deployments.md` §7. Enforcement is currently **blocked**: the `Evans-Software-Solutions-Limited` org's GitHub plan does not unlock branch protection/rulesets for private repos (`gh api …/branches/main/protection` returns 403). Needs org plan upgrade to GitHub Team — flagged to maintainer._

## Block B — Database

- [x] **B1.** Add the `api_keys` table to `packages/db/src/schema.ts` per design §1.2.
- [x] **B2.** Generate migration via `drizzle-kit generate` and review the SQL. Add the migration to `packages/db/migrations/` and update the snapshot. _Migration `0001_api_keys.sql` + snapshot landed; idempotency relies on drizzle's journal tracking each migration once._
- [x] **B3.** Add `ApiKeyRepository` at `microservices/core/src/application/auth/apiKeyRepository.ts` with methods `create`, `findActive(keyHash)`, `revoke(id)`, `touch(id)`, `listForAgency(agencyId)`. Tests cover each, including the "revoked key cannot be found by findActive" case.

## Block C — Logging & request context

- [x] **C1.** Add `packages/api-utils/src/logger/logger.ts` and `scrub.ts` per design §3. Unit tests for scrub (keys redacted, nested objects, arrays, missing fields).
- [x] **C2.** Add `requestContext.ts` (AsyncLocalStorage-based) and a small Elysia plugin that seeds it from `x-amzn-RequestId`. _Uses `AsyncLocalStorage.enterWith` inside Elysia's `onRequest` hook so the scope flows through awaited handler continuations. Wired into `microservices/core/src/api.ts` as the first plugin._
- [x] **C3.** Replace `console.log` / `console.error` calls in `microservices/core/src` with `logger.info` / `logger.error`. Repo-wide grep and replace, no behaviour change.
- [x] **C4.** Add the `agencyId` field to every log statement in the email processor Lambda and the ElevenLabs webhook handler. _Email processor logs carry `agencyId` once the agency is resolved (pre-resolution failures log without it, by design). ElevenLabs payloads carry `agentId` not `agencyId`; logs use `callId` + `agentId` as primary correlation, with `agencyId` enrichment deferred to Block E (tenant scoping) where the agentId → agencyId mapping lands._

## Block D — Auth (introduce, off by default)

- [x] **D1.** Add SST secret `LettingsOpsJwtSigningKey` to `infra/secrets.ts`. Wire it through `infra/api.ts` env. _`AUTH_ENFORCED=false` baked into the env config so the next deploy ships Block D in soft mode without an operator step._
- [x] **D2.** Add `microservices/core/src/application/auth/jwtVerifier.ts` (verify, return typed claims). Tests cover valid token, expired token, wrong-signature, missing claim cases. _Uses `jose` (HS256). Throws a typed `JwtVerificationError` whose `.reason` field classifies into a fixed PII-free bucket (`expired` / `bad_signature` / `malformed` / `missing_claim` / `wrong_claim_type` / `missing_signing_key`) for log triage and metric filters._
- [x] **D3.** Add `authPlugin.ts` per design §1.3. Tests cover JWT path, API key path, missing creds path, revoked key path. _Plugin enriches the AsyncLocalStorage request context (from Block C) with `agencyId` + `estateAgentId` on successful resolution, so every downstream `logger.*` call carries those fields automatically. JWT path evaluated before API-key path when both headers are present._
- [x] **D4.** Add env flag `AUTH_ENFORCED` (default `false`). When false, the plugin still resolves credentials if present but does not throw on missing. _Soft mode lowers the bar for **missing** creds only — bad creds still throw 401 in soft mode (broken auth headers are always an operator mistake worth surfacing). Only the exact lowercase string `"true"` is treated as enforced; ambiguous values (`"TRUE"`, `"1"`, `"yes"`) deliberately stay in soft mode._

## Block E — Tenant isolation (introduce, sentinel-tolerant)

- [x] **E1.** Add `TenantScopedRepository` base class at `microservices/core/src/application/repositories/tenantScopedRepository.ts`. Tests cover the constructor and the protected `getAgencyId()` accessor. _Landed in commit `c6f08ef`. 11 unit tests covering construction, sentinel (`ANY_AGENCY = "__any__"`), `scopeWhere`, `writeAgencyId`, and `filterPredicates` helper._
- [x] **E2.** Refactor `leadRepository.ts` to extend `TenantScopedRepository`. Every read/write filters by `agencyId`. Until D4 is flipped on, accept a `"__any__"` sentinel that bypasses the filter; **mark the sentinel deprecated with a TODO referencing task F4**. _Landed in commit `4f5c32d`. All 7 call-sites migrated; sentinel paths carry `// TODO(F1):` comments._
- [x] **E3.** Same refactor for `viewingRepository.ts`, `qualificationRepository.ts`, `conversationRepository.ts`. Each lands in its own commit so the diff stays readable. _ViewingRepository: `7384f5e`, QualificationRepository: `4bd969d`, ConversationRepository tighten: `29e5813`. `email_conversations` table predates the transitional DEFAULT so `ConversationRepository.create()` refuses `ANY_AGENCY` sentinel — its only caller always has a real `agencyId`._
- [x] **E4.** Add `tenantIsolation.test.ts` per design §2.3. Two agencies, every repository × every method. _Landed in commit `1ec52ab`. 26 contract tests across all four repositories; uses `vi.unmock("@lettingsops/db")` to capture real Drizzle column metadata; no fake assertions. Full suite: 29 files / 421 tests, 98.95% line / 94.21% branch coverage._

## Block F — Auth (turn it on)

- [x] **F1.** Update every handler in `microservices/core/src/api.ts` to `.use(auth)` and read `agencyId` from context. _Landed in commit `f538070`. Auth mounted on all 7 business handlers (leadsCreate, leadsGet, leadsList, leadsCommunication, qualificationSubmit, viewingBook, viewingSlots). Webhook routes (emailIngestion, ElevenLabs) intentionally excluded (§1.4). All service methods now accept `agencyId: AgencyScope` as first param; handlers pass `ctx.auth.agencyId ?? ANY_AGENCY` (soft mode until F4)._
- [x] **F2.** Update the dashboard (`packages/web`) to attach the JWT to its API calls via Eden Treaty's auth header config. _Landed in commit `734b095`. Added `packages/web/src/lib/auth.ts` (localStorage token store). Eden Treaty `onRequest` hook reads from localStorage per-request (not at module-init time, so token changes are picked up immediately). Login.tsx stores a dev-placeholder token on simulated login — TODO: replace with real `POST /auth/login` once auth endpoint lands._
- [x] **F3.** Add an `/api-keys` admin endpoint pair (`POST` to issue, `GET` to list, `DELETE` to revoke). API-key-auth-only, scoped to the caller's agency. _Landed in commit `f7442b1`. Raw key returned once on creation (32 bytes → 64-char hex); stored as SHA-256 hash; `prefix` = first 8 chars for display. `requireAgencyId()` throws `HttpError(401)` for null. Ownership verified by `listForAgency` before revoke to prevent cross-agency key deletion. 12 service tests + 8 handler structural tests. Also fixed pre-existing `erasableSyntaxOnly` TS errors in `httpError.ts` / `jwtVerifier.ts` (Block D parameter properties, exposed by F2's web import chain)._
- [x] **F4.** ~Flip `AUTH_ENFORCED=true` in preprod~ — replaced. Decision (2026-05-28): align with `funds-distribution-platform` and drop the `AUTH_ENFORCED` flag entirely. Auth is always on; missing creds always → 401. This collapses the previous F4/F5 two-stage flip into a single strip-the-scaffolding PR: remove the env var from `infra/api.ts`, strip soft-mode + anonymous principal from `authPlugin.ts`, drop `?? ANY_AGENCY` from the 7 business handlers, and tighten their service signatures from `AgencyScope` to `string`. The `ANY_AGENCY` sentinel itself stays — it's now exclusively a webhook concession (see Block I). _Branch: `feat/spec-01-block-f-strip-auth-flag`._
- [x] **F5.** ~Flip `AUTH_ENFORCED=true` in production after 24h preprod green~ — N/A. With the flag removed (F4), there's no production toggle to flip. CI/CD passes the stage on `sst deploy --stage staging` and auth is enforced uniformly.

## Block G — Observability

- [ ] **G1.** Add SST secret `LettingsOpsAlarmEmail`. Add `LettingsOpsAlarms` SNS topic in `infra/observability.ts` with email subscription.
- [ ] **G2.** Add the three CloudWatch dashboards per design §4.1.
- [ ] **G3.** Add the five alarms per design §4.2.
- [ ] **G4.** Add custom metric publication in the API for lead-creation counters (one `PutMetricData` per create, dimension: **source only**). _Deviation from the original "source + agencyId" plan: per-tenant CloudWatch dimensions multiply billed custom metrics by `N agencies × 4 sources` (~$0.30/metric/month, 15-month retention tail) — easily £100s/month at modest scale and largely unread, since per-tenant lead counts are better served by a `SELECT count(*) FROM leads WHERE agency_id = ?` against the operational DB. Recorded after Inspector Brad's medium-severity finding on PR #39._ The publish lives in `LeadRepository.create` so all four ingestion paths (HTTP `POST /leads`, email Lambda, ElevenLabs phone webhook, future webhooks) are counted via a single choke point.
- [ ] **G5.** Verify alarms by deliberately failing one webhook in preprod; confirm SNS email arrives.

## Block I — Webhook agency resolution (finally retire `ANY_AGENCY`)

The Block F strip (above) removed the `AUTH_ENFORCED` flag and the soft-mode HTTP path. The `ANY_AGENCY` sentinel still exists, used by two webhook subsystems that cannot supply an `agencyId` at request time. This block resolves both lookups so the sentinel — and the column DEFAULT it relies on — can be removed.

- [ ] **I1.** Add `agentAgencyMap` table (`agent_id PRIMARY KEY`, `agency_id NOT NULL`, audit columns). Migration + Drizzle schema + idempotency. Seed one mapping per existing ElevenLabs agent so the rollout is non-breaking.
- [ ] **I2.** Add `AgentAgencyRepository.findAgencyForAgent(agentId)`. Tests cover hit, miss, multiple agents per agency.
- [ ] **I3.** Update `elevenLabsWebhookService.ts` to resolve `agencyId` via `findAgencyForAgent(payload.agentId)` before constructing the `LeadRepository`. Reject with `HttpError(401)` if no mapping. Drop the `ANY_AGENCY` import.
- [ ] **I4.** Unify the email-ingestion paths: both the Lambda and the HTTP Elysia wrapper resolve `agencyId` from the inbound recipient address (today the Lambda does this; the HTTP wrapper falls through to `ANY_AGENCY`). Share the resolver in `application/ingestion/email/agencyResolver.ts`. Drop `ANY_AGENCY` from `emailIngestionService.ts`.
- [ ] **I5.** Delete `ANY_AGENCY`, `isAny()`, the bypass paths in `scopeWhere`/`writeAgencyId`, and the `AgencyScope` alias from `tenantScopedRepository.ts`. Collapse all repository constructors to `agencyId: string`. Drop the column DEFAULT in a follow-up migration once one preprod release has shipped with the lookups in place.
- [ ] **I6.** Sweep the `tenantIsolation.test.ts` and `tenantScopedRepository.test.ts` blocks that test sentinel semantics — delete the suites that no longer apply, retain the cross-tenant isolation contract tests.

## Block H — Deploy pipelines

- [ ] **H1.** Verify `staging-deploy.yml` triggers on push to `main` and uses `AWS_ROLE_ARN_PREPROD`. Patch if not.
- [ ] **H2.** Verify `deploy-production.yml` triggers only on Release Please release-publish. Patch if not.
- [ ] **H3.** Update `docs/next-steps-deployments.md` with any divergence from doc → reality found during H1/H2.
- [ ] **H4.** Document the secret list (`AWS_ROLE_ARN_*`, `LettingsOpsJwtSigningKey`, `LettingsOpsAlarmEmail`) in `docs/secrets.md`.

## Acceptance checklist

- [ ] All boxes above ticked.
- [ ] `bun run prettier:check && bun run typecheck && bun run lint && bun run build && bun run test:unit` green.
- [ ] Coverage report shows 90%+ on application and repositories code.
- [ ] Preprod deploy of `feat/spec-01-platform-hardening` demonstrates: rejected unauthenticated request, accepted authenticated request, cross-tenant leak attempt returns empty, alarm email received from a synthetic failure.
- [ ] Spec's `requirements.md` definition of done is satisfied.
