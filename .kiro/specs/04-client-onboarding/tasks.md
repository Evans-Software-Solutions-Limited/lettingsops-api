# Phase 4 — Client Onboarding & Go-Live: Tasks

## Block A — Provisioning

- [ ] **A1.** Add `scripts/provision-agency.ts` per design §1. Use Bun's built-in arg parser or `commander`.
- [ ] **A2.** Idempotency: name-based lookup; `--force` updates mutable fields; no-op otherwise.
- [ ] **A3.** Transactional create (agency, primary estate_agent, required_fields, agency_integrations, voice_agents).
- [ ] **A4.** API key generation: cryptographically random 32-byte string, hash with SHA-256, store hash + prefix.
- [ ] **A5.** Tests: happy path, idempotent re-run, missing-secret error, validation errors.
- [ ] **A6.** Provision `uat-agency-1` on preprod. Verify the API key authenticates and the inbound email creates a lead.

## Block B — Client runbook

- [ ] **B1.** Install Playwright as a dev dep. Add `scripts/capture-runbook-screenshots.ts` that boots a seeded preprod tenant and captures the 8 routes from design §2.
- [ ] **B2.** Write `docs/client-runbook.md`, one section per screenshot, plain language, addressed to an estate-agent user.
- [ ] **B3.** Generate `docs/client-runbook.pdf` via pandoc. Add `bun run docs:client-pdf` script to package.json.
- [ ] **B4.** Bradley reviews; iterate once on tone and clarity.

## Block C — UAT

- [ ] **C1.** Write `docs/uat-script.md` with at least 10 scenarios from requirements US-4.3.
- [ ] **C2.** Add `scripts/run-uat-scenario.ts` for the setup hooks (seed leads, simulate SES drops, post to voice webhook).
- [ ] **C3.** Run every scenario against preprod. Record pass/fail in the doc. File bugs for any failure.
- [ ] **C4.** Bug-fix loop until every scenario passes.

## Block D — Deploy gate

- [ ] **D1.** Add `scripts/check-prod-ready.ts` per design §4.
- [ ] **D2.** Wire it into `deploy-production.yml` as a pre-deploy job. Production deploy is gated on a green exit.
- [ ] **D3.** Document failure-then-rerun cycle in `docs/production-deploy-checklist.md`.

## Block E — On-call & ops docs

- [ ] **E1.** Write `docs/on-call.md` with the playbooks per design §5.
- [ ] **E2.** Set up the alarm → email → ntfy bridge (Lambda or existing forwarding).
- [ ] **E3.** Fire a test alarm; confirm the full path from SNS to phone notification works.

## Block F — Legal & registration

- [ ] **F1.** Draft `docs/dpa-template.md` covering data categories, retention, sub-processors, incident SLA, deletion handling.
- [ ] **F2.** Bradley initiates ICO registration for LettingsOps as a data controller (if not already done). Track in this task.
- [ ] **F3.** Bradley sends DPA to the client for legal review.

## Block G — Production deploy

- [ ] **G1.** Final preprod soak: 7 days, zero unaddressed alarms.
- [ ] **G2.** Cut a release via Release Please. Verify the production deploy workflow runs and exits clean.
- [ ] **G3.** Provision the real client tenant on prod using the same script.
- [ ] **G4.** Run a controlled go-live: client sends 5 real enquiries (or directs them at the new inbound address); verify each reaches "qualified" or "viewing booked" state correctly.
- [ ] **G5.** Switch the client's real inbound number / inbound email DNS to point at LettingsOps. Monitor for 48h.

## Acceptance checklist

- [ ] All tasks above ticked.
- [ ] UAT script fully green on preprod.
- [ ] `check-prod-ready.ts` exits 0 against prod.
- [ ] First real client tenant live and processing enquiries.
- [ ] On-call playbooks exercised at least once via a test alarm.
- [ ] DPA template drafted and shared with the client.
- [ ] Spec's `requirements.md` definition of done is satisfied.
