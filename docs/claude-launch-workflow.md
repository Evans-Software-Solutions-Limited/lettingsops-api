# Claude Launch Workflow

Purpose: make repo implementation runs boring, repeatable, and visible.

## Default Rule

For repo work on webchat, use **direct Claude Code CLI only**.

Do **not** use:

- ACPX
- `sessions_spawn`
- long adapter-driven coding sessions

Reason: the CLI works; the adapter path is where we kept getting stuck, silent, or messy.

## Workflow

1. Keep the prompt short
2. Fetch a fresh `main`
3. Create a unique worktree
4. Create a unique branch from `origin/main`
5. Run Claude in that worktree
6. Require completion hygiene: push branch, raise/update PR, request `@cursor review`, and report back when real changes were made
7. Log prompt + output
8. Check once early, then give it room

## Prompt Shape

Use only:

- task
- branch name
- scope / files / area
- what to report back
- acceptance checks if genuinely task-specific

Do **not** restate standing repo rules if they already live in:

- `CLAUDE.md`
- local `CLAUDE.md`
- `.claude/skills/`
- focused docs/

If the prompt is turning into a spec, the repo memory is underpowered.

## Launch Command

```bash
/home/ubuntu/.openclaw/workspace/scripts/claude-run-repo-task.sh \
  --repo /path/to/repo \
  --branch feat/example-change \
  --task "Read CLAUDE.md and any relevant local CLAUDE.md. Inspect the billing module only. Fix the null session.url guard in the checkout handler, add/adjust tests, run the repo checks, and report exactly what changed plus any blockers."
```

## Task File Variant

Use a file if the prompt is easier to review that way, but keep it short.

```bash
/home/ubuntu/.openclaw/workspace/scripts/claude-run-repo-task.sh \
  --repo /path/to/repo \
  --branch fix/example \
  --task-file /tmp/task.md
```

## Observability

Each run writes logs under:

```text
/tmp/openclaw-claude-runs/<repo>/logs/<timestamp>-<branch>/
```

Files:

- `prompt.md` — the task as launched
- `prompt.final.md` — the task plus standard completion controls
- `claude-output.log`
- `meta.env`

This gives us a stable place to inspect what was launched and what Claude returned.

## Querying Task State

The launcher emits events to `/tmp/openclaw-task-events/events.jsonl` and prints the task ID at startup. When completion is uncertain, query the event stream — not raw logs.

**By task ID** (printed at launch, also in `meta.env`):

```bash
bun /home/ubuntu/.openclaw/workspace/scripts/task-events-state.ts --task-id <TASK_ID>
```

**By repo** (recent tasks):

```bash
bun /home/ubuntu/.openclaw/workspace/scripts/task-events-state.ts --repo <repo-path-or-name>
```

**Raw events for a task** (full event trace):

```bash
bun /home/ubuntu/.openclaw/workspace/scripts/task-events-show.ts --task-id <TASK_ID>
```

**Via MCP** (when a Claude session needs to check state without reading files):

```
Connect: bun /home/ubuntu/.openclaw/workspace/scripts/task-events-mcp-server.ts
Tools:   task_state, task_events_recent
```

State values: `running` · `completed` · `review_ready` · `no_changes` · `failed` · `unknown`

## How to Interpret Silence

- If setup fails immediately: launch/plumbing problem
- If setup succeeds and Claude goes quiet: do **not** instantly call it dead
- First check: ~2 minutes — use `task-events-state.ts --task-id <id>` to confirm it started
- Second check: another ~2 minutes if still no meaningful output
- If it is still silent after clean setup, treat it as suspicious — but use the event stream, not vibes

## Branch / Worktree Rules

- one Claude run per repo at a time
- never launch from a dirty main checkout
- never branch from stale local state when `origin/main` is available
- keep branch names explicit and task-shaped
- if the run produces changes worth keeping: commit them, push the branch, open or update a PR, comment `@cursor review`, and only then call it done
- never merge the PR as part of the run unless Bradley explicitly says to
- if the run produces no keeper changes: say so explicitly instead of leaving silent local drift

## When to Stop

Stop and report back instead of piling on if:

- auth is broken
- Claude CLI itself errors before doing real work
- branch already exists and suggests state confusion
- the repo needs decisions, not implementation
- the task scope keeps expanding beyond the branch intent

## Why This Exists

The real fix is:

- less prompting
- more repo memory
- a boring reliable launch path

If we’re hand-rolling shell/worktree logic again, we’ve already drifted.
