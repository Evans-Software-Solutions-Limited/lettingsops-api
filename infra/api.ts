import { databaseUrl } from "./secrets";

export const lettingsAPI = new sst.aws.ApiGatewayV2("lettings-api");

lettingsAPI.route("$default", {
  handler: "microservices/core/src/api.handler",
  environment: {
    DATABASE_URL: databaseUrl.value,
  },
});

// TODO: add auth when API key / JWT middleware is in place
// lettingsAPI.addAuthorizer(...)
