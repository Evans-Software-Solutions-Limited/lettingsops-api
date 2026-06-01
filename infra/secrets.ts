export const databaseUrl = new sst.Secret("LettingsOpsDatabaseUrl");
export const emailDomain = new sst.Secret("LettingsOpsEmailDomain");
export const openAIKey = new sst.Secret("LettingsOpsOpenAIKey");
export const elevenLabsApiKey = new sst.Secret("LettingsOpsElevenLabsApiKey");
export const elevenLabsAgentId = new sst.Secret("LettingsOpsElevenLabsAgentId");
// JWT signing key for dashboard auth (Block D of spec-01-platform-hardening).
// Set via `sst secret set LettingsOpsJwtSigningKey <hex>` per stage.
// Suggested generation: `openssl rand -hex 32`.
export const jwtSigningKey = new sst.Secret("LettingsOpsJwtSigningKey");

// Email address that receives CloudWatch alarm notifications via SNS
// (Block G of spec-01-platform-hardening). Set per stage with
// `sst secret set LettingsOpsAlarmEmail you@example.com`. The
// subscription created in `infra/observability.ts` will send a
// confirmation email on first deploy — the recipient must click it
// once before notifications start flowing.
export const alarmEmail = new sst.Secret("LettingsOpsAlarmEmail");

// Shared secret for the `POST /webhooks/email` endpoint. Block I-PR-B
// landed the agency-resolution wiring but left the endpoint
// unauthenticated; without this guard an attacker who knows an
// agency's inbound address can inject leads under that tenant's id.
// Set per stage with `sst secret set LettingsOpsEmailWebhookSecret <hex>`
// (suggested generation: `openssl rand -hex 32`). Forwarders must
// include the value in an `x-webhook-secret` header on every call —
// missing/wrong → 401, missing env → 500 (operator misconfig). Block
// I-PR-B+C 2nd-sweep fix; see Inspector Brad's HIGH finding on PR #41.
export const emailWebhookSecret = new sst.Secret(
  "LettingsOpsEmailWebhookSecret",
);
