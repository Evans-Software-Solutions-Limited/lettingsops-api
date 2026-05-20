# Phase 1 — Platform Hardening: Requirements

## Objective

Make the LettingsOps API safe to point at a real, paying client tenant. Today the API has no authentication, no tenant-isolation enforcement at the data layer, and only ad-hoc logging. None of those are acceptable before live traffic.

## In scope

- Authentication and tenant identification on every API route.
- Tenant isolation enforced at the repository layer (not just at the route).
- Structured logging with PII scrubbing and request correlation.
- CloudWatch dashboards and alarms covering the critical paths.
- Pre-prod and production deploy pipelines wired (the doc in `docs/next-steps-deployments.md` is the menu).
- Branch sync: bring local `main` up to date with `origin/main` and re-baseline.

## Out of scope (handled by later phases)

- CRM integration (Phase 2).
- Calendar / booking integration (Phase 2).
- Voice provider re-evaluation (Phase 3).
- Tenant onboarding tooling (Phase 4).

## User stories with acceptance criteria

### US-1.1 — As a tenant agency, I want my API requests authenticated so that nobody else can read or mutate my data

**Acceptance criteria**

- Every route in `microservices/core/src/api.ts` rejects unauthenticated requests with HTTP 401, except for explicitly listed public endpoints (the SES email processor is invoked by S3 and doesn't go through API Gateway, so it's out of scope; the ElevenLabs webhook authenticates via HMAC and remains route-public but tenant-bound via signature).
- The dashboard authenticates with a JWT issued for an estate-agent identity belonging to one agency.
- Server-to-server callers (integrations, internal scripts) authenticate with a per-agency API key.
- The auth layer puts the resolved `agencyId` (and `estateAgentId` where relevant) onto the Elysia context for downstream handlers to consume.
- Tokens and keys are revocable without redeploy (stored in DB, not in env vars).

### US-1.2 — As a platform operator, I want tenant isolation enforced at the repository layer so a route-level mistake can't leak data

**Acceptance criteria**

- Every repository method that reads or writes tenant-owned tables takes an explicit `agencyId` argument or is constructed with one.
- Repository unit tests cover the cross-tenant case: a query with the wrong `agencyId` returns empty / refuses the write.
- An integration test seeds two agencies and asserts that no API call by agency A can ever read or modify agency B's records, across every endpoint.
- Tables affected: `leads`, `qualifications`, `viewings`, `viewing_requests`, `communication_logs`, `audit_logs`, `email_conversations`, `availability_windows`, `estate_agents`, `agency_required_fields`. (The `agencies` table itself is keyed by id.)

### US-1.3 — As an operator, I want logs I can debug from without compromising tenant PII

**Acceptance criteria**

- A logging utility exists in `packages/api-utils` exposing `logger.info / warn / error` with a single structured field map.
- Logger emits JSON to stdout (CloudWatch ingests it as JSON).
- Every API Lambda invocation logs a `requestId` (taken from API Gateway) and the resolved `agencyId` (post-auth).
- PII scrubbing: any field whose key is in a configurable list (`email`, `phone`, `body`, `transcript`, etc.) is replaced with `<redacted>` before serialization.
- Tests cover the PII redaction rules.

### US-1.4 — As an operator, I want dashboards that tell me at a glance whether the platform is healthy

**Acceptance criteria**

- CloudWatch dashboards exist for: lead-creation rate per source, classification mix (counts per `conversation_type`), ElevenLabs webhook success vs. failure rate, email processor success vs. failure rate, SES bounce + complaint rate, p50 / p95 / p99 Lambda durations.
- Alarms fire on: Lambda error rate > 1% over 5 minutes, SES bounce rate > 2%, ElevenLabs webhook 4xx/5xx > 0 over 5 minutes (any failure is interesting), and email processor failure rate > 5%.
- Alarms route to a single SNS topic with email subscription (subscriber address comes from an SST secret).

### US-1.5 — As an operator, I want a clean deploy pipeline to preprod and production

**Acceptance criteria**

- `staging-deploy.yml` workflow exists and runs on push to `main`, assuming an `AWS_ROLE_ARN_PREPROD` secret.
- `deploy-production.yml` workflow runs on Release Please release-publish events, assuming `AWS_ROLE_ARN_PRODUCTION`.
- Branch protection on `main` requires PR checks to pass.
- OIDC identity provider and IAM role setup is documented (extending `docs/next-steps-deployments.md`); creation can be manual but the doc must be accurate enough that a fresh engineer can do it without questions.

### US-1.6 — As a developer, I want the local `main` branch to match origin so I can resume work without confusion

**Acceptance criteria**

- Local `main` is fast-forwarded to `origin/main` (or recreated cleanly) before any Phase 1 work begins.
- A `CONTRIBUTING.md` (or addition to root `CLAUDE.md`) documents the branch hygiene rule: never commit directly to `main`; always work on `feat/spec-{NN}-{name}` branches; PR merges only via squash with release-please-compatible commit messages.

## Non-functional requirements

- **Test coverage:** Hits the existing 90% gate. No regressions.
- **Performance budget:** Auth middleware adds < 20 ms p95 to a cached-key request. JWT verification < 5 ms.
- **Secrets:** All new credentials (HMAC secret, JWT signing key, alarm SNS topic ARN) live in SST secrets, not environment files.
- **Documentation:** Every new module ships with a brief `CLAUDE.md` (matching the existing webhooks module pattern).

## Definition of done

All six user stories' acceptance criteria pass; the full pre-merge gate (`prettier:check`, `typecheck`, `lint`, `build`, `test:unit`) is green; a preprod deploy of the spec branch demonstrates auth working end-to-end and dashboards populated with synthetic traffic; the spec's tasks.md has every item checked.
