# Phase 4 — Client Onboarding & Go-Live: Design

## 1. Provisioning script

### 1.1 Shape

```
sst shell -- bun run scripts/provision-agency.ts \
  --name "First Client Ltd" \
  --inbound-email "firstclient@inbox.lettingsops.co" \
  --primary-agent-name "Jane Smith" \
  --primary-agent-email "jane@firstclient.co.uk" \
  --crm-kind "csv_export" \
  --crm-secret "LettingsOpsCrmCreds_FirstClient" \
  --slot-kind "google_calendar" \
  --slot-secret "LettingsOpsGcalCreds_FirstClient" \
  --voice-provider "elevenlabs" \
  --voice-secret "LettingsOpsVoiceSecret_ElevenLabs_FirstClient"
```

### 1.2 Behaviour

1. Validate every arg. Fail fast if SST secrets named don't exist.
2. Open a Drizzle transaction.
3. Idempotency lookup by name. If found, skip create; if `--force` is passed, update mutable fields.
4. Insert agency, primary estate_agent, default required_fields, default integrations, voice_agents row.
5. Generate an API key for the agency (one-time display). Persist hashed.
6. Commit. On any failure, transaction rolls back; the script prints the error and exits non-zero.

### 1.3 Default required fields

A sensible UK lettings default set, applied via `agency_required_fields`:

- `name`, `email`, `phone`, `move_in_date`, `monthly_income`, `employment_status`, `current_living_situation`, `pets`, `right_to_rent_status`.

The client can adjust via the dashboard after onboarding.

## 2. Client runbook & screenshots

Each runbook section gets a screenshot:

1. Login → dashboard home.
2. Leads list with status filter.
3. Lead detail page.
4. Communication history view.
5. Pending viewing request → confirm dialog.
6. Required-field editor.
7. API key management page.
8. Integrations page (last-success / last-failure chips).

Capturing via Playwright (added as a dev dep): `scripts/capture-runbook-screenshots.ts` boots a seeded preprod tenant and screenshots each route. Markdown references the images by path (`assets/runbook/01-dashboard.png` etc.).

The PDF export uses `pandoc docs/client-runbook.md -o docs/client-runbook.pdf` with a simple template.

## 3. UAT script

`docs/uat-script.md` is the canonical reference. Each scenario follows:

```
### Scenario N — <title>
**Pre-conditions:** <fixture state>
**Steps:**
1. ...
2. ...
**Expected:** <observable outcome>
**Pass/fail:** ◻
**Notes:** <run-time observations>
```

A small companion `scripts/run-uat-scenario.ts` automates the fixture setup for each scenario (seeding leads, simulating SES drops, posting to the voice webhook with a known payload) so the human only verifies the _outcome_, not the setup.

## 4. Deploy gate

`scripts/check-prod-ready.ts`:

- AWS API check: confirm the named CloudWatch alarms exist on prod stack.
- DB check: confirm latest migration is applied (list migrations table, compare to local `packages/db/migrations`).
- SST secrets check: list secret names; confirm all required ones present (DatabaseUrl, OpenAIKey, JwtSigningKey, AlarmEmail, ElevenLabsApiKey, voice secrets per provider, CRM/calendar creds per configured tenant).
- Branch check: confirm latest tag matches `origin/main` HEAD.

Exits 0 only if everything passes. Output is a checklist with `✔ / ✘` per item.

## 5. On-call

- Alarm path: CloudWatch → SNS `LettingsOpsAlarms` → email → forwarded to ntfy via a small AWS Lambda or rule (or Bradley's existing forwarding setup if simpler).
- Playbooks in `docs/on-call.md`, one per Phase 1 alarm:
  - `LambdaErrorRate` high → CloudWatch logs link, common causes, rollback playbook.
  - `EmailProcessorFailureRate` high → check S3 bucket, check SES rule, check OpenAI quota.
  - `ElevenLabsWebhookFailures` (or `VoiceWebhookFailures` after Phase 3) → check provider status page, check signing secret, check API auth.
  - `SesBounceRate` high → check sender reputation, check recent domain changes.
  - `IntegrationFailedPermanent` high → check the configured adapter status, check credentials, re-enqueue from dashboard.

## 6. Files touched

- New: `scripts/provision-agency.ts`, `scripts/check-prod-ready.ts`, `scripts/run-uat-scenario.ts`, `scripts/capture-runbook-screenshots.ts`.
- New: `docs/client-runbook.md` + `assets/runbook/*.png` + `docs/client-runbook.pdf`.
- New: `docs/uat-script.md`, `docs/production-deploy-checklist.md`, `docs/on-call.md`, `docs/dpa-template.md`.
- Updated: `package.json` to add Playwright and pandoc-runner devDeps.

## 7. Risks

- **UAT surfaces a Phase 2/3 bug.** Mitigation: budget two days of slack in Phase 4 for fixes. If a major bug surfaces, treat it as a Phase 2 or 3 follow-up branch — don't fix in the onboarding branch.
- **Client wants a feature that isn't built.** Mitigation: capture as a Phase 5 list, don't accept scope creep into Phase 4.
- **DPA review takes weeks.** Mitigation: start the DPA conversation at the beginning of Phase 4, parallel to UAT.
