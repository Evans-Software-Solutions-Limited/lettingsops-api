# Pre-Production and Production Deployments

This document outlines the deploy pipeline for staging and production, and what you need to configure in **GitHub** and **AWS** (including secrets and OIDC).

For the canonical secret inventory — every SST secret + every GitHub Actions secret, plus how to rotate each — see [`docs/secrets.md`](./secrets.md). This doc focuses on the deploy mechanics; `secrets.md` is the lookup table.

---

## Current State (verified 2026-06-01, Block H of spec-01)

In place:

- **PR checks** (`pr-checks.yml`) — install, detect-changes, typecheck/lint/prettier, build, unit tests with 90% coverage gate, on every PR.
- **Claude review** (`claude-review.yml`) — Inspector Brad runs on PR open/sync.
- **Release Please** (`release-please.yml`) — opens release PRs against `main`, publishes GitHub Releases on merge.
- **Staging deploy** (`staging-deploy.yml`) — triggers on push to `main` (and `workflow_dispatch`). Runs the full PR gate then `sst deploy --stage staging`. Concurrency-locked on `sst-staging`.
- **Production deploy** (`deploy-production.yml`) — triggers on `release: published` (i.e. Release Please publishing a tagged release) and `workflow_dispatch` with a `ref` input. Runs the full gate then `sst deploy --stage production`. Concurrency-locked on `sst-production`.

> **Divergence from the original spec/design language.** The spec text and the original draft of this doc used the name **"preprod"** for the non-production staging environment and `AWS_ROLE_ARN_PREPROD` for its IAM role. The implemented pipeline uses **"staging"** end-to-end — workflow file, SST stage name (`--stage staging`), AWS role secret (`AWS_ROLE_ARN_STAGING`), and the GitHub environment name. Treat "staging" and "preprod" as synonyms when reading older spec sections; the implementation is the source of truth.

> **Old draft inaccuracy:** prior versions of this doc claimed `pr-environment.yml` and `destroy-pr-env.yml` workflows existed and deployed to a `pr-{number}` stage when a `ready-for-test` label was added. They **do not exist** in the repo today. The PR-environment pattern was either descoped or never built — `AWS_ROLE_ARN_PR` is therefore an unreferenced secret as of this writing (see §1.1).

---

## 1. GitHub Configuration

### 1.1 Secrets (per environment)

Configure these in **Settings → Secrets and variables → Actions** (repository or environment). See [`docs/secrets.md`](./secrets.md) for the full inventory including SST-managed secrets.

| Secret                    | Used by                                                        | Description                                                                                                                                                                                                                                                                                                                            |
| ------------------------- | -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AWS_ROLE_ARN_STAGING`    | `staging-deploy.yml`                                           | IAM role ARN for the **staging** AWS account. Assumed via OIDC.                                                                                                                                                                                                                                                                        |
| `AWS_ROLE_ARN_PRODUCTION` | `deploy-production.yml`                                        | IAM role ARN for the **production** AWS account. Assumed via OIDC.                                                                                                                                                                                                                                                                     |
| `AWS_ROLE_ARN_PR`         | (unused — was for the removed `pr-environment.yml`)            | Reserved for if/when per-PR environments come back. Safe to leave unset.                                                                                                                                                                                                                                                               |
| `DATABASE_URL`            | both deploy workflows (the `db:push` step before `sst deploy`) | Neon serverless Postgres connection string for the target stage. Read directly by the GitHub runner so `drizzle-kit push` can apply schema changes before SST deploys the Lambda. **Separate from the SST-managed `LettingsOpsDatabaseUrl`** — the SST one is for runtime; this one is for the migration step that runs before deploy. |

**Environment-scoped secrets:** the workflows reference `secrets.AWS_ROLE_ARN_STAGING` / `secrets.AWS_ROLE_ARN_PRODUCTION` directly. The `staging-deploy.yml` deploy job declares `environment: staging` and `deploy-production.yml` declares `environment: production`, so per-environment overrides work if you scope the secret to the matching GitHub Environment.

### 1.2 Variables (optional)

| Variable     | Used by              | Description                                                                         |
| ------------ | -------------------- | ----------------------------------------------------------------------------------- |
| `AWS_REGION` | All deploy workflows | AWS region (e.g. `eu-west-2`). Workflows currently default to `eu-west-2` if unset. |

Set in **Settings → Secrets and variables → Actions → Variables** (or per-environment if you use environments).

---

## 2. AWS Configuration

You need **one AWS account (or more)** depending on how you split PR / preprod / production. For each account that GitHub Actions will deploy into:

### 2.1 OIDC identity provider (once per account)

1. In **IAM → Identity providers**, add an **OpenID Connect** provider:
   - **Provider URL**: `https://token.actions.githubusercontent.com`
   - **Audience**: `sts.amazonaws.com` (default).

2. This lets GitHub Actions request short-lived credentials without storing long-lived keys in GitHub.

### 2.2 IAM role and trust policy (per account / environment)

Create an IAM role that GitHub Actions will assume (e.g. `github-actions-pr`, `github-actions-preprod`, `github-actions-production`).

**Trust policy** (example for a **single repo** and **main** for preprod):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::<ACCOUNT_ID>:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
        },
        "StringLike": {
          "token.actions.githubusercontent.com:sub": "repo:<ORG>/<REPO>:*"
        }
      }
    }
  ]
}
```

- Replace `<ACCOUNT_ID>`, `<ORG>`, `<REPO>` with your AWS account ID and GitHub org/repo.
- For **production**, tighten `:sub` (e.g. only allow `ref:refs/heads/main` or a specific environment).
- For **PR**, you can restrict to `pull_request` or branch refs if needed.

### 2.3 Permissions (role policy)

The role needs permissions for whatever SST deploys (e.g. CloudFormation, Lambda, API Gateway, S3, CloudFront, IAM for roles used by Lambdas). Options:

- **Quick start**: Attach a broad policy (e.g. `AdministratorAccess`) for the role, then narrow later.
- **Least privilege**: Create a custom policy that only allows the resources and actions SST uses in that account.

### 2.4 Summary per environment

| Environment    | Account           | OIDC provider             | IAM role                         | GitHub secret             |
| -------------- | ----------------- | ------------------------- | -------------------------------- | ------------------------- |
| PR             | e.g. Dev / shared | Yes (if separate account) | e.g. `github-actions-pr`         | `AWS_ROLE_ARN_PR`         |
| Pre-production | Preprod account   | Yes                       | e.g. `github-actions-preprod`    | `AWS_ROLE_ARN_PREPROD`    |
| Production     | Prod account      | Yes                       | e.g. `github-actions-production` | `AWS_ROLE_ARN_PRODUCTION` |

If PR and preprod share an account, you can use one OIDC provider and one or two roles; each workflow assumes the correct role ARN from secrets.

---

## 3. Workflows to Add

### 3.1 Staging deploy (`staging-deploy.yml`)

- **Trigger:** push to `main` and `workflow_dispatch`. A guard on the `install` job skips runs whose head commit message contains `release-please` or `Release ` — this prevents the Release Please bot's release PR merge from kicking off a redundant staging deploy on top of the production deploy that's about to fire.
- **Steps:** Checkout → Setup (Bun) → Typecheck → Lint → Prettier → Build → Unit tests → Configure AWS (OIDC, `AWS_ROLE_ARN_STAGING`) → `drizzle-kit push` against `DATABASE_URL` → `sst unlock --stage staging` (best-effort) → `sst deploy --stage staging`.
- **Secrets/vars:** `AWS_ROLE_ARN_STAGING`, `DATABASE_URL`, optionally `AWS_REGION` (default `eu-west-2`).
- **Concurrency:** `sst-staging` group, no cancel-in-progress — overlapping pushes queue rather than race the SST state lock.

### 3.2 Production deploy (`deploy-production.yml`)

- **Trigger:** `release: published` (i.e. Release Please publishes a tagged GitHub Release on its release-PR merge) **and** `workflow_dispatch` with an optional `ref` input for manual re-deploys.
- **Checkout:** pins to `github.event.release.tag_name || github.event.inputs.ref || github.ref` so each run deploys the exact tag rather than current `main`.
- **Steps:** same shape as staging — full gate → AWS OIDC (`AWS_ROLE_ARN_PRODUCTION`) → `drizzle-kit push` → `sst unlock --stage production` → `sst deploy --stage production`.
- **Secrets/vars:** `AWS_ROLE_ARN_PRODUCTION`, `DATABASE_URL`, optionally `AWS_REGION`.
- **Concurrency:** `sst-production` group, no cancel-in-progress.

### 3.3 Release Please (`release-please.yml`)

In place. Opens a release PR off `main` whose merge bumps the version and publishes a tagged GitHub Release. That tag-publish event is what fires `deploy-production.yml`. The staging workflow's commit-message guard above is how those two stay out of each other's way.

---

## 4. Checklist

Use this as a running list. Pre-flight before a first deploy to a fresh AWS account:

### GitHub

- [ ] Create repository (or environment) **secrets**:
  - [ ] `AWS_ROLE_ARN_STAGING`
  - [ ] `AWS_ROLE_ARN_PRODUCTION`
  - [ ] `DATABASE_URL` (Neon connection string — per-stage if you scope to environments)
- [ ] Set every SST secret listed in [`docs/secrets.md`](./secrets.md) per stage (`bunx sst secret set <Name> <Value> --stage staging` and again `--stage production`).
- [ ] Optionally set **variable** `AWS_REGION` (default `eu-west-2`).
- [ ] Optionally create **environments** `staging` and `production` and scope the secrets above to them.
- [ ] Configure **branch protection** for `main` so that PR checks must pass before merge (see §7 — currently blocked on org plan upgrade).

### AWS (per account used by GitHub)

- [ ] Add **OIDC identity provider** for `https://token.actions.githubusercontent.com`.
- [ ] Create **IAM role** for staging: trust policy for `repo:Evans-Software-Solutions-Limited/lettingsops-api:ref:refs/heads/main`, attach SST-deploy permissions; copy ARN into `AWS_ROLE_ARN_STAGING`.
- [ ] Create **IAM role** for production: trust policy scoped to release events (or `ref:refs/tags/v*`), attach permissions; copy ARN into `AWS_ROLE_ARN_PRODUCTION`.

---

## 5. Stage Names and Accounts (reference)

`sst.config.ts` reads `input?.stage` (default `dev`) and uses it for:

- per-stage SST secret resolution
- `removal: stage === "production" ? "retain" : "remove"`
- `protect: stage === "production"` (blocks `sst remove --stage production`)
- AWS resource tag `Stage`

| Stage name   | When used                                       | Typical account    | Notes                                                                                                                              |
| ------------ | ----------------------------------------------- | ------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| `dev`        | Local `bunx sst dev` / `sst deploy` runs        | Personal / sandbox | The fallback default in `sst.config.ts`. Removable on `sst remove --stage dev`.                                                    |
| `staging`    | `staging-deploy.yml` on push to `main`          | Staging account    | Removable. Some specs and design notes call this "preprod" — the implementation uses `staging` throughout (workflow, role, stage). |
| `production` | `deploy-production.yml` on `release: published` | Production account | `removal: retain`, `protect: true`. Released only via tagged releases.                                                             |

> The `pr-{number}` per-PR stage from earlier drafts of this doc isn't deployed today (`pr-environment.yml` was never built / has been removed). Leave the `AWS_ROLE_ARN_PR` secret unset until that pipeline is reintroduced.

---

## 6. Where to Get the Role ARNs

After creating each IAM role in AWS:

1. Open **IAM → Roles** and select the role.
2. Copy the **Role ARN** (e.g. `arn:aws:iam::123456789012:role/github-actions-staging`).
3. Paste into the corresponding GitHub secret (`AWS_ROLE_ARN_STAGING` or `AWS_ROLE_ARN_PRODUCTION`).

No access keys are required when using OIDC; the workflows use `aws-actions/configure-aws-credentials@v4` with `role-to-assume`.

---

## 7. Branch Protection on `main`

`main` is the source of truth for preprod and (via Release Please) production deploys.
Direct pushes and unreviewed merges to `main` are not acceptable once real tenant
traffic is in scope. The settings below are the target state required by Phase 1
(spec `01-platform-hardening`, task **A3**).

### 7.1 Required settings

Configure via **Settings → Branches → Branch protection rules → Add rule** (or
**Settings → Rules → Rulesets → New ruleset** if classic protection is unavailable).

Apply to: `main`.

- **Require a pull request before merging:** on.
  - **Require approvals:** 1 (Bradley acts as both author and reviewer for now —
    self-approval is allowed by default on org-owned private repos).
  - **Dismiss stale approvals when new commits are pushed:** on.
- **Require status checks to pass before merging:** on.
  - **Require branches to be up to date before merging:** on.
  - **Required checks:** the jobs from `pr-checks.yml` (use the exact `name:` strings, which are what GitHub matches on):
    - `Install`
    - `Detect Changes`
    - `Typecheck, Lint & Prettier`
    - `Build`
    - `Unit Tests & Coverage (90% minimum)`
    - `Inspector Brad` (from `claude-review.yml`)
- **Require conversation resolution before merging:** on.
- **Require linear history:** on (enforces squash-merge workflow).
- **Do not allow bypassing the above settings:** on (no admin override).
- **Restrict who can push to matching branches:** restrict to GitHub Actions
  (so Release Please bot can push its release branches; humans push only via PR).
- **Allow force pushes:** off.
- **Allow deletions:** off.

Repository-level merge settings (**Settings → General → Pull Requests**) — confirm
these are already correct (verified 2026-05-19 via `gh api repos/.../`):

- `allow_squash_merge: true` — squash is the merge strategy of record.
- `allow_merge_commit: false` — disable merge commits to enforce linear history.
- `allow_rebase_merge: false` — disable rebase-merge for the same reason.
- `delete_branch_on_merge: true` — branches are deleted after squash-merge. ✓ already on.
- `squash_merge_commit_title: COMMIT_OR_PR_TITLE` and
  `squash_merge_commit_message: COMMIT_MESSAGES` — keeps Conventional Commit titles
  intact for Release Please. ✓ already set.

### 7.2 Current status (2026-05-19)

**Branch protection is NOT currently enabled.** Verified via:

```bash
$ gh api repos/Evans-Software-Solutions-Limited/lettingsops-api/branches/main/protection
{"message":"Upgrade to GitHub Pro or make this repository public to enable this
feature.","status":"403"}

$ gh api repos/Evans-Software-Solutions-Limited/lettingsops-api/rulesets
{"message":"Upgrade to GitHub Pro or make this repository public to enable this
feature.","status":"403"}
```

The `Evans-Software-Solutions-Limited` org's current plan does not unlock branch
protection or rulesets for private repos. **Resolving this requires one of:**

1. Upgrade the org from GitHub Free to **GitHub Team** (cheapest path; unlocks
   classic branch protection and rulesets on private repos). Recommended.
2. Switch the repo `visibility: private → public`. Unlocks the feature on the free
   tier but exposes source code — not appropriate here.
3. Ship without enforcement until the upgrade lands. Mitigations in the interim:
   - Manual discipline: never push to `main`; always PR + self-review.
   - PR checks (`pr-checks.yml`) still run on every PR even without enforcement —
     they just can't be made _required_. A merge with red checks is possible but
     visible.
   - The `release-please` workflow only opens release PRs from `main`'s history, so
     accidental direct pushes to `main` are at least visible in the release diff.

### 7.3 Action items

- [ ] Upgrade `Evans-Software-Solutions-Limited` org to GitHub Team (or accept the
      interim risk and revisit before go-live in Phase 4).
- [ ] After upgrade, apply the §7.1 ruleset and re-run the verification command —
      the response should switch from `403` to a JSON object describing the protection.
- [ ] Update this section's "Current status" once enforced.
