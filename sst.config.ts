/// <reference path="./.sst/platform/config.d.ts" />

export default $config({
  app(input) {
    const stage = input?.stage ?? "dev";
    return {
      name: "lettingsops-api",
      removal: stage === "production" ? "retain" : "remove",
      protect: stage === "production",
      home: "aws",
      providers: {
        aws: {
          defaultTags: {
            tags: {
              App: "lettingsops-api",
              Stage: stage,
            },
          },
        },
      },
    };
  },
  async run() {
    const api = await import("./infra/api");
    const email = await import("./infra/email");
    const web = await import("./infra/web");
    // Block G — Observability. Imported after api/email so the SNS
    // topic, alarms, and dashboards can reference `apiRoute` and
    // `emailProcessor` from those modules.
    const observability = await import("./infra/observability");
    return {
      api: api.lettingsAPI.url,
      emailBucket: email.emailBucket.name,
      alarmsTopic: observability.alarmsTopic.arn,
      web: $dev ? "http://localhost:5173" : web.frontend.url,
    };
  },
});
