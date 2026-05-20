# Contributing to LettingsOps

This repo follows a **spec-driven, branch-per-phase** workflow. The standing rules in
[`CLAUDE.md`](./CLAUDE.md) describe code-quality standards; this file documents how work
gets organised, branched, and merged.

## 1. Branch hygiene

- **Never commit directly to `main`.** `main` is updated only by squash-merging a PR.
- **One branch per spec phase.** Branch names follow `feat/spec-{NN}-{slug}`, e.g.
  `feat/spec-01-platform-hardening`, `feat/spec-02-crm-and-booking-adapters`.
- **Fast-forward before branching.** Always `git pull --ff-only origin main` immediately
  before creating a new feature branch so the branch starts on the canonical tip.
- **Sub-branches for risky refactors.** If a phase needs more than a day of in-flight
  work, sub-branch off the phase branch (`feat/spec-01-platform-hardening/auth-plugin`)
  and PR back into the phase branch, not into `main`.
- **Archive, don't discard.** If local `main` ever diverges from `origin/main`, snapshot
  the divergent state onto an `archive/…` branch before resetting. The fast-forward done
  during Phase 1 task A1 is the reference pattern.

## 2. Spec-driven workflow

Each `.kiro/specs/{NN}-{name}/` folder is treated as the contract for a phase. Work
through the three files **in order**:

1. **`requirements.md`** — what must be true when the phase is done (user stories,
   acceptance criteria, definition of done). Don't start work until you've read it.
2. **`design.md`** — how to build it inside this codebase (interfaces, schema, hook
   points, risks). Defines the shape of the implementation.
3. **`tasks.md`** — ordered, checkbox-driven task list. Work top to bottom, one task
   block per PR. Tick `[x]` as you land each task and push the update with the work.

When all tasks in a spec are ticked and the acceptance checklist passes, mark the spec
done in [`.kiro/README.md`](./.kiro/README.md) and start the next one.

## 3. Pull request workflow

1. **Plan.** Read the next unchecked task in `tasks.md`. If it's too big to land in a
   single PR, split it into commits or sub-tasks before starting.
2. **Implement.** Follow the patterns in the root [`CLAUDE.md`](./CLAUDE.md) and the
   per-module `CLAUDE.md` files (e.g.
   [`microservices/core/src/application/webhooks/CLAUDE.md`](./microservices/core/src/application/webhooks/CLAUDE.md)).
   Thin handlers, logic in services/repositories, repository-pattern data access, no
   PII in logs.
3. **Pre-merge gate.** Run all five locally before opening the PR:
   ```bash
   bun run prettier:check && bun run typecheck && bun run lint && bun run build && bun run test:unit
   ```
   All five must pass; coverage must stay at or above 90% on
   `src/application/**/*.ts` and `src/**/repositories/*.ts`.
4. **PR.** Open against `main` with a Conventional Commit title (see §4). Reference the
   spec and the task IDs the PR closes in the description.
5. **PR environment.** Add the `ready-for-test` label to spin up a `pr-{number}` SST
   stage via `pr-environment.yml`.
6. **Tick tasks.** Update `.kiro/specs/{NN}-{name}/tasks.md` to mark `[x]` for every
   task the PR lands. Commit and push the update on the same branch.
7. **Merge.** Squash-merge only. The squashed commit message must follow Conventional
   Commits so Release Please picks it up.

## 4. Commit message format

We use [Conventional Commits](https://www.conventionalcommits.org/) so
[Release Please](./release-please-config.json) can build the changelog and version
bumps automatically. The sections recognised by our config:

| Prefix   | Appears in CHANGELOG |
| -------- | -------------------- |
| `feat:`  | Features             |
| `fix:`   | Bug Fixes            |
| `perf:`  | Performance          |
| `chore:` | Hidden (no entry)    |
| `ci:`    | Hidden (no entry)    |

Examples:

- `feat(auth): add Elysia auth plugin with JWT + API-key paths (closes A-D3)`
- `fix(webhooks): drop duplicate ElevenLabs events by call_id (closes A-D5)`
- `chore(deps): bump @neondatabase/serverless to 1.4.0`

Squash-merge commit messages are taken from the PR title by default
(`squash_merge_commit_title: COMMIT_OR_PR_TITLE`), so keep the PR title in the same
format. Body of the squashed commit comes from the bullet list of constituent
commits (`squash_merge_commit_message: COMMIT_MESSAGES`).

## 5. When to stop and ask

Self-manage almost everything in the specs. Stop and ping the maintainer (Bradley) when:

- A decision is needed that isn't pre-made in the spec.
- An acceptance criterion would need to be relaxed — flag it, don't quietly redefine
  done.
- You hit a real risk: anything that could leak tenant data, blow a quota, or
  compromise the deploy gate.
- A phase finishes. Brief the result and confirm before starting the next phase.

## 6. Things explicitly out of scope (until the right phase)

These are non-goals until the spec that introduces them lands. If you find yourself
wanting to do any of them, note it in a "Phase 5+ candidates" file rather than
mixing it into the current phase's PRs.

- A second CRM adapter (defer until the client confirms which CRM — Phase 2 ships
  one reference implementation only).
- Mid-call voice function-calling (Phase 3 is post-call only).
- Multi-language support (UK English only for now).
- A second tenant (Phase 4 onboards the first).
- Frontend features beyond what the specs require.
