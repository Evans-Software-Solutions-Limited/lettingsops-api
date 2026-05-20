# LettingsOps — Spec-Driven Delivery (Kiro style)

This directory holds the spec-driven delivery plan to take LettingsOps from PoC to first paying client. It follows the Kiro pattern: every meaningful body of work is broken into **requirements**, **design**, and **tasks** before code is written.

## How to use these specs

A coding agent (or human) picks **one spec at a time**, in order, and:

1. Reads `requirements.md` to understand _what_ must be true when the work is done.
2. Reads `design.md` to understand _how_ to build it inside this codebase.
3. Works through `tasks.md` top to bottom, marking each task as it lands.

When all tasks in a spec are done and acceptance criteria pass, the spec is complete and the next phase can start. Specs are intentionally sequenced — Phase 2 assumes Phase 1's auth and tenant isolation are merged.

## The four phases

| #   | Spec                                                                           | Why                                                                                                            | Estimate   |
| --- | ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- | ---------- |
| 01  | [Platform hardening](./specs/01-platform-hardening/requirements.md)            | Auth, tenant isolation and observability — must land before any real tenant traffic                            | ~1.5 weeks |
| 02  | [CRM & booking adapters](./specs/02-crm-and-booking-adapters/requirements.md)  | Port-and-adapter abstractions so we can plug different CRMs and calendars per agency                           | ~2 weeks   |
| 03  | [Voice channel audit & rewire](./specs/03-voice-channel-audit/requirements.md) | Evaluate ElevenLabs v2 vs Vapi/Retell/Bland/LiveKit+Cartesia/OpenAI Realtime; abstract voice behind an adapter | ~1.5 weeks |
| 04  | [Client onboarding & go-live](./specs/04-client-onboarding/requirements.md)    | Provision the first agency, run UAT, ship to production                                                        | ~1 week    |

## Standing rules (apply to every spec)

These come from `CLAUDE.md` at the repo root and are non-negotiable.

- **Tests:** 90% Vitest coverage threshold (lines, functions, branches, statements) on `src/application/**/*.ts` and `src/**/repositories/*.ts`. No fake tests.
- **Pre-merge gate:** `bun run prettier:check && bun run typecheck && bun run lint && bun run build && bun run test:unit` must all pass.
- **Webhooks:** signature-verified, idempotent, no PII in logs, repository-pattern data access.
- **Frontend:** Container/Presenter split, Shadcn UI, test rendering + interactions + API mocking.
- **Migrations:** `packages/db/migrations/`, idempotent, reversible, snapshot file kept in sync.
- **Branch hygiene:** one branch per spec phase (`feat/spec-01-platform-hardening`, etc.), PRs labelled `ready-for-test` to spin up a PR environment.

## Sequencing & dependencies

```
Phase 1 (Platform Hardening)
       │
       ▼
Phase 2 (CRM + Booking Adapters)  ◄── needs auth and tenant isolation from Phase 1
       │
       ▼
Phase 3 (Voice Audit + Rewire)    ◄── needs auth (webhook routes still public today)
       │
       ▼
Phase 4 (Client Onboarding)       ◄── needs adapters and voice committed before UAT
```

Phase 3's _audit_ can start in parallel with Phase 2 (it's mostly investigation) but the rewire ships after Phase 2 is merged so the new VoiceWebhookAdapter can sit alongside the CrmAdapter and SlotSourceAdapter cleanly.

## Decisions made on 2026-05-19

These shape every spec — read before starting any phase.

1. **CRM:** adapter port with one reference implementation; final platform choice deferred until the client confirms.
2. **Booking:** adapter port; same approach.
3. **Voice:** audit alternatives before recommitting; ElevenLabs is the incumbent but not assumed.
4. **Deployment shape:** multi-tenant SaaS; this client is tenant #1. Tenant isolation is mandatory before live traffic.
