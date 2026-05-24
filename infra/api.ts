import {
  databaseUrl,
  openAIKey,
  elevenLabsApiKey,
  elevenLabsAgentId,
  jwtSigningKey,
} from "./secrets";

export const lettingsAPI = new sst.aws.ApiGatewayV2("lettings-api");

lettingsAPI.route("$default", {
  handler: "microservices/core/src/api.handler",
  environment: {
    DATABASE_URL: databaseUrl.value,
    OPENAI_API_KEY: openAIKey.value,
    ELEVENLABS_API_KEY: elevenLabsApiKey.value,
    ELEVENLABS_AGENT_ID: elevenLabsAgentId.value,
    // JWT signing key consumed by the auth plugin (Block D).
    // Plugin treats absence as a permanent 500 — never log this value.
    JWT_SIGNING_KEY: jwtSigningKey.value,
    // Block D ships auth in "introduce, off by default" mode: when this is
    // not set or set to anything other than "true", the plugin resolves
    // credentials if present (and enriches the request context) but does
    // not 401 on missing creds. Flip to "true" per stage when ready.
    AUTH_ENFORCED: "false",
  },
});

// TODO: add auth when API key / JWT middleware is in place
// lettingsAPI.addAuthorizer(...)
