# Phase 3 — Voice Channel Audit & Rewire: Requirements

## Objective

Re-evaluate the voice channel given (a) the 2026 PoC where ElevenLabs voice quality fell short, (b) the rapid evolution of AI voice infrastructure since early 2026. Decide whether to keep ElevenLabs (now Conversational AI v2) or migrate to a stronger provider, then either way abstract the integration behind a `VoiceWebhookAdapter` so the lead pipeline doesn't care which provider sent the call.

## In scope

- A structured comparison of credible providers: ElevenLabs Conv AI v2, Vapi, Retell, Bland, LiveKit + Cartesia, OpenAI Realtime API.
- A bake-off: two finalists tested on a real UK lettings script, scored against the same rubric.
- A decision document (the audit output) recommending one provider with reasoning.
- A `VoiceWebhookAdapter` port and at least one implementation (the chosen provider).
- Re-wiring of `webhooks/elevenlabs/` (or successor) to dispatch through the adapter.
- Updated runbook in `docs/` for the chosen provider.

## Out of scope

- Mid-call function calling for live bookings (we'll consider it in the audit but the spec target is post-call webhooks; live function calling is a stretch goal).
- IVR / call-routing logic beyond the basic single-agent flow.
- Multi-language support — UK English only for now.

## Dependencies on Phases 1–2

- Phase 1 auth must be live: the new voice adapter's secret loading uses the SST-secrets pattern.
- Phase 2 adapter pattern: this phase reuses the same retry helper and the same integration_events table.

## User stories with acceptance criteria

### US-3.1 — As a product decision-maker, I want a one-page comparison of voice providers so I can choose with confidence

**Acceptance criteria**

- A document at `docs/voice-provider-audit.md` covers each candidate against the following columns: voice quality (UK accent, naturalness), conversation control (latency, interruption handling), function-calling support, telephony bundle vs BYO number, UK number availability, webhook ergonomics, pricing per minute (rough range), SOC-2 / DPA posture (yes/no/in-progress), free trial availability.
- Each row cites at least one source link (docs page, pricing page, third-party comparison).
- A "first cut" recommendation: top two candidates plus reasoning for cuts.

### US-3.2 — As a product decision-maker, I want a head-to-head bake-off so the choice rests on real evidence not marketing

**Acceptance criteria**

- A bake-off script — five canonical tenant call scenarios — exists in `docs/voice-bake-off-script.md`. Examples: viewing enquiry happy path, tenant interrupts assistant, tenant goes off-topic, tenant provides phone number digit-by-digit, tenant declines to share income.
- Two finalists are tested against this script. Calls are recorded (with consent — these are test calls to a private number).
- Each call is scored on a 1–5 scale across: speech intelligibility, latency feel, interruption handling, prompt adherence, field extraction accuracy.
- A scored matrix lands in `docs/voice-bake-off-results.md` with a final recommendation.

### US-3.3 — As an engineer, I want voice provider abstracted behind an adapter so swapping providers later doesn't ripple through the lead pipeline

**Acceptance criteria**

- A new `VoiceWebhookAdapter` port exists at `microservices/core/src/application/adapters/voice/voiceWebhookAdapter.ts`.
- The adapter exposes one operation: `parseWebhook(rawBody, headers) -> NormalisedVoicePayload`, returning a provider-agnostic shape.
- The `NormalisedVoicePayload` shape: `{ providerCallId, providerAgentId, intent, extractedFields, transcript, durationSeconds, signatureValid }`. The dispatcher checks `signatureValid` and rejects with 401 if false.
- The existing `elevenLabsWebhookService` is refactored to: (a) implement the adapter for ElevenLabs, (b) consume the normalised payload via a single `voiceWebhookService.handleCall(normalised, agencyId)`.

### US-3.4 — As an engineer, I want the chosen provider's adapter implementation live

**Acceptance criteria**

- Whichever provider wins, its adapter is implemented and live in preprod.
- HMAC (or provider-equivalent) signature verification is in place. No raw-payload acceptance.
- Idempotency: re-delivery of the same call produces no duplicate leads (per-provider call id).
- Transcript stored as a `communication_log` row (existing pattern).
- If the chosen provider is **not** ElevenLabs, the ElevenLabs adapter remains in code (deprecated, not deleted) for one release cycle as a fallback.

### US-3.5 — As an operator, I want a runbook for the chosen provider

**Acceptance criteria**

- `docs/voice-agent-config.md` documents: how to create the agent in the provider dashboard, the system prompt to use (lettings-specific, refined from the ElevenLabs PoC prompt), how to provision a UK phone number, how to point the webhook at our API, which SST secrets to populate.
- The system prompt is committed to the repo (so changes are tracked) and the runbook references the file.

### US-3.6 — As an operator, I want voice-channel quality metrics in the dashboard

**Acceptance criteria**

- Custom CloudWatch metrics emitted from the voice adapter: `VoiceCallCount` (dim: provider, intent), `VoiceCallDuration`, `VoiceCallFieldExtractionMissing` (count of calls where any expected field was empty).
- A dashboard widget surfaces the daily field-extraction completeness rate per provider.
- Alarm: more than 30% of calls in a day end with any missing field — flags prompt regression or provider degradation.

## Non-functional requirements

- **Test coverage:** Adapter and dispatcher hit 90%. Tests for each adapter cover signature pass/fail, idempotent processing, malformed payloads.
- **Performance budget:** Adapter parse-and-verify under 50 ms p95. Total webhook handler under 500 ms p95.
- **Security:** Signature verification is mandatory; no provider-specific bypass. Webhook secret per agency-provider pair, stored in SST secrets.
- **Privacy:** Transcripts retained per the agency's retention policy (configurable in `agency_integrations`, default 90 days). PII-scrubbed in logs.

## Definition of done

`docs/voice-provider-audit.md` recommends a provider; `docs/voice-bake-off-results.md` proves it on a real script; `VoiceWebhookAdapter` exists with the chosen provider implemented and live in preprod; runbook is committed; tasks.md is fully checked.
