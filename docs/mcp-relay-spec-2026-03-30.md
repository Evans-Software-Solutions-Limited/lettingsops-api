# MCP Completion Relay — Technical Spec

**Date:** 2026-03-30
**Status:** Proposed
**Scope:** Improving Claude task completion feedback reliability in OpenClaw

---

## Problem Statement

The current completion notification in `claude-run-repo-task.sh` is unreliable:

```bash
openclaw agent --agent main --message "ACTION REQUIRED: ..." || true
```

Three distinct failure modes make this insufficient:

1. **Silent skip** — if the `openclaw` CLI is not in `$PATH`, the function returns `0` with no notification sent and no log entry
2. **Dead receiver** — if the main agent session is not active when the call fires, the message is lost (no queue, no persistence)
3. **No confirmation** — `|| true` discards all errors; the launcher has no way to know whether the notification landed

The result: you must grep raw logs (`claude-output.log`) or inspect the JSONL event stream manually to know what actually happened. The "wake" mechanism is decorative, not functional.

The JSONL event stream (`/tmp/openclaw-task-events/events.jsonl`) is the real source of truth and is already reliable. The gap is that no consumer can query it without being co-located with the file and knowing its path.

---

## Viability Assessment

**Can MCP improve the completion/status delivery loop for Claude-driven tasks?**

**Yes, specifically for the query/pull side. No, as a replacement for push.**

MCP tools give any Claude agent session a structured, queryable interface to task state. Because the underlying store is the durable JSONL file (not an in-memory MCP server state), the data survives server restarts and session disconnects. This inverts the dependency: instead of the launcher trying to reach the agent, the agent can reliably fetch state whenever it needs it.

What MCP does not fix: real-time push delivery. MCP is request/response by default. SSE transport exists but adds process management complexity. The existing `openclaw agent --message` push hint is still the right wake mechanism — it just needs to be non-critical, with the MCP query as the reliable fallback.

**Verdict:** MCP is viable as the pull/query layer. Keep the push as a best-effort hint. Do not invert this.

---

## Architecture

### Current flow (broken for push)

```
Launcher ──writes──> JSONL
Launcher ──fires──> openclaw agent --message (best-effort, often lost)
Agent ──manual──> grep logs / read JSONL directly
```

### Target flow

```
Launcher ──writes──> JSONL (unchanged)
Launcher ──fires──> openclaw agent --message (best-effort hint, non-critical)
                                    │
                          [agent wakes or polls]
                                    │
Agent ──calls──> MCP task_state tool
MCP server ──reads──> JSONL
MCP server ──returns──> structured task state
Agent acts on state
```

### Components

| Component                               | Role                            | Owner          |
| --------------------------------------- | ------------------------------- | -------------- |
| `scripts/task-events.ts`                | Append + read JSONL events      | Exists         |
| `scripts/claude-run-repo-task.sh`       | Emits events, sends push hint   | Exists         |
| **`scripts/task-events-mcp-server.ts`** | MCP server wrapping JSONL reads | **New**        |
| OpenClaw MCP config                     | Registers MCP server with agent | **New config** |

The MCP server is a thin adapter. It contains no business logic and no state of its own — it delegates all reads to the existing `readTaskEvents` function.

### MCP server tools (proposed)

#### `task_state`

Returns the projected current state for a task or repo.

Input:

```json
{ "taskId": "task_..." }
// or
{ "repo": "lettingsops-api" }
```

Output:

```json
{
  "taskId": "task_...",
  "state": "review_ready",
  "latestEvent": { ...TaskEvent },
  "eventCount": 4
}
```

#### `task_events_recent`

Returns last N events, optionally filtered.

Input:

```json
{ "repo": "lettingsops-api", "limit": 10 }
// or
{ "taskId": "task_...", "limit": 20 }
```

Output: array of `TaskEvent` objects.

---

## State Model

### States

| State           | Meaning                                                | Terminal? |
| --------------- | ------------------------------------------------------ | --------- |
| `running`       | Task started, no terminal event yet                    | No        |
| `completed`     | Claude exited 0, outcome unclassified                  | Yes       |
| `review_ready`  | Push + PR detected in output                           | Yes       |
| `no_changes`    | Claude ran clean with no keeper output                 | Yes       |
| `failed`        | Claude exited non-zero or launcher failed              | Yes       |
| `blocked`       | Claude reported it cannot proceed (human needed)       | Yes       |
| `checks_failed` | Repo quality checks failed during the run              | Yes       |
| `checks_passed` | Checks passed (intermediate, may precede review_ready) | No        |

### Event → State Projection

```
task.started        → running
task.checks_passed  → checks_passed  (does not override running; co-exists)
task.checks_failed  → checks_failed
task.completed      → completed
task.review_ready   → review_ready
task.no_changes     → no_changes
task.blocked        → blocked
task.failed         → failed
```

**Projection rule:** Latest terminal event wins. If both `task.completed` and `task.review_ready` are in the stream (as they are today — the launcher emits both), `task.review_ready` is the correct final state because it's emitted later.

### State machine

```
         [setup ok]
            │
         started (running)
            │
   ┌────────┼──────────────┬──────────┐
   │        │              │          │
blocked  failed    checks_failed   checks_passed
                               │
                         completed
                               │
                  ┌────────────┴──────────┐
             review_ready           no_changes
```

`blocked`, `checks_failed`, `failed` are all terminal. A later `task.unblocked` event (deferred) could transition out of `blocked`, but that is not in scope here.

### New event types (extending v1)

These extend `internal-task-events-v1.md` without altering existing semantics:

#### `task.blocked`

Emit when Claude's output contains explicit signals that it cannot proceed without human input. Conservative heuristic: phrases like `"blocked"`, `"cannot proceed"`, `"requires human decision"`, `"stop and report back"` combined with no subsequent push evidence.

#### `task.checks_failed`

Emit when the launcher detects that repo quality checks ran and produced non-zero output. Signal: Claude mentions `bun run test`, `typecheck`, `lint`, or `build` failing in output.

#### `task.checks_passed`

Emit when checks pass cleanly before PR creation. Signal: Claude mentions passing all checks. Non-terminal.

---

## Failure Modes

### 1. `openclaw` CLI not available

**Current:** Silent skip. Notification lost.
**With MCP:** Non-critical. Agent queries MCP on its next wakeup. No data loss.
**Residual risk:** Agent never wakes. Mitigated by periodic polling or cron check.

### 2. Main agent session dead when push fires

**Current:** Push message lost.
**With MCP:** Non-critical. State is in JSONL. Agent reads it when next active.
**Residual risk:** None, assuming MCP server is available on next agent session.

### 3. MCP server not running

**Current:** N/A.
**With MCP:** Agent tools fail. No state accessible via MCP.
**Mitigation:** MCP server is a fast-start Bun process; restart is cheap. JSONL remains as manual fallback.

### 4. MCP server restart / reconnect

MCP connections are session-scoped. If the server restarts, active Claude sessions lose the connection and must reconnect.
**Mitigation:** Because the server holds no state (reads JSONL on every call), reconnect is safe — no data is lost. The agent re-registers the MCP server and retries.

### 5. JSONL file corrupted or missing

The event stream is lost.
**Mitigation:** Log artifacts at `/tmp/openclaw-claude-runs/<repo>/logs/<ts>/` remain. These contain raw `claude-output.log` and `meta.env` for manual recovery. Do not delete log dirs before JSONL is confirmed intact.

### 6. False `task.review_ready`

The current heuristic (regex for push + PR signals in output) can fire when Claude describes what it _would_ do rather than what it _did_.
**Mitigation:** This is a known soft signal. No change proposed here. A future lane can verify via `gh pr view` as a hard check.

### 7. MCP in-memory queue / event replay

MCP has no built-in replay. If the agent missed events while disconnected, it cannot subscribe retroactively.
**Mitigation:** JSONL is append-only and complete. The `task_events_recent` tool returns the full history on demand. The agent should always query by `taskId` or `repo`, not rely on event streaming.

---

## Rollout Plan

### Phase 1 — Prototype (smallest slice)

Goal: prove the pull query path works.

- Write `scripts/task-events-mcp-server.ts` (~100 lines)
- Expose `task_state` and `task_events_recent` tools
- Test manually: run a task, connect a Claude session to the MCP server, query state
- No changes to launcher, no changes to JSONL format

**Pass criteria:** Claude agent can call `task_state` and receive accurate state for a completed run.
**Kill criteria:** MCP server overhead, reconnect complexity, or OpenClaw MCP registration proves too brittle to be worth it.

### Phase 2 — Integration

Goal: make the push hint non-critical.

- Register MCP server in OpenClaw agent config
- Update `notify_openclaw` in the launcher to log when push is skipped rather than silently returning 0
- Add `--dry-run` or `--no-notify` flag for testing without side effects

### Phase 3 — Extended states

Goal: emit `blocked`, `checks_failed`, `checks_passed`.

- Add heuristic detection to launcher for these states
- Update `task-events-state.ts` projection logic
- Update `task-events-mcp-server.ts` to reflect new states

### Phase 4 — Hard verification (optional)

Goal: replace heuristic `task.review_ready` with verified PR existence.

- After push+PR signal detected, run `gh pr view` to confirm
- Emit `task.review_ready` only on confirmed PR
- Emit `task.completed` if signal is there but PR does not exist

---

## Prototype Recommendation

**Build this first:** `scripts/task-events-mcp-server.ts`

Exact scope:

- Bun/TypeScript MCP server using the MCP SDK
- Two tools: `task_state` (by taskId or repo) and `task_events_recent` (by repo or taskId, limit param)
- Delegates all reads to the existing `readTaskEvents` function from `task-events.ts`
- No write operations exposed via MCP — the server is read-only
- Start command: `bun scripts/task-events-mcp-server.ts`
- Config for OpenClaw MCP registration: stdio transport

**How to test it:**

1. Run a repo task via `claude-run-repo-task.sh` to completion
2. Start the MCP server in a terminal
3. Open a new Claude session with the MCP server registered
4. Call `task_state` with the taskId from `meta.env`
5. Verify the returned state matches what the JSONL shows

**Total implementation estimate:** ~100–150 lines. Should take under 2 hours to implement and verify.

**What this proves:**

- MCP server can read the JSONL reliably
- Claude agents can query task state without manual log inspection
- The push hint can fail without data loss

**What this does not prove:**

- Real-time streaming (not the goal)
- Multi-machine event aggregation
- Correctness of `blocked` / `checks_failed` heuristics (those come in Phase 3)

---

## What Stays the Same

- JSONL as ground truth — no change
- Launcher event emission logic — no change
- `task-events.ts`, `task-events-state.ts`, `task-events-show.ts` — no change
- Claude task execution — MCP relay has no effect on how Claude runs tasks
- Push notification — stays best-effort, no retry added

The MCP server is additive. It can be removed without affecting any existing functionality.
