# Voice Provider Evaluation — Misoone AI vs ElevenLabs

**Date:** 2026-06-05
**Author:** Claude (agent), at Brad's request
**Status:** Evaluation spike — recommendation below, no code change
**Scope:** Whether [Misoone AI](https://misooneai.com/) can replace ElevenLabs as
LettingsOps' voice provider for the inbound phone → lead pipeline.

---

## TL;DR

**Misoone is not a replacement for ElevenLabs in this system — it's a different
product category.** ElevenLabs sits in LettingsOps as a **conversational-AI /
telephony** provider: it answers inbound calls, runs an AI agent, and POSTs a
signed webhook with a transcript and extracted tenant fields, which we turn into
a lead (`POST /webhooks/elevenlabs`). Misoone, per its own API docs, is a
**text-to-speech (TTS) audio-generation** tool — you send it a written script,
it returns an audio file. It has **no telephony, no conversational agent, no
inbound webhooks, no transcripts, no field extraction, and no signature
verification**. None of the integration surface our code depends on exists.

It may well be the best _TTS_ engine you've heard — expressive output, ~110 ms
latency, one-shot voice cloning are genuinely strong — but that's a different
market than the one we're buying in. Recommendation: **do not pursue Misoone as
the ElevenLabs replacement.** Keep it on a "TTS options" shortlist if we ever
need outbound voice _rendering_ (we don't today). If the goal is genuinely to
switch _conversational-voice_ providers, the real comparables are listed in §6.

---

## 1. What LettingsOps actually requires from a voice provider

Grounded in the current integration (`microservices/core/src/application/webhooks/elevenlabs/`
and `microservices/core/src/application/webhooks/CLAUDE.md`):

| #   | Requirement                                                               | Why it's load-bearing                                                                      |
| --- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| R1  | **Inbound telephony** — answer a real phone call                          | The lead source is a caller dialling in; this is the whole point                           |
| R2  | **Conversational AI agent** — hold a dialogue, detect intent              | We receive `intent: viewing_enquiry \| maintenance \| rent_query \| other`                 |
| R3  | **Post-call webhook (server→server)**                                     | `POST /webhooks/elevenlabs` is how a call becomes a lead                                   |
| R4  | **Signed webhook** — HMAC-SHA256 over `${timestamp}.${rawBody}`           | `verifyElevenLabsSignature`; replay window ±5 min; PII pipeline, spoofing is a real threat |
| R5  | **Structured field extraction** — name/email/phone/propertyRef/moveInDate | `extractedFields` drives lead creation without human transcription                         |
| R6  | **Transcript array** — `{role, message, timestamp}[]`                     | Stored as a communication-log note on the lead                                             |
| R7  | **Stable agent identifier**                                               | `agentId → agency.id` via `agent_agency_map` for tenant routing                            |
| R8  | **Idempotency handle** — stable per-call id                               | `callId` dedupes retries (webhooks/CLAUDE.md idempotency rule)                             |
| R9  | **GDPR / UK data-protection posture**                                     | Calls carry PII (name, phone, address); we need data residency + retention answers         |

## 2. What Misoone actually is

Evidence from Misoone's own pages (fetched 2026-06-05):

- **Product:** "generates multi-voice dialogue audio from written scripts… converts a
  written multi-speaker script into an audio file." An 8B TTS model.
- **API** (`/docs/miso-one-api`): exactly two endpoints —
  - `POST /api/ai/generate` (script → task id)
  - `POST /api/ai/query` (poll task → audio URL)
- **Auth:** _session cookie_ ("include your session cookie when calling the API
  from a browser session or a trusted tool") — not an API key, not HMAC.
- **Explicitly NOT supported** (per its own docs): inbound telephony, conversational
  AI agents, real-time dialogue, post-call webhooks, call transcripts, field
  extraction, signature/HMAC verification.
- **Provenance flag:** an independent web search indicates the site is "presented
  as an independent workspace for people interested in trying Miso One AI–style
  voice workflows rather than an official provider site." In other words it may be
  a third-party playground wrapper, not the model vendor.
- **Compliance pages:** the privacy page returned **HTTP 404** at evaluation time;
  no data-residency, GDPR, sub-processor, or security-certification statements
  were locatable.

## 3. Scorecard

| Req                      | ElevenLabs (incumbent)          | Misoone                           | Verdict                                |
| ------------------------ | ------------------------------- | --------------------------------- | -------------------------------------- |
| R1 Inbound telephony     | ✅ in production                | ❌ none                           | **Blocker**                            |
| R2 Conversational agent  | ✅                              | ❌ TTS only                       | **Blocker**                            |
| R3 Post-call webhook     | ✅ `/webhooks/elevenlabs`       | ❌ poll-for-audio only            | **Blocker**                            |
| R4 Signed webhook (HMAC) | ✅ HMAC-SHA256, ±5 min          | ❌ session cookie                 | **Blocker**                            |
| R5 Field extraction      | ✅ `extractedFields`            | ❌                                | **Blocker**                            |
| R6 Transcript            | ✅ `{role,message,timestamp}[]` | ❌                                | **Blocker**                            |
| R7 Agent→agency id       | ✅ `agentId`                    | ❌ no concept                     | **Blocker**                            |
| R8 Idempotency id        | ✅ `callId`                     | ⚠️ task id (audio gen, not calls) | N/A                                    |
| R9 GDPR/residency        | ⚠️ documented, EU options       | ❌ no statement; privacy page 404 | **Unknown/Risk**                       |
| — TTS expressiveness     | good                            | **excellent (claimed)**           | Misoone wins — but irrelevant to R1–R8 |

**7 of 9 requirements are hard blockers**, because Misoone is in the wrong product
category. The one place it shines (expressive TTS) is not a requirement we have.

## 4. Why it can feel like "the best on the market"

Misoone is being judged on **voice quality** — and as a TTS engine it may genuinely
be excellent. ElevenLabs is _also_ a top TTS vendor, so the comparison feels
apples-to-apples. But LettingsOps does not use ElevenLabs for TTS. It uses
ElevenLabs **Conversational AI + telephony** (the inbound-call agent that produces
the webhook). Swapping the TTS engine underneath would change how a voice _sounds_;
it would not change, and cannot provide, the call-handling pipeline we depend on.

## 5. Risk flags if we ignored the above and tried to adopt it anyway

- **Security regression:** session-cookie auth vs the HMAC-signed, replay-protected
  webhook we hardened in PR #41. There is nothing to validate a callback with.
- **PII/compliance gap:** no GDPR/data-residency posture and a 404 privacy page is
  disqualifying for a production dependency that processes caller name/phone/address
  (see project `CLAUDE.md` → PII compliance is a top-5 priority).
- **Provenance/legal:** if the site is an unofficial wrapper, terms, SLA, and data
  handling are unknowable — unacceptable for a tenant-data path.

## 6. If the real goal is to switch _conversational-voice_ providers

Then the comparables to evaluate against ElevenLabs Conversational AI are the
telephony-agent platforms, not TTS engines. Candidates worth a proper bake-off
(all support inbound calls + post-call webhooks):

- **Retell AI**, **Vapi**, **Bland AI** — purpose-built voice-agent platforms
- **Telnyx Voice AI** — carrier-grade telephony + agents
- **OpenAI Realtime API** — if we want to own the agent logic

Evaluate each against R1–R9, with R4 (signature scheme) and R9 (GDPR/residency)
as gating criteria given the PII pipeline.

## 7. Migration-cost sketch (for whichever real provider wins)

The integration is well-isolated, so a provider swap is **contained** — roughly:

- **Signature validator** — `verifyElevenLabsSignature` in `elevenLabsWebhookHandler.ts`
  is provider-specific (header name, `t=…,v0=…` format, `${ts}.${body}` signing
  string). A new provider needs its own validator with the same shape (runs in
  `.onRequest`, before schema parse, `timingSafeEqual`, ±skew window). ~1 file.
- **Payload schema** — the Elysia `t.Object({...})` body schema + the
  `ElevenLabsPayload` type. Remap the new provider's fields to our internal shape
  (`intent`, `extractedFields`, `transcript[]`, `callId`, `agentId`). ~1–2 files.
- **Agent→agency routing** — `agent_agency_map` + `AgentAgencyRepository`
  keys on the provider's agent id; a new provider means re-seeding that map and
  possibly renaming the column concept. ~schema + 1 repo.
- **Secret** — a new `LettingsOps<Provider>WebhookSecret` SST secret + infra link
  (mirror the ElevenLabs entry in `infra/secrets.ts` / `infra/api.ts`).
- **Idempotency** — keep the `callId`-style dedupe (webhooks/CLAUDE.md) keyed on
  the new provider's stable call id.
- **Tests** — port the handler integration tests (signature accept/reject, replay,
  idempotency, unknown-agent → 401).

Notably, this is the kind of swap the **Phase-2 adapter pattern** is designed for
on the _outbound_ side — but the inbound voice webhook predates it and isn't yet
behind a port. If provider-switching becomes a recurring need, a thin inbound
"voice provider" port (validator + payload-normaliser) would make the next swap a
config change rather than a code change. Out of scope here; flagged for the backlog.

---

## Recommendation

1. **Do not adopt Misoone as the ElevenLabs replacement** — category mismatch
   (TTS engine, not a telephony/conversational-agent platform); 7/9 hard blockers.
2. **Keep ElevenLabs** for the inbound-call pipeline for now.
3. If voice _quality_ is the actual itch, that's a tuning conversation within
   ElevenLabs (voice selection), not a provider migration.
4. If provider-switching is genuinely on the table, run a structured bake-off of
   the §6 telephony-agent platforms against R1–R9, gating on signature scheme and
   GDPR/residency.
5. Consider a thin inbound voice-provider port (§7) only if switching becomes
   recurring.
