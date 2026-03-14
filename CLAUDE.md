# CLAUDE.md – LettingsOps API

## What This Repo Is

Automated lettings operations platform. AI-powered enquiry qualification, viewing booking, compliance tracking, and CRM automation. Rentals management system with multi-channel lead ingestion (phone via ElevenLabs, email, web), lead qualification, and viewing scheduling.

## Architecture

- **Frontend:** React dashboard (packages/web), Shadcn UI, Vite
- **Backend:** Elysia routes with type-safe handlers (microservices/core)
- **Database:** Neon (serverless Postgres) + Drizzle ORM (packages/db)
- **Webhooks:** ElevenLabs phone integration, email ingestion
- **Infra:** SST v3, Lambda-based deployment
- **Package Manager:** Bun, Workspaces, Turborepo

## Key Directories

| Path                                                | Purpose                                   |
| --------------------------------------------------- | ----------------------------------------- |
| `microservices/core/src/application/`               | Business logic, repositories              |
| `microservices/core/src/application/leads/`         | Lead CRUD: create, get, list, communicate |
| `microservices/core/src/application/webhooks/`      | External integrations: ElevenLabs, email  |
| `microservices/core/src/application/qualification/` | Tenant vetting, data validation           |
| `microservices/core/src/application/viewings/`      | Slot management, booking                  |
| `microservices/core/src/application/repositories/`  | Data access layer (Drizzle)               |
| `packages/web/src/`                                 | Dashboard React app                       |
| `packages/db/src/schema.ts`                         | Drizzle schema definitions                |
| `packages/db/migrations/`                           | SQL migrations                            |
| `infra/`                                            | SST resource definitions                  |

## Standards

### Code Quality

- **Typecheck:** `bun run typecheck`
- **Lint:** `bun run lint`
- **Format:** `bun run prettier:check` / `--write`
- **Build:** `bun run build`
- **Tests:** `bun run test:unit` (Vitest)

### Testing Rules

- **Coverage threshold:** 90% (lines, functions, branches, statements) — non-negotiable
- **No fake tests.** All tests must prove behaviour.
- **Coverage includes:** `src/application/**/*.ts` and `src/**/repositories/*.ts`
- **Excluded:** Handler files (thin, complex middleware), index/api files, type defs
- **Test structure:** Colocate tests in `__tests__/` directory per module

### Elysia Routes

- Route handlers are thin (parse input, call service/repository)
- Functional logic lives in repositories and service classes
- Schema validation: `t.Object({...})` for request bodies
- Webhook routes do not require auth (but must validate signatures where applicable)
- Error handling: 400/401/404/409/422/500 with descriptive messages

### Frontend

- Container/Presenter pattern: containers handle logic and state, presenters are pure
- Global state via context (user, leads, auth)
- Shadcn UI for components
- Tests: rendering, user interactions, API mocking

### Database Migrations

- Each migration in `packages/db/migrations/` (SQL + meta JSON)
- Schema versioned in `packages/db/src/schema.ts`
- Migrations must be idempotent and reversible

## Commands Before Claiming Done

```bash
bun run prettier:check  # format check (fix with --write)
bun run typecheck       # TypeScript
bun run lint           # ESLint
bun run build          # build all packages
bun run test:unit      # Vitest (must hit 90% coverage)
```

## Dangerous Areas

### Webhook Ingestion (Email & ElevenLabs)

- **Files:** `microservices/core/src/application/webhooks/elevenlabs/`, `microservices/core/src/application/ingestion/email/`
- **Risk:** Unvalidated external input, spoofing, duplicate processing, PII handling
- **Rules:**
  - Validate webhook signature (ElevenLabs provides signature; email ingestion must authenticate sender)
  - Idempotent processing: same webhook event should not create duplicate leads
  - Sanitise and validate all extracted fields (name, email, phone, etc.)
  - PII: handle phone, email, address carefully (audit logging, minimal retention)
  - Test webhook replay scenarios
  - Never trust caller ID / sender email without verification

### Lead Data & Tenant Information

- **Files:** `microservices/core/src/application/leads/`, `microservices/core/src/application/qualification/`
- **Risk:** Data accuracy, privacy, discrimination, compliance (FCA, GDPR)
- **Rules:**
  - Lead qualification must not discriminate based on protected characteristics
  - Store only necessary PII; implement data retention policies
  - Qualification logic must be transparent and auditable
  - Do not auto-reject leads based on income/credit alone; always allow human review
  - Ensure compliance logging for all qualification decisions

### Viewing Slot Booking

- **Files:** `microservices/core/src/application/viewings/`
- **Risk:** Double-booking, scheduling conflicts, overbooking
- **Rules:**
  - Atomic slot reservation (check availability, reserve in same transaction)
  - Prevent double-booking: use database constraints or pessimistic locking
  - Calendar sync: if using external calendar (Google, Outlook), ensure sync is one-way initially
  - Handle timezone conversions explicitly
  - Test: simultaneous booking attempts on same slot

## Current Priorities

1. **ElevenLabs integration stability** — webhook handling, transcript parsing, lead creation
2. **Email ingestion robustness** — signature validation, duplicate detection
3. **Lead qualification rules** — ensure tenant data vetting is fair and transparent
4. **Viewing booking logic** — prevent double-booking, handle edge cases
5. **PII compliance** — audit logging, retention policies, GDPR readiness

## PR Checklist

- [ ] All checks pass (prettier, typecheck, lint, build, test)
- [ ] Coverage ≥ 90% on changed files
- [ ] No fake tests
- [ ] If touching webhooks: validate signature handling, test replay
- [ ] If touching qualification: ensure discrimination rules are transparent
- [ ] If touching viewings: test concurrent booking scenarios
- [ ] If adding migrations: idempotency and rollback verified
- [ ] Conventional commit message (feat/, fix/, chore/)
