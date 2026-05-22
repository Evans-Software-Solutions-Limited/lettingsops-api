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

- [ ] **D1.** Add SST secret `LettingsOpsJwtSigningKey` to `infra/secrets.ts`. Wire it through `infra/api.ts` env.
- [ ] **D2.** Add `microservices/core/src/application/auth/jwtVerifier.ts` (verify, return typed claims). Tests cover valid token, expired token, wrong-signature, missing claim cases.
- [ ] **D3.** Add `authPlugin.ts` per design §1.3. Tests cover JWT path, API key path, missing creds path, revoked key path.
- [ ] **D4.** Add env flag `AUTH_ENFORCED` (default `false`). When false, the plugin still resolves credentials if present but does not throw on missing.

## Block E — Tenant isolation (introduce, sentinel-tolerant)

- [ ] **E1.** Add `TenantScopedRepository` base class at `microservices/core/src/application/repositories/tenantScopedRepository.ts`. Tests cover the constructor and the protected `getAgencyId()` accessor.
- [ ] **E2.** Refactor `leadRepository.ts` to extend `TenantScopedRepository`. Every read/write filters by `agencyId`. Until D4 is flipped on, accept a `"__any__"` sentinel that bypasses the filter; **mark the sentinel deprecated with a TODO referencing task F4**.
- [ ] **E3.** Same refactor for `viewingRepository.ts`, `qualificationRepository.ts`, `conversationRepository.ts`. Each lands in its own commit so the diff stays readable.
- [ ] **E4.** Add `tenantIsolation.test.ts` per design §2.3. Two agencies, every repository × every method.

## Block F — Auth (turn it on)

- [ ] **F1.** Update every handler in `microservices/core/src/api.ts` to `.use(auth)` and read `agencyId` from context.
- [ ] **F2.** Update the dashboard (`packages/web`) to attach the JWT to its API calls via Eden Treaty's auth header config.
- [ ] **F3.** Add an `/api-keys` admin endpoint pair (`POST` to issue, `GET` to list, `DELETE` to revoke). API-key-auth-only, scoped to the caller's agency.
- [ ] **F4.** Flip `AUTH_ENFORCED=true` in preprod. Confirm dashboard still works end-to-end. Then remove the sentinel handling in repositories (Block E1–E3).
- [ ] **F5.** Flip `AUTH_ENFORCED=true` in production after 24 hours of preprod green.

## Block G — Observability

- [ ] **G1.** Add SST secret `LettingsOpsAlarmEmail`. Add `LettingsOpsAlarms` SNS topic in `infra/observability.ts` with email subscription.
- [ ] **G2.** Add the three CloudWatch dashboards per design §4.1.
- [ ] **G3.** Add the five alarms per design §4.2.
- [ ] **G4.** Add custom metric publication in the API for lead-creation counters (one `PutMetricData` per create, dimensions: source, agencyId).
- [ ] **G5.** Verify alarms by deliberately failing one webhook in preprod; confirm SNS email arrives.

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
