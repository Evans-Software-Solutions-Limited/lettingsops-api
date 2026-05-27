import Elysia from "elysia";
import { Hono } from "hono";
import { handle } from "hono/aws-lambda";
import openapi from "@elysiajs/openapi";
import { requestContextPlugin } from "@lettingsops/api-utils/logger";

import { leadsCreateHandler } from "./application/leads/create/leadsCreateHandler";
import { leadsGetHandler } from "./application/leads/get/leadsGetHandler";
import { leadsListHandler } from "./application/leads/list/leadsListHandler";
import { leadsCommunicationHandler } from "./application/leads/communication/leadsCommunicationHandler";
import { qualificationSubmitHandler } from "./application/qualification/submit/qualificationSubmitHandler";
import { emailIngestionHandler } from "./application/ingestion/email/emailIngestionHandler";
import { viewingSlotsHandler } from "./application/viewings/slots/viewingSlotsHandler";
import { viewingBookHandler } from "./application/viewings/book/viewingBookHandler";
import { elevenLabsWebhookHandler } from "./application/webhooks/elevenlabs/elevenLabsWebhookHandler";
import { apiKeysHandler } from "./application/apikeys/apiKeysHandler";

const app = new Elysia()
  // Seed AsyncLocalStorage request context (requestId) before anything else
  // so all logger.* calls in the rest of the pipeline pick it up.
  .use(requestContextPlugin)
  .use(openapi())
  // Lead management
  .use(leadsCreateHandler)
  .use(leadsGetHandler)
  .use(leadsListHandler)
  .use(leadsCommunicationHandler)
  // Qualification
  .use(qualificationSubmitHandler)
  // Email ingestion webhook
  .use(emailIngestionHandler)
  // ElevenLabs webhook
  .use(elevenLabsWebhookHandler)
  // Viewings
  .use(viewingSlotsHandler)
  .use(viewingBookHandler)
  // API key management (auth-protected, agency-scoped)
  .use(apiKeysHandler);

export type LettingsApi = typeof app;

export const handler = handle(new Hono().mount("/", app.fetch));
