# Skill: Webhook Handler

Use this when implementing or modifying external webhook handlers (ElevenLabs, email, etc).

## Before You Start

1. Read `microservices/core/src/application/webhooks/CLAUDE.md` — signature validation, idempotency, PII rules
2. Identify the signature method (ElevenLabs = signature header; Email = DKIM/SPF or sender whitelist)
3. Understand the webhook payload structure

## Checklist

- [ ] Validate webhook signature before any processing
- [ ] Check for duplicate webhook ID (idempotent processing)
- [ ] Parse and validate extracted fields (name, email, phone, dates, refs)
- [ ] Sanitise PII before logging
- [ ] Call repository to create lead (no direct DB calls)
- [ ] Handle validation errors gracefully (400, 422 with details)
- [ ] Return success/failure quickly (webhook timeout typically 30s)
- [ ] If processing is complex, offload to async queue (Lambda → SQS)
- [ ] Write tests: valid webhook, invalid signature, duplicate webhook, missing fields

## After You're Done

1. `bun run test:unit` — webhook tests pass
2. Test webhook replay: call handler twice with same ID, verify one lead created
3. Check logs: no full PII in CloudWatch, only scrubbed references
4. Verify signature validation works (test with wrong signature, should 401)
