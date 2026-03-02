import {
  databaseUrl,
  openAIKey,
  elevenLabsApiKey,
  elevenLabsAgentId,
  elevenLabsWebhookSecret,
} from "./secrets";

export const lettingsAPI = new sst.aws.ApiGatewayV2("lettings-api");

lettingsAPI.route("$default", {
  handler: "microservices/core/src/api.handler",
  environment: {
    DATABASE_URL: databaseUrl.value,
    OPENAI_API_KEY: openAIKey.value,
    ELEVENLABS_API_KEY: elevenLabsApiKey.value,
    ELEVENLABS_AGENT_ID: elevenLabsAgentId.value,
    ELEVENLABS_WEBHOOK_SECRET: elevenLabsWebhookSecret.value,
  },
});

// TODO: add auth when API key / JWT middleware is in place
// lettingsAPI.addAuthorizer(...)
