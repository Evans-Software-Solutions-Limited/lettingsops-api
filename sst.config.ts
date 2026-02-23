/// <reference path="./.sst/platform/config.d.ts" />

export default $config({
  app(input) {
    return {
      name: "lettingsops-api",
      removal: input?.stage === "production" ? "retain" : "remove",
      protect: ["production"].includes(input?.stage),
      home: "aws",
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
