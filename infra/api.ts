export const lettingsAPI = new sst.aws.ApiGatewayV2("lettings-api");

lettingsAPI.route("$default", "microservices/core/src/api.handler");

// TODO: add auth when API key / JWT middleware is in place
// lettingsAPI.addAuthorizer(...)
