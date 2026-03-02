# CODING_PATTERNS.md — LettingsOps API

Read this before writing any code or tests. These patterns are non-negotiable.

## Repo Structure

```
microservices/core/     ← main API service (Elysia + Drizzle + SST)
packages/api-utils/     ← shared JWT/auth utilities
packages/db/            ← Drizzle schema + Neon client
```

## Coverage Configuration

Coverage is measured via `microservices/core/vitest.config.ts`.

**What IS measured:**

- `src/application/**/*.ts` — services, use-case handlers, repositories
- `src/**/repositories/*.ts`

**What is pre-excluded (do NOT add to this list):**

- `src/api.ts`, `src/index.ts` — entry points
- `**/index.ts`, `**/api.ts` — barrel files
- `**/*.d.ts`, `**/types/**` — type definitions
- `**/emailProcessor.ts` — thin orchestrator, tested via integration
- Thin Elysia route handlers (files ending in `Handler.ts`) — these are excluded because they contain zero business logic; all logic lives in the service layer

**If you're struggling to hit 90%:** Write the missing branch tests. Do NOT add files to the exclude list. If a service method has an untested error branch, write a test that triggers the error. That's the job.

## Service Layer Pattern

All business logic lives in `*Service.ts` files. Handlers (`*Handler.ts`) are thin — they validate input via Elysia's `t.` schema and call the service. Never put logic in handlers.

```typescript
// Handler — thin, no logic
export const leadsListHandler = new Elysia()
  .get('/leads', ({ query }) => leadsListService.getLeads(query.page))

// Service — all the logic, fully testable
export class LeadsListService {
  constructor(private db: Db) {}
  async getLeads(page: number) { ... }
}
```

## Drizzle Mock Pattern

Use this exact pattern. No variations.

```typescript
function mockChain<T>(result: T) {
  const chain: Record<string, unknown> = {};
  const promise = Promise.resolve(result);

  const fluent = [
    "values", "set", "from", "where", "limit", "offset",
    "orderBy", "leftJoin", "innerJoin", "groupBy", "having",
  ];

  for (const method of fluent) {
    chain[method] = () => chain;
  }

  chain["returning"] = () => promise;
  chain["then"] = promise.then.bind(promise);
  chain["catch"] = promise.catch.bind(promise);
  chain["finally"] = promise.finally.bind(promise);

  return chain as any;
}

// In your test:
const mockDb = {
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
} as unknown as Db;

mockDb.select = vi.fn().mockReturnValue(mockChain([{ id: '1', ... }]));
mockDb.insert = vi.fn().mockReturnValue(mockChain([{ id: '1', ... }]));
```

**Do NOT** pass `{}` as a mock db — it has no methods and every call will throw.

## SST Resource Mocking

Mock `sst` at the module level, before imports:

```typescript
vi.mock("sst", () => ({
  Resource: {
    LettingsOpsElevenLabsApiKey: { value: "test-key" },
    LettingsOpsElevenLabsAgentId: { value: "test-agent-id" },
    LettingsOpsDatabaseUrl: { value: "postgresql://test" },
  },
}));
```

## Conditional Object Fields

When constructing objects from nullable/optional values:

```typescript
// WRONG
const payload = { subject: log.subject || undefined };

// CORRECT — only includes the key when truthy
const payload = {
  ...(log.subject && { subject: log.subject }),
};
```

## Email Ingestion Flow

`emailProcessor.ts` → `leadsCreateService.ts` → `qualificationSubmitService.ts` → Neon DB via Drizzle

LLM extraction happens in `qualificationSubmitService` — mock `openai` in those tests.

## ElevenLabs Webhook Flow

`POST /webhooks/elevenlabs` → `elevenLabsWebhookHandler.ts` → `elevenLabsWebhookService.ts`

The service stores the transcript and triggers LLM extraction. Mock the db and openai client in service tests.

## Test File Naming

Tests live in `__tests__/` directories alongside the code they test:

```
src/application/leads/list/
  leadsListService.ts
  __tests__/
    leadsListService.test.ts
```

## vitest.setup.ts

The core package has a `vitest.setup.ts` — check it before adding global mocks that might already be set up there.

## Common Mistakes to Avoid

1. Adding handler files to coverage exclude — write tests for the service instead
2. Using `mockReturnThis()` for Drizzle chains instead of the fluent pattern above
3. Not mocking SST Resource — tests will fail trying to resolve SST context
4. Forgetting `.returning()` returns a Promise, not a value — async/await is required
5. Missing error branch tests — the most common cause of failing to hit 90% branches
