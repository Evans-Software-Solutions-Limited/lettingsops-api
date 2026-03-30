# Internal Task Events v1

**Date:** 2026-03-25  
**Status:** Active local-first implementation spec

## Purpose

Create one boring, reusable event model for internal task runs so we stop guessing from raw logs.

This is **not** a full message bus.
It is a local-first, append-only event stream for:

- Claude CLI repo runs
- future research/background runs
- future cron/automation work
- later Axel SaaS productisation

Claude is the first producer, not the only intended producer.

---

## Design Principles

- **Append-only**: events are never rewritten in place
- **Inspectable**: plain JSONL, readable with `cat`, `jq`, `rg`
- **Honest**: only emit states we can support with evidence
- **Local first**: no daemon, no DB, no queue required for v1
- **Reusable contract**: storage can change later without changing event semantics

---

## Storage Layout

### Global event stream

```text
/tmp/openclaw-task-events/events.jsonl
```

Each line is one JSON event object.

### Optional per-task artifact directories

Claude launcher already writes run artifacts under:

```text
/tmp/openclaw-claude-runs/<repo>/logs/<timestamp>-<branch>/
```

Event payloads may reference those artifact paths, but the event stream is the source of truth for lifecycle state.

---

## Event Envelope

Every event must include:

```json
{
  "eventId": "evt_...",
  "eventType": "task.started",
  "taskId": "task_...",
  "timestamp": "2026-03-25T14:30:00.000Z",
  "source": "claude-cli",
  "status": "started",
  "repo": "/path/to/repo",
  "repoName": "repo-name",
  "branch": "feat/example",
  "base": "main",
  "logDir": "/tmp/openclaw-claude-runs/...",
  "worktree": "/tmp/openclaw-claude-runs/...",
  "payload": {}
}
```

### Required fields

- `eventId`: unique event identifier
- `eventType`: lifecycle event name
- `taskId`: stable identifier for the whole task run
- `timestamp`: ISO-8601 UTC timestamp
- `source`: producer id, e.g. `claude-cli`
- `status`: normalized status aligned to the event
- `repo`: absolute repo path when applicable
- `repoName`: repo basename when applicable
- `branch`: task branch when applicable
- `base`: base branch/ref when applicable
- `payload`: event-specific detail object

### Optional common fields

- `taskSummary`
- `promptPath`
- `finalPromptPath`
- `outputPath`
- `exitCode`
- `durationMs`
- `prUrl`
- `prNumber`
- `checks`
- `artifacts`
- `error`

---

## v1 Event Types

### `task.started`

Emit when:

- setup succeeded
- worktree exists
- branch created
- task run is genuinely starting

Do **not** emit this before setup succeeds.

### `task.completed`

Emit when:

- the producer finished cleanly
- no higher-confidence terminal failure occurred

This means the task run ended, **not** that it is automatically review-ready.

### `task.failed`

Emit when:

- setup fails after task identity is known, or
- the producer exits non-zero, or
- a terminal launcher failure occurs after task creation

Payload should include the best available error summary and exit code if known.

### `task.review_ready`

Emit only when we have evidence that the run likely reached review state.

For Claude launcher v1, require:

- a pushed signal in final output, and
- a PR number or PR URL in final output

If those signals are missing, emit only `task.completed`.

This is deliberately conservative.

### `task.no_changes`

Emit when:

- the producer finished cleanly, and
- it explicitly reports that no keeper code/doc changes were needed

This is different from failure and different from a meaningful keeper output.

For Claude launcher v1, this can be inferred conservatively from phrases like:

- `No changes were made`
- `no code or doc changes`
- `nothing to review`

When that signal is present, emit `task.no_changes` after `task.completed`.

---

## Deferred Event Types

These are intentionally deferred until we have real demand:

- `task.progress`
- `task.blocked`
- `task.needs_human`
- `task.artifact.created`
- `task.pr.updated`

They are part of the intended longer-term model, but not needed for the smallest useful local-first slice.

---

## Status Mapping

| Event Type          | Status         |
| ------------------- | -------------- |
| `task.started`      | `started`      |
| `task.completed`    | `completed`    |
| `task.failed`       | `failed`       |
| `task.review_ready` | `review_ready` |
| `task.no_changes`   | `no_changes`   |

---

## Claude CLI Producer Rules (v1)

The existing launcher should enrich each task with:

- generated `taskId`
- repo metadata
- prompt/log paths
- timestamps
- final Claude exit code

### Review-ready heuristic

Because Claude currently reports completion in text, `task.review_ready` is heuristic.

Emit it only if the final output contains both:

- evidence of push, e.g. `pushed`, `branch was pushed`, `git push`, and
- evidence of PR creation/update, e.g. `PR #123`, `pull request`, GitHub PR URL

This remains a soft signal until we add direct git/GitHub verification.

---

## Why JSONL First

JSONL gives us:

- append-friendly writes
- manual inspectability
- replayability
- easy migration to SQLite/Postgres/event bus later

If we outgrow it, we migrate storage, not the event contract.

---

## Immediate Local Consumer Use Cases

- show the latest task state by `taskId`
- show recent events for a repo
- answer: did it start, did it finish, did it fail, is it plausibly review-ready?
- stop reading raw logs first for every run

---

## Non-Goals for v1

- real-time streaming UI
- retries/orchestration
- multi-producer coordination
- full PR/GitHub truth reconciliation
- database-backed task state
- task dependency graphs

Those can come later if this local-first pattern proves useful.
