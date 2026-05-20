# Phase 3 — Voice Channel Audit & Rewire: Tasks

## Block A — Audit (no code)

- [ ] **A1.** Create `docs/voice-provider-audit.md` skeleton with the table from design §1.1 + §1.2 (one row per provider, one column per rubric criterion).
- [ ] **A2.** First-cut scoring: fill the table from docs and pricing pages for all six providers. Cite a link per cell.
- [ ] **A3.** Pick top two finalists. Document the cuts at the bottom of `voice-provider-audit.md`.
- [ ] **A4.** Kick off DPA / SOC-2 conversations with both finalists (email request from Bradley; deliverable here is "request sent + thread linked in audit doc").
- [ ] **A5.** Create `docs/voice-bake-off-script.md` with the five canonical scenarios from requirements US-3.2.
- [ ] **A6.** Run the bake-off: set up a trial account per finalist, point each at a UK number, run all five scenarios on each. Record calls (with consent).
- [ ] **A7.** Create `docs/voice-bake-off-results.md`: per-scenario score matrix, transcript snippets, final recommendation with reasoning.

## Block B — Adapter port

- [ ] **B1.** Add `microservices/core/src/application/adapters/voice/voiceWebhookAdapter.ts` per design §2.1 (types only).
- [ ] **B2.** Add `voiceWebhookDispatcher.ts` per design §2.2 — the dispatcher route, no provider-specific logic.
- [ ] **B3.** Add `voiceWebhookService.ts` containing the lead-create path that the dispatcher calls into. Reuses the Phase 2 lead-create + CRM push flow.
- [ ] **B4.** Dispatcher tests: signature-valid path, signature-invalid → 401, unknown providerKind → 400, idempotent re-delivery returns existing leadId.

## Block C — Schema for agency-provider mapping

- [ ] **C1.** Add `voice_agents` and `voice_call_events` tables to `packages/db/src/schema.ts` per design §3 + §4.
- [ ] **C2.** Migration + snapshot. Backfill any existing ElevenLabs config into `voice_agents` (one row per agency that has a configured agent).
- [ ] **C3.** `VoiceAgentsRepository` and `VoiceCallEventsRepository`, tenant-scoped.

## Block D — ElevenLabs refactor

- [ ] **D1.** Move `microservices/core/src/application/webhooks/elevenlabs/elevenLabsWebhookService.ts` to `adapters/voice/elevenLabsAdapter.ts`, implementing `VoiceWebhookAdapter`.
- [ ] **D2.** Keep HMAC verification in `adapters/voice/elevenLabsSignatureVerification.ts` (moved, not duplicated). Update imports.
- [ ] **D3.** Update `microservices/core/src/api.ts`: replace `elevenLabsWebhookHandler` with `voiceWebhookDispatcher`. Keep the old route as an alias for one release (the dispatcher accepts both `/webhooks/elevenlabs` and `/webhooks/voice/elevenlabs`).
- [ ] **D4.** All existing ElevenLabs tests pass with no behaviour change beyond the route normalisation.

## Block E — Chosen provider adapter (placeholder until A7 closes)

> **Block E only starts after Block A's recommendation lands.** If A7 recommends ElevenLabs, this block becomes "verify Conv AI v2 voice + prompt + run preprod tests" and is a no-code-change block.

- [ ] **E1.** Add `adapters/voice/{chosen}Adapter.ts` implementing `VoiceWebhookAdapter`.
- [ ] **E2.** Implement provider-specific signature verification.
- [ ] **E3.** Map provider payload → `NormalisedVoicePayload`. Unit tests for every field translation, plus a malformed-payload test.
- [ ] **E4.** Add SST secret `LettingsOpsVoiceSecret{Provider}` to `infra/secrets.ts`. Wire to API env.
- [ ] **E5.** Provision the chosen provider account, agent, and UK number per `docs/voice-agent-config.md`.
- [ ] **E6.** Preprod end-to-end: make a real call, confirm lead created with transcript, confirm CRM push runs.

## Block F — Operator-facing docs

- [ ] **F1.** Create `docs/voice-agent-config.md` per requirements US-3.5: agent setup, phone provisioning, webhook URL, SST secrets, troubleshooting.
- [ ] **F2.** Commit the system prompt at `docs/voice-system-prompt.md`. Reference it from the runbook.
- [ ] **F3.** Add a checksum-style test that loads the system prompt at startup and logs a fingerprint, so accidental drift is visible.

## Block G — Observability

- [ ] **G1.** Custom metrics per requirements US-3.6 (`VoiceCallCount`, `VoiceCallDuration`, `VoiceCallFieldExtractionMissing`).
- [ ] **G2.** Dashboard widget — daily field-extraction completeness per provider.
- [ ] **G3.** Alarm — > 30% calls/day with any missing field.

## Acceptance checklist

- [ ] `docs/voice-provider-audit.md` complete with first-cut scoring and finalist selection.
- [ ] `docs/voice-bake-off-results.md` complete with scored matrix and recommendation.
- [ ] `VoiceWebhookAdapter` exists; ElevenLabs adapter refactored; chosen provider adapter live in preprod.
- [ ] `docs/voice-agent-config.md` committed and accurate.
- [ ] Pre-merge gate green; coverage maintained at 90%+.
- [ ] Spec's `requirements.md` definition of done is satisfied.
