# CLAUDE.md – Webhooks & Email Ingestion

## What This Module Owns

External webhook integrations:

- **ElevenLabs:** Inbound phone calls → AI agent → webhook callback with extracted tenant info + transcript
- **Email:** Inbound property enquiry emails → parsed and extracted → lead creation
- Lead creation from webhook payloads, with full audit trail

## What Not to Break

### Webhook Signature Validation

- **ElevenLabs:** Every webhook must carry a signature header; verify it before processing
- **Email:** Authenticate sender (whitelist known email forwarding service, or DKIM/SPF)
- **Never** process a webhook without signature validation, even if it "looks right"
- Missing/invalid signature → 401 Unauthorized; log attempt

### Idempotent Processing

- Same webhook event must produce the same result (same lead, no duplicates)
- ElevenLabs: keyed by `callId` (check if lead with that call ID exists)
- Email: keyed by email message ID or timestamp + sender (check before creating)
- Replay scenario: webhook sent twice (network retry) → only one lead created
- Test this explicitly: send webhook twice, verify DB has one record

### PII Handling

- Phone, email, address: store in database but handle carefully
- Audit log: who accessed this PII, when, why
- Retention: implement delete/archival policy (e.g., 90 days for unqualified leads)
- Do not log full details to CloudWatch; use structured logging with PII scrubbing

### Data Extraction & Validation

- **ElevenLabs:** `extractedFields` (name, email, phone, propertyRef, moveInDate) — validate format
- **Email:** Parse subject, body for property reference, dates, occupancy count — validate against schema
- Validation rules:
  - Name: non-empty, reasonable length (< 200 chars)
  - Email: valid format (RFC 5322)
  - Phone: valid UK format (or reject gracefully)
  - Date: parseable, in future (or within 90 days)
  - PropertyRef: matches known property codes
- Invalid field → include in lead but flag as `needs_review: true`

## Local Conventions

### Repository Pattern

- `WebhookRepository` / `EmailRepository` handles all DB writes
- `LeadsRepository` handles lead creation (called from webhook handlers)
- No direct DB calls in handler files

### Error Handling

- 400: Bad request (missing required fields)
- 401: Unauthorized (invalid signature)
- 409: Conflict (duplicate webhook ID already processed)
- 500: Internal server error (transient DB issue, retry-able)
- Log all errors with webhook ID for tracing

### Transcript & Conversation Storage

- ElevenLabs provides full transcript array: store as JSON blob in `lead_communications` table
- Do not process transcript for sentiment/tone yet (future enhancement)
- Transcript is immutable once stored

## Common Mistakes

1. **Skipping signature validation** → fake webhooks, spoofing attacks
2. **Not checking for duplicate webhook ID** → double lead creation
3. **Parsing PII into log statements** → GDPR violation
4. **Assuming email sender is trustworthy** → spoofing risk
5. **Storing unvalidated data directly** → dirty data in DB, downstream bugs
6. **Forgetting to call repository** → direct DB access, no audit trail
7. **Not handling webhook timeout** → slow processing blocks webhook timeout, gets retried

## Test Expectations

- **Unit tests:** Signature validation, field parsing, validation rules
- **Integration tests:** Webhook handler → lead created in DB, repository called
- **Scenarios:**
  - Valid ElevenLabs webhook → lead created with transcript
  - Invalid signature → 401, no lead created
  - Duplicate webhook (same callId) → 409 or idempotent (no second lead)
  - Missing field (name=null) → lead created with `needs_review: true`
  - Email with spoofed sender → rejected or flagged
  - Concurrent webhooks (same property) → both leads created (no race condition)
  - Webhook timeout → handler returns quickly, async processing completes

## Files to Know

| File                                          | Purpose                                |
| --------------------------------------------- | -------------------------------------- |
| `elevenlabs/elevenLabsWebhookHandler.ts`      | Route handler for ElevenLabs callbacks |
| `elevenlabs/__tests__/`                       | ElevenLabs webhook tests               |
| `../ingestion/email/emailIngestionHandler.ts` | Email webhook handler                  |
| `../ingestion/email/__tests__/`               | Email ingestion tests                  |
| `../repositories/leadsRepository.ts`          | Lead creation & queries                |
| `../repositories/webhookRepository.ts`        | (If exists) Webhook event tracking     |

## Webhook Payload Examples

### ElevenLabs

```json
{
  "callId": "call_abc123",
  "agentId": "agent_xyz",
  "intent": "viewing_enquiry",
  "extractedFields": {
    "name": "John Smith",
    "email": "john@example.com",
    "phone": "+447700900123",
    "propertyRef": "PROP-2024-001",
    "moveInDate": "2024-04-15"
  },
  "transcript": [
    { "role": "agent", "message": "...", "timestamp": "..." },
    { "role": "user", "message": "...", "timestamp": "..." }
  ],
  "callDurationSeconds": 245,
  "signature": "sha256=..." // Provided in header
}
```

### Email (Internal Format)

```json
{
  "messageId": "msg_abc123@sendgrid.com",
  "from": "enquiries@example.com",
  "subject": "Viewing enquiry - Property PROP-2024-001",
  "body": "Hi, I'm interested in viewing...",
  "timestamp": "2024-02-28T10:00:00Z",
  "signature": "base64-encoded-dkim-signature"
}
```
