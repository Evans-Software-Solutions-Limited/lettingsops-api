import Elysia from "elysia";
import { Hono } from "hono";
import { handle } from "hono/aws-lambda";
import openapi from "@elysiajs/openapi";

import { leadsCreateHandler } from "./application/leads/create/leadsCreateHandler";
import { leadsGetHandler } from "./application/leads/get/leadsGetHandler";
import { leadsListHandler } from "./application/leads/list/leadsListHandler";
import { qualificationSubmitHandler } from "./application/qualification/submit/qualificationSubmitHandler";
import { emailIngestionHandler } from "./application/ingestion/email/emailIngestionHandler";
import { viewingSlotsHandler } from "./application/viewings/slots/viewingSlotsHandler";
import { viewingBookHandler } from "./application/viewings/book/viewingBookHandler";

const app = new Elysia()
  .use(openapi())
  // Lead management
  .use(leadsCreateHandler)
  .use(leadsGetHandler)
  .use(leadsListHandler)
  // Qualification
  .use(qualificationSubmitHandler)
  // Email ingestion webhook
  .use(emailIngestionHandler)
  // Viewings
  .use(viewingSlotsHandler)
  .use(viewingBookHandler);

export type LettingsApi = typeof app;

export const handler = handle(new Hono().mount("/", app.fetch));
