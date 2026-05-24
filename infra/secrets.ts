export const databaseUrl = new sst.Secret("LettingsOpsDatabaseUrl");
export const emailDomain = new sst.Secret("LettingsOpsEmailDomain");
export const openAIKey = new sst.Secret("LettingsOpsOpenAIKey");
export const elevenLabsApiKey = new sst.Secret("LettingsOpsElevenLabsApiKey");
export const elevenLabsAgentId = new sst.Secret("LettingsOpsElevenLabsAgentId");
// JWT signing key for dashboard auth (Block D of spec-01-platform-hardening).
// Set via `sst secret set LettingsOpsJwtSigningKey <hex>` per stage.
// Suggested generation: `openssl rand -hex 32`.
export const jwtSigningKey = new sst.Secret("LettingsOpsJwtSigningKey");
