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
