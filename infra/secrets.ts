export const databaseUrl = new sst.Secret("LettingsOpsDatabaseUrl");
export const emailDomain = new sst.Secret("LettingsOpsEmailDomain");
export const openAIKey = new sst.Secret("LettingsOpsOpenAIKey");
export const elevenLabsApiKey = new sst.Secret("LettingsOpsElevenLabsApiKey");
export const elevenLabsAgentId = new sst.Secret("LettingsOpsElevenLabsAgentId");
export const elevenLabsWebhookSecret = new sst.Secret(
  "LettingsOpsElevenLabsWebhookSecret",
);
