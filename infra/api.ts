import {
  databaseUrl,
  openAIKey,
  elevenLabsApiKey,
  elevenLabsAgentId,
  jwtSigningKey,
} from "./secrets";

export const lettingsAPI = new sst.aws.ApiGatewayV2("lettings-api");

// Captured so `infra/observability.ts` can attach Lambda alarms and
// dashboards to the underlying function via `apiRoute.nodes.function.name`.
export const apiRoute = lettingsAPI.route("$default", {
  handler: "microservices/core/src/api.handler",
  // `cloudwatch:PutMetricData` is required by `cloudWatchMetrics.ts`
  // (the `LeadsCreated` custom metric publisher called from
  // `LeadRepository.create`). SST v3's default execution role only
  // grants `AWSLambdaBasicExecutionRole` (Logs only); without this
  // every publish would `AccessDeniedException`, get swallowed by the
  // publisher's catch, and the Ingestion dashboard would be silently
  // empty in production. CloudWatch PutMetricData doesn't support
  // resource-level permissions, hence `resources: ["*"]`.
  permissions: [{ actions: ["cloudwatch:PutMetricData"], resources: ["*"] }],
  environment: {
    DATABASE_URL: databaseUrl.value,
    OPENAI_API_KEY: openAIKey.value,
    ELEVENLABS_API_KEY: elevenLabsApiKey.value,
    ELEVENLABS_AGENT_ID: elevenLabsAgentId.value,
    // JWT signing key consumed by the auth plugin. Plugin treats absence
    // as a permanent 500 (operator misconfig) — never log this value.
    JWT_SIGNING_KEY: jwtSigningKey.value,
  },
});
