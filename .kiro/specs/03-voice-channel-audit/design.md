# Phase 3 — Voice Channel Audit & Rewire: Design

## 1. The audit (research, not code)

### 1.1 Candidates

| Provider              | Why on the list                                                                                                                            |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| ElevenLabs Conv AI v2 | Incumbent. Voice quality issue was the trigger for this audit; v2 may have closed the gap. Sunk-cost-resistant choice if it now meets bar. |
| Vapi                  | Purpose-built for AI voice agents in 2025–26; opinionated platform, fast iteration loop, good function-calling story.                      |
| Retell                | Similar positioning to Vapi; particularly strong on latency and barge-in.                                                                  |
| Bland                 | Aggressive on price and telephony bundle; quality has been historically uneven.                                                            |
| LiveKit + Cartesia    | Most flexible (BYO STT/LLM/TTS), best latency floor with Cartesia Sonic TTS, more building.                                                |
| OpenAI Realtime API   | Underlying real-time model from OpenAI; needs paired telephony (Twilio Media Streams or similar); lowest abstraction.                      |

### 1.2 Rubric

Score each on 1–5:

- **Voice quality** — UK accent, naturalness, prosody, breath/pauses.
- **Latency feel** — round-trip and barge-in.
- **Conversation control** — interruption, repair, topic-switch handling.
- **Function-calling** — mid-call tool calls (live booking is the dream feature).
- **Telephony bundle** — does it ship inbound UK numbers, or do you need Twilio?
- **Webhook ergonomics** — payload shape, signature scheme, retry behaviour.
- **Pricing** — per-minute cost at our expected volumes (estimate 100 calls/agency/month, ~3 min each).
- **DPA / SOC-2** — necessary for any UK lettings agency carrying tenant data.
- **Time to first call** — how fast can a new engineer wire this up?

### 1.3 Method

- **First cut** (no calls): score every provider on every rubric column from docs + pricing pages.
- **Bake-off** (real calls): take top two, run the five-scenario script (`docs/voice-bake-off-script.md`).
- **Decision document**: `docs/voice-provider-audit.md` lays out scores; `docs/voice-bake-off-results.md` lays out raw call notes + final recommendation.

## 2. The adapter

### 2.1 Port

```ts
// microservices/core/src/application/adapters/voice/voiceWebhookAdapter.ts

export interface NormalisedTranscriptTurn {
  role: "agent" | "user";
  message: string;
  timestamp: string;
}

export interface NormalisedVoicePayload {
  providerKind: string; // "elevenlabs" | "vapi" | ...
  providerCallId: string; // for idempotency
  providerAgentId: string;
  intent: "viewing_enquiry" | "maintenance" | "rent_query" | "other";
  extractedFields: {
    name?: string;
    email?: string;
    phone?: string;
    propertyRef?: string;
    moveInDate?: string;
  };
  transcript: NormalisedTranscriptTurn[];
  durationSeconds?: number;
  signatureValid: boolean;
  rawPayload: unknown; // archived as-is on the communication log
}

export interface VoiceWebhookAdapter {
  readonly kind: string;
  parseWebhook(
    rawBody: string,
    headers: Record<string, string>,
  ): Promise<NormalisedVoicePayload>;
}
```

### 2.2 Dispatcher

A single route `POST /webhooks/voice/:providerKind` replaces `/webhooks/elevenlabs` (the old path is kept as an alias for one release cycle so the ElevenLabs dashboard doesn't break).

The route picks the right adapter by `providerKind`, calls `parseWebhook`, and:

1. If `signatureValid === false` → 401.
2. Idempotency check: does a lead exist already with this `providerCallId` in its metadata? If yes → 200 (idempotent ack).
3. Resolve `agencyId` from the agent → agency mapping (new `voice_agents` table, see §3).
4. Call `voiceWebhookService.handleCall(normalised, agencyId)` which uses the lead-create path from Phase 2 (so CRM push happens automatically).

### 2.3 ElevenLabs adapter (refactor, not rewrite)

The existing `elevenLabsWebhookService` is moved to `microservices/core/src/application/adapters/voice/elevenLabsAdapter.ts` and exposed as a `VoiceWebhookAdapter` implementation. The HMAC verification logic from `elevenLabsSignatureVerification.ts` stays as-is. Lead-creation logic moves out into the shared `voiceWebhookService`.

### 2.4 New provider adapter

Whichever provider wins, its adapter follows the ElevenLabs shape:

1. Verify signature against an SST secret named `LettingsOpsVoiceSecret{Provider}`.
2. Parse provider-specific payload → normalised shape.
3. Set `signatureValid` and let the dispatcher handle 401.

## 3. Agency-provider mapping

New table `voice_agents`:

```ts
export const voiceAgents = pgTable(
  "voice_agents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    agencyId: uuid("agency_id")
      .notNull()
      .references(() => agencies.id, { onDelete: "cascade" }),
    providerKind: text("provider_kind").notNull(), // matches adapter kind
    providerAgentId: text("provider_agent_id").notNull(), // the provider's id for the agent
    phoneNumber: text("phone_number"), // the inbound UK number assigned
    signatureSecret: text("signature_secret").notNull(), // SST secret name (not the value)
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("voice_agents_provider_kind_agent_id_idx").on(
      t.providerKind,
      t.providerAgentId,
    ),
  ],
);
```

The dispatcher resolves `agencyId` via `voice_agents.providerAgentId` lookup. The signature secret is looked up via the same `loadCreds` helper from Phase 2.

## 4. Idempotency

A new `voice_call_events` table records every webhook receipt:

```ts
export const voiceCallEvents = pgTable(
  "voice_call_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    providerKind: text("provider_kind").notNull(),
    providerCallId: text("provider_call_id").notNull(),
    agencyId: uuid("agency_id").notNull(),
    leadId: uuid("lead_id"),
    receivedAt: timestamp("received_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("voice_call_events_provider_call_idx").on(
      t.providerKind,
      t.providerCallId,
    ),
  ],
);
```

The unique index is the idempotency guard. On unique-violation, the dispatcher returns 200 with the existing `leadId`. The existing call-id metadata field on `leads` is kept for backward compatibility but `voice_call_events` becomes the canonical store.

## 5. Observability

- Custom metrics from §US-3.6.
- Add `voiceCallId` to the standard `LogContext` for the duration of webhook handling.
- The integration_events table (Phase 2) also records the voice→CRM hop.

## 6. Files touched

- New: `docs/voice-provider-audit.md`, `docs/voice-bake-off-script.md`, `docs/voice-bake-off-results.md`, `docs/voice-agent-config.md`, `docs/voice-system-prompt.md`.
- New: `microservices/core/src/application/adapters/voice/voiceWebhookAdapter.ts`, `voiceWebhookDispatcher.ts`, `__tests__/`.
- New: `adapters/voice/elevenLabsAdapter.ts` (refactor of existing service).
- New: `adapters/voice/<chosen>Adapter.ts` (the winner).
- New: `microservices/core/src/application/voice/voiceWebhookService.ts` (shared lead-create path).
- New: `packages/db/migrations/0003_voice_agents.sql` (and snapshot).
- Updated: `microservices/core/src/api.ts` to swap `elevenLabsWebhookHandler` for `voiceWebhookDispatcher`.
- Updated: `infra/secrets.ts` to add `LettingsOpsVoiceSecret{Provider}` entries (one per supported provider).
- Deprecated alias: `POST /webhooks/elevenlabs` retained for one release pointing at the dispatcher with `providerKind="elevenlabs"`.

## 7. Risks

- **Provider lock-in via prompt engineering.** Mitigation: keep the system prompt provider-agnostic and committed to repo as a single source of truth. Add tests that the prompt loads and matches a known checksum so it doesn't drift accidentally.
- **Mid-call function calling is tempting and out of scope.** Mitigation: explicitly call it a Phase 5+ feature in the spec. Don't let it leak in here.
- **Bake-off bias toward the new shiny.** Mitigation: include ElevenLabs v2 as a finalist by default unless first-cut scores rule it out. The decision needs to be defensible.
- **DPA negotiation can be slow.** Mitigation: kick off the DPA conversation with both finalists as soon as the first cut completes, so contracts don't gate go-live.
