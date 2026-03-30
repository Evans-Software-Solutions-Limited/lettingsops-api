# MCP Relay — Implementation Work Order

**Date:** 2026-03-30
**Spec:** `docs/mcp-relay-spec-2026-03-30.md`
**Phase:** 1 (prototype only)

---

## Goal

Implement `scripts/task-events-mcp-server.ts` — a read-only MCP server that wraps the existing JSONL task event stream and exposes queryable task state to Claude agent sessions.

This is Phase 1 of the MCP relay spec. Do not implement Phase 2–4 in this run.

---

## Inputs

- Read before writing:
  - `docs/mcp-relay-spec-2026-03-30.md` (the spec this implements)
  - `docs/internal-task-events-v1.md` (event schema)
  - `scripts/task-events.ts` (the `readTaskEvents` function to wrap)
  - `scripts/task-events-state.ts` (projection logic to replicate or import)
- Reference:
  - OpenClaw MCP docs (ask if needed)
  - MCP TypeScript SDK: `@modelcontextprotocol/sdk`

---

## Outputs

1. `scripts/task-events-mcp-server.ts` — the MCP server
2. Any `package.json` / `bun.lockb` updates if the MCP SDK is not yet installed
3. A brief test run report: did `task_state` return correct state for a known taskId?

---

## Specification

### Server behaviour

- Transport: `stdio`
- Read-only: no write tools exposed
- Delegates all data access to `readTaskEvents()` from `./task-events`
- Projection logic: replicate the `projectState` function from `task-events-state.ts` (or import if clean)

### Tool: `task_state`

**Input schema:**

```typescript
{
  taskId?: string;   // one of taskId or repo required
  repo?: string;     // repo path or name substring match
}
```

**Behaviour:**

- If `taskId` provided: filter events to that task, return projected state
- If `repo` provided: find the most recent task for that repo, return its projected state
- If both provided: filter by taskId, ignore repo

**Output schema:**

```typescript
{
  taskId: string;
  state: string; // running | completed | failed | review_ready | no_changes | blocked | checks_failed | unknown
  eventCount: number;
  latestEvent: TaskEvent | null;
}
```

**Error cases:**

- No matching events: return `{ state: "unknown", eventCount: 0, latestEvent: null }`
- JSONL read failure: return error text via MCP error response

### Tool: `task_events_recent`

**Input schema:**

```typescript
{
  taskId?: string;
  repo?: string;
  limit?: number;   // default 20, max 100
}
```

**Behaviour:**

- Read all events
- Filter by taskId if provided
- Filter by repo if provided (same match logic as `task-events-state.ts`: path, name, or substring)
- Return last `limit` events sorted by timestamp ascending

**Output schema:**

```typescript
TaskEvent[]
```

---

## Steps

1. Install `@modelcontextprotocol/sdk` if not already present: `bun add @modelcontextprotocol/sdk`
2. Create `scripts/task-events-mcp-server.ts`
3. Import `readTaskEvents` from `./task-events`
4. Implement `projectState` (copy from `task-events-state.ts` — do not refactor the original)
5. Register both tools with the MCP server
6. Add a `"task-events-mcp"` script entry to root `package.json` if appropriate: `"bun scripts/task-events-mcp-server.ts"`
7. Manually test:
   ```bash
   # In one terminal: start the server
   bun scripts/task-events-mcp-server.ts
   # In another: run a quick task or emit a test event
   bun scripts/task-events.ts emit-fields --eventType task.started --taskId task_test_001 --source test --status started
   bun scripts/task-events.ts emit-fields --eventType task.review_ready --taskId task_test_001 --source test --status review_ready
   # Then verify via MCP (use a Claude session or call via MCP inspector)
   ```
8. Report what worked, what the returned state was, and any issues

---

## Guardrails

- Do not modify `task-events.ts`, `task-events-state.ts`, or `task-events-show.ts`
- Do not add write operations to the MCP server
- Do not implement Phase 2–4 (push changes, new event types, hard PR verification)
- Do not add a database, daemon, or persistent process beyond the MCP server itself
- Keep the server under 200 lines
- Do not touch any LettingsOps application code

---

## Definition of Done

- [ ] `scripts/task-events-mcp-server.ts` exists and starts without error
- [ ] `task_state` returns correct projected state for a known taskId
- [ ] `task_events_recent` returns the expected events
- [ ] No existing scripts are modified
- [ ] Branch pushed, PR opened, `@cursor review` posted
- [ ] Report includes: what was built, test result, any open questions
