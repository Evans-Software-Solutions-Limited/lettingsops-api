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
    return {
      api: api.lettingsAPI.url,
      emailBucket: email.emailBucket.name,
      web: $dev ? "http://localhost:5173" : web.frontend.url,
    };
  },
});
