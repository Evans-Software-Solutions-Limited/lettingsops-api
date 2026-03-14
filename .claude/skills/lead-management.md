# Skill: Lead Management

Use this when creating, querying, or updating leads in the database, including qualification and status transitions.

## Before You Start

1. Read the root CLAUDE.md → "Dangerous Areas" → "Lead Data & Tenant Information"
2. Understand lead statuses: `NEW`, `QUALIFIED`, `VIEWING_BOOKED`, `REJECTED`, `ARCHIVED`
3. Check `LeadsRepository` for existing methods before adding DB logic to handlers

## Lead Lifecycle

1. **NEW:** Created from webhook (ElevenLabs/email/web form)
2. **QUALIFICATION:** Tenant data validated, credit/income checked
3. **VIEWING_BOOKED:** Lead successfully scheduled for a viewing
4. **REJECTED:** Failed qualification or no interest
5. **ARCHIVED:** Old or converted (never delete)

## Checklist

- [ ] Lead creation includes source (`phone`, `email`, `web`)
- [ ] All lead fields validated before storing
- [ ] Status transitions are atomic (one DB call)
- [ ] Qualification rules are transparent and auditable
- [ ] No discrimination logic (no auto-reject based on protected characteristics alone)
- [ ] Audit log: who changed status, when, why
- [ ] Communication tracking: link emails, calls, viewings to lead
- [ ] Search/filtering: by status, source, date range, property
- [ ] Tests: lead creation, status transitions, filtering, concurrent updates

## Common Patterns

### Lead Creation

```ts
const lead = await leadsRepository.create({
  name,
  email,
  phone,
  source: 'phone',  // or 'email', 'web'
  status: 'NEW',
  propertyRef,
  extractedData: { ... },  // webhook payload
  communicationId: webhookId,  // for linking
});
```

### Status Transition

```ts
await leadsRepository.updateStatus(leadId, "QUALIFIED", {
  reason: "Income verified",
  updatedBy: userId,
});
```

### Qualification

```ts
const qualification = {
  leadId,
  incomeVerified: true,
  creditScore: 700,
  occupancyOk: true,
  petsAllowed: false,
  flaggedForReview: false,
};
await qualificationRepository.upsert(qualification);
```

## After You're Done

1. `bun run test:unit` — lead and qualification tests pass
2. Coverage ≥ 90% on `LeadsRepository` and qualification logic
3. Verify status transitions are correct (no invalid transitions)
4. Check audit logging is in place for all status changes
5. Test concurrent updates (two leads updating same property availability)
