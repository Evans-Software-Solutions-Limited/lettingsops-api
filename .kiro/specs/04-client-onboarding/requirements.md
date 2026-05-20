# Phase 4 — Client Onboarding & Go-Live: Requirements

## Objective

Onboard the first paying agency tenant, prove the system end-to-end through a structured UAT, and ship to production with monitoring and a documented on-call plan. Everything functional should be working by the start of this phase — Phase 4 is about _finishing well_ rather than building new behaviour.

## In scope

- Tenant provisioning runbook + CLI scripts to bootstrap a new agency.
- UAT script covering every channel (email, phone, manual lead entry) and every lifecycle stage (lead → qualified → viewing booked → CRM updated).
- Operational runbook for the client (estate-agent users) — how to use the dashboard, edit required fields, review pending viewing requests, escalate.
- Production deploy gate: a checklist that must pass before flipping a tenant from preprod to production.
- A handful of polish items that surface during UAT (always do).

## Out of scope

- A second tenant (that's a Phase 5 conversation).
- New product features beyond the polish list.
- Marketing/sales materials.

## Dependencies on Phases 1–3

- All three previous phases merged, green in preprod, with 90% coverage held.

## User stories with acceptance criteria

### US-4.1 — As Bradley, I want a repeatable process to spin up a new agency tenant in minutes

**Acceptance criteria**

- A CLI script `scripts/provision-agency.ts` (runnable via `sst shell`) takes: agency name, inbound email subdomain, primary estate-agent name + email, CRM adapter kind, slot source adapter kind, and credentials secret references.
- The script creates: an `agencies` row, an `estate_agents` row for the primary contact, a default `agency_integrations` row, a default `agency_required_fields` set (sensible UK lettings defaults), a default `voice_agents` row if a voice provider is configured.
- The script outputs: the inbound email address, the issued API key (shown once), a JSON dump of the created config.
- Re-running with the same name is a no-op (idempotent).

### US-4.2 — As an estate-agent user, I want a documented day-one onboarding so I can start using LettingsOps without hand-holding

**Acceptance criteria**

- `docs/client-runbook.md` covers: log in, dashboard overview, where leads come from, what each status means, how to review and confirm a viewing request, how to escalate to a human, how to add or edit a required-field set, how to revoke an API key.
- The runbook is screenshot-illustrated (at least 8 screenshots).
- The runbook is also exported as a PDF in `docs/client-runbook.pdf` for the client to keep.

### US-4.3 — As Bradley, I want a structured UAT that proves the whole pipeline works on real-shaped data

**Acceptance criteria**

- `docs/uat-script.md` lays out at least 10 scenarios, with explicit pre-conditions, steps, and pass/fail criteria. Examples:
  - Email enquiry happy path → classified → qualified → reply → viewing booked → CRM updated → calendar event created.
  - Phone enquiry happy path equivalent.
  - Maintenance request — classified, replied to with acknowledgement, _no_ qualification chase.
  - Cross-tenant probe — agency B's API key tries to read agency A's lead → 401 or empty.
  - Failed CRM push — adapter returns 500 → lead still created → integration_events row marked failed → alarm fires.
  - Calendar quota exceeded → graceful fallback → dashboard surfaces the state.
- UAT is run on preprod against tenant `uat-agency-1`. Every scenario is executed, scored pass/fail, with notes.
- All scenarios pass before promotion to production.

### US-4.4 — As Bradley, I want a deploy gate that prevents foot-guns

**Acceptance criteria**

- `docs/production-deploy-checklist.md` enumerates the pre-deploy checks (Phase 1 alarms wired, all migrations applied to prod DB, all secrets populated, branch protection on, latest release-please tag merged, UAT scenarios green).
- A simple `scripts/check-prod-ready.ts` script runs as many of these as can be automated (e.g. probes the prod stack for the alarms, queries the prod DB for required tables, lists configured SST secrets).
- The script must exit 0 before production deploy.

### US-4.5 — As Bradley, I want a defined on-call posture for week one

**Acceptance criteria**

- `docs/on-call.md` lists: who is on-call (Bradley initially), how alarms reach them (SNS → email → ntfy mirror), the standard triage steps, a list of "if X then Y" playbooks for the alarms set in Phase 1, the escalation path if Bradley is unavailable.
- A test alarm is fired during business hours week-one to verify the path works end-to-end.

### US-4.6 — As the first client, I want a clear, written agreement on data handling

**Acceptance criteria**

- A DPA template lives at `docs/dpa-template.md` (legal review TBD before signing). Covers: data categories (tenant PII, transcripts), retention (default 90 days for transcripts and unqualified leads, indefinite for converted-tenant lead data), sub-processors (AWS, OpenAI, chosen voice provider, chosen CRM if applicable), incident-response SLA, deletion request handling.
- ICO registration confirmed (or process started) — Bradley's individual responsibility, not a code task, but tracked here.

## Non-functional requirements

- **Test coverage:** Provisioning script + check-prod-ready script have unit tests.
- **Latency:** Production go-live demonstrates p95 lead-create < 800 ms, p95 webhook handling < 800 ms.
- **Reliability:** 7-day preprod soak with zero unaddressed alarms before flipping production.
- **Documentation:** Every doc in this phase is committed to the repo. No "in someone's head" knowledge.

## Definition of done

Tenant `uat-agency-1` provisioned, every UAT scenario green, `scripts/check-prod-ready.ts` exits 0, production deploy executed, the client's first real agency tenant is live and processing real enquiries, on-call playbooks exercised at least once, all tasks ticked.
