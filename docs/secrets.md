# Secrets

The canonical inventory of every secret the project uses. Two tiers:

1. **[SST-managed secrets](#sst-managed-secrets)** — declared in `infra/secrets.ts`, set via `bunx sst secret set <Name> <Value> --stage <Stage>`, resolved into Lambda env vars at deploy time.
2. **[GitHub Actions secrets](#github-actions-secrets)** — set in **Settings → Secrets and variables → Actions**, consumed directly by the deploy workflows for things SST can't do (OIDC role assumption, the pre-deploy `db:push` migration).

> First-time setup checklist lives in [`docs/next-steps-deployments.md`](./next-steps-deployments.md) §4.

---

## SST-managed secrets

Each secret is declared in `infra/secrets.ts` and wired into a Lambda env var by the relevant infra module (`infra/api.ts` for the API Lambda, `infra/email.ts` for the email-processor Lambda, etc.).

### Setting a value

```bash
# Per stage — repeat for staging + production
bunx sst secret set LettingsOpsJwtSigningKey <value> --stage staging
bunx sst secret set LettingsOpsJwtSigningKey <value> --stage production

# Inspect what's set without revealing the value
bunx sst secret list --stage staging
```

A secret that's declared in `infra/secrets.ts` but never set with `sst secret set` will fail the SST deploy ("secret not set"). Set every secret in the table below before the first deploy to a new stage.

### Inventory

| Secret                               | First introduced | Consumed by                                                                                      | Purpose                                                                                                                                                                                                                                                                                                                                                                                       | How to generate / rotate                                                                                                                                                                                                           |
| ------------------------------------ | ---------------- | ------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `LettingsOpsDatabaseUrl`             | Phase 0          | API Lambda (`DATABASE_URL`), email-processor Lambda (`DATABASE_URL`)                             | Neon serverless Postgres connection string. Used by Drizzle at runtime. Distinct from the GitHub-Actions `DATABASE_URL` secret — that one is only for the pre-deploy `drizzle-kit push` step.                                                                                                                                                                                                 | Copy from Neon dashboard → project → Connection details. Rotate by creating a new role/password in Neon, setting the new value, and removing the old role after one healthy deploy.                                                |
| `LettingsOpsEmailDomain`             | Phase 0          | email-processor Lambda (`EMAIL_DOMAIN`)                                                          | SES inbound domain (e.g. `lettings.example.com`). Used by the SES receipt-rule recipient filter in `infra/email.ts` and as a fallback for parsing recipient addresses.                                                                                                                                                                                                                        | Set once when the agency's inbound domain is configured in SES. Rarely rotated.                                                                                                                                                    |
| `LettingsOpsOpenAIKey`               | Phase 0          | API Lambda (`OPENAI_API_KEY`), email-processor Lambda (`OPENAI_API_KEY`)                         | OpenAI API key for LLM classification + field extraction in `emailProcessor.ts`.                                                                                                                                                                                                                                                                                                              | OpenAI dashboard → API keys → Create new secret key. Rotate quarterly or on suspected leak.                                                                                                                                        |
| `LettingsOpsElevenLabsApiKey`        | Phase 0          | API Lambda (`ELEVENLABS_API_KEY`)                                                                | ElevenLabs API key for outbound calls / agent configuration.                                                                                                                                                                                                                                                                                                                                  | ElevenLabs dashboard → Profile → API Keys. Rotate via dashboard.                                                                                                                                                                   |
| `LettingsOpsElevenLabsAgentId`       | Phase 0          | API Lambda (`ELEVENLABS_AGENT_ID`)                                                               | ElevenLabs agent identifier the webhook expects.                                                                                                                                                                                                                                                                                                                                              | Set once per agent provisioned in ElevenLabs.                                                                                                                                                                                      |
| `LettingsOpsJwtSigningKey`           | Block D          | API Lambda (`JWT_SIGNING_KEY`)                                                                   | HS256 signing key for dashboard JWT auth. `authPlugin.ts` 500s if absent (operator misconfig) — kept distinct from 401 (bad caller credentials) so the missing-config alarm doesn't get drowned by client errors.                                                                                                                                                                             | `openssl rand -hex 32` per stage. Rotate by minting a new value, deploying, then revoking outstanding tokens. Never log this value.                                                                                                |
| `LettingsOpsAlarmEmail`              | Block G (PR #39) | SNS subscription in `infra/observability.ts`                                                     | Recipient address for CloudWatch alarm notifications via the `LettingsOpsAlarms` SNS topic. First deploy sends a confirmation email — the recipient must click it once before notifications start flowing.                                                                                                                                                                                    | Set to the on-call / ops address. Update by changing the value and re-deploying (SST will replace the subscription).                                                                                                               |
| `LettingsOpsEmailWebhookSecret`      | Block I (PR #41) | API Lambda (`EMAIL_WEBHOOK_SECRET`), checked by `emailIngestionHandler.onRequest`                | Shared secret for `POST /webhooks/email`. Forwarders must include the value in an `x-webhook-secret` header on every call; the handler does a constant-time compare (`crypto.timingSafeEqual`) and rejects missing/wrong with 401. Without this an attacker who knows an agency's inbound address could inject leads under that tenant's id (the resolver maps `to` → real id).               | `openssl rand -hex 32` per stage. Share the staging value with the staging forwarder and the production value with the production forwarder. Rotate by minting a new value, deploying, then updating the forwarder.                |
| `LettingsOpsElevenLabsWebhookSecret` | Block I (PR #41) | API Lambda (`ELEVENLABS_WEBHOOK_SECRET`), HMAC-validated in `elevenLabsWebhookHandler.onRequest` | HMAC-SHA256 signing secret for `POST /webhooks/elevenlabs`. ElevenLabs sends `ElevenLabs-Signature: t=<unix>,v0=<hex>` where the hex is HMAC-SHA256 of `${t}.${rawBody}`. The handler verifies timestamp tolerance (±5 min) and the HMAC in constant time before schema parse. Same threat model as the email secret — `agentId` resolves to a real tenant, so unsigned input is exploitable. | Set in the ElevenLabs dashboard (**Webhooks → Signing secret**) and mirror with `sst secret set LettingsOpsElevenLabsWebhookSecret <value>`. Rotate by generating a new value in the ElevenLabs dashboard and updating both sides. |

---

## GitHub Actions secrets

Set in **Settings → Secrets and variables → Actions** (repository-level, or per-environment if you've created `staging` / `production` environments).

### Inventory

| Secret                    | Used by                                                       | Purpose                                                                                                                                                                           | Notes                                                                                                                                                                                                                                                         |
| ------------------------- | ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AWS_ROLE_ARN_STAGING`    | `staging-deploy.yml` (`Configure AWS Credentials` step)       | IAM role ARN for the staging AWS account. Assumed via OIDC (`aws-actions/configure-aws-credentials@v4`) — no long-lived access keys.                                              | Some spec sections call this `AWS_ROLE_ARN_PREPROD`; the implementation uses `STAGING`. See [`docs/next-steps-deployments.md`](./next-steps-deployments.md) §5 for the stage-naming note.                                                                     |
| `AWS_ROLE_ARN_PRODUCTION` | `deploy-production.yml`                                       | IAM role ARN for the production AWS account. Stricter trust policy recommended (scope to `ref:refs/tags/v*` or the `release` event).                                              | OIDC-only, same pattern as staging.                                                                                                                                                                                                                           |
| `DATABASE_URL`            | both deploy workflows (`Push database schema (db:push)` step) | Neon Postgres connection string for the target stage. Read directly by the GitHub runner so `drizzle-kit push` can apply schema changes before SST deploys the Lambda.            | **Separate from `LettingsOpsDatabaseUrl`** — that SST secret is the runtime value baked into the Lambda. This GitHub secret is the migration-time value used by the runner. Both must point at the same database, and per-environment scoping is recommended. |
| `AWS_ROLE_ARN_PR`         | (currently unused)                                            | Reserved for a per-PR environments workflow (`pr-environment.yml`) that earlier docs referenced but the repo doesn't ship today. Leave unset until that pipeline is reintroduced. | Safe to ignore; nothing references it.                                                                                                                                                                                                                        |

### GitHub Actions variables

| Variable     | Default     | Used by               | Purpose                                                                    |
| ------------ | ----------- | --------------------- | -------------------------------------------------------------------------- |
| `AWS_REGION` | `eu-west-2` | both deploy workflows | Region for AWS resources. The workflows fall back to `eu-west-2` if unset. |

---

## Rotation guidance

For any secret with **caller-supplied credentials** (`LettingsOpsJwtSigningKey`, both webhook secrets):

1. Mint a new value.
2. `sst secret set <Name> <NewValue> --stage <Stage>` and re-deploy.
3. Update callers (dashboard sessions, forwarders, ElevenLabs dashboard) to use the new value.
4. Revoke / invalidate any outstanding tokens or older shared secrets.

For **third-party API keys** (`LettingsOpsOpenAIKey`, `LettingsOpsElevenLabsApiKey`):

1. Mint a new key in the provider's dashboard.
2. `sst secret set <Name> <NewValue> --stage <Stage>` and re-deploy.
3. Confirm the next deploy is healthy.
4. Revoke the old key in the provider's dashboard.

For `LettingsOpsDatabaseUrl` (and the matching GitHub `DATABASE_URL`):

1. Create a new Neon role with the same permissions.
2. Update both the SST secret and the GitHub Actions secret to the new connection string.
3. Deploy and confirm health.
4. Remove the old Neon role.

For `LettingsOpsAlarmEmail`: just update the value and redeploy. SST will replace the SNS subscription; the new address will need to confirm the subscription email on first delivery.

---

## What's NOT in this inventory

- **OAuth / SSO secrets for external dashboards** — none today; would be added here when the dashboard's identity provider lands.
- **Per-tenant API keys for the `/api-keys` endpoint** — those are user-issued, stored hashed in the `api_keys` table, and managed by the tenant themselves via the API. They don't live in SST or GitHub.
- **Per-tenant `agent_agency_map` rows** — operational data, not secrets. Seeded after the I-PR-A migration via `INSERT ... ON CONFLICT DO NOTHING`. See `application/auth/agentAgencyRepository.ts`.
