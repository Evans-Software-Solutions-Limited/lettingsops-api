# LettingsOps API

Automated lettings operations platform — AI-powered enquiry qualification, viewing booking, compliance tracking, and CRM automation.

## Stack

- **Runtime:** Bun
- **Framework:** Elysia (type-safe routes) + Hono (Lambda adapter)
- **Infra:** SST v3 (AWS)
- **DB:** Neon (serverless Postgres) + Drizzle ORM
- **Build:** Turbo monorepo
- **Tests:** Vitest

## Structure

```
microservices/core/     # Main lettings API service (Lambda)
packages/web/           # Agent dashboard (Vite + React + Shadcn)
packages/api-utils/     # Shared JWT, logging, env utilities
infra/                  # SST infrastructure definitions
```

## Getting started

```bash
bun install
bun run dev        # SST dev mode
bun run test       # Run all unit tests
```
