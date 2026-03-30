#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  claude-run-repo-task.sh --repo <path> --branch <branch> [--base <base-ref>] (--task <text> | --task-file <file>)

What it does:
  - fetches the latest base ref from origin
  - creates a fresh git worktree for the task
  - creates a new branch from the base ref
  - runs Claude Code CLI directly in that worktree
  - saves prompt + output logs for review

Options:
  --repo <path>       Repo root
  --branch <name>     New branch name (must not already exist)
  --base <ref>        Base ref to branch from (default: main)
  --task <text>       Short task prompt
  --task-file <file>  File containing the task prompt
  --keep-worktree     Do not auto-delete the worktree path after completion
  --help              Show this help

Notes:
  - Keep prompts short. Repo memory should live in CLAUDE.md / local CLAUDE.md / .claude/skills.
  - This script launches Claude Code directly. No ACPX, no sessions_spawn.
EOF
}

REPO=""
BRANCH=""
BASE="main"
TASK=""
TASK_FILE=""
KEEP_WORKTREE=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --repo)
      REPO="$2"
      shift 2
      ;;
    --branch)
      BRANCH="$2"
      shift 2
      ;;
    --base)
      BASE="$2"
      shift 2
      ;;
    --task)
      TASK="$2"
      shift 2
      ;;
    --task-file)
      TASK_FILE="$2"
      shift 2
      ;;
    --keep-worktree)
      KEEP_WORKTREE=1
      shift
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

if [[ -z "$REPO" || -z "$BRANCH" ]]; then
  echo "--repo and --branch are required" >&2
  usage >&2
  exit 1
fi

if [[ -n "$TASK" && -n "$TASK_FILE" ]]; then
  echo "Use either --task or --task-file, not both" >&2
  exit 1
fi

if [[ -z "$TASK" && -z "$TASK_FILE" ]]; then
  echo "Provide --task or --task-file" >&2
  exit 1
fi

if [[ ! -d "$REPO/.git" && ! -f "$REPO/.git" ]]; then
  echo "Repo path does not look like a git repo: $REPO" >&2
  exit 1
fi

if ! command -v claude >/dev/null 2>&1; then
  echo "Claude CLI not found in PATH" >&2
  exit 1
fi

if ! command -v bun >/dev/null 2>&1; then
  echo "bun is required but not found in PATH" >&2
  exit 1
fi

REPO_NAME="$(basename "$REPO")"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
RUN_ROOT="/tmp/openclaw-claude-runs/$REPO_NAME"
WORKTREE="$RUN_ROOT/worktrees/${STAMP}-${BRANCH}"
LOG_DIR="$RUN_ROOT/logs/${STAMP}-${BRANCH}"
PROMPT_PATH="$LOG_DIR/prompt.md"
FINAL_PROMPT_PATH="$LOG_DIR/prompt.final.md"
OUTPUT_PATH="$LOG_DIR/claude-output.log"
META_PATH="$LOG_DIR/meta.env"
TASK_EVENTS_SCRIPT="/home/ubuntu/.openclaw/workspace/scripts/task-events.ts"
TASK_ID=""
START_EPOCH_MS=""

mkdir -p "$WORKTREE" "$LOG_DIR"

cleanup() {
  if [[ $KEEP_WORKTREE -eq 0 && -d "$WORKTREE" ]]; then
    git -C "$REPO" worktree remove "$WORKTREE" --force >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

if [[ -n "$TASK_FILE" ]]; then
  cp "$TASK_FILE" "$PROMPT_PATH"
else
  printf '%s\n' "$TASK" > "$PROMPT_PATH"
fi

TASK_ID="$(bun "$TASK_EVENTS_SCRIPT" new-task-id)"

write_payload_file() {
  local json="$1"
  local file
  file=$(mktemp)
  printf '%s' "$json" > "$file"
  echo "$file"
}

emit_task_event() {
  local event_type="$1"
  local status="$2"
  local payload_file="$3"
  local exit_code="${4:-}"
  local duration_ms="${5:-}"
  local pr_url="${6:-}"
  local pr_number="${7:-}"
  local error_text="${8:-}"
  local task_summary
  task_summary=$(python3 -c 'import sys; text=open(sys.argv[1], "r", encoding="utf-8", errors="ignore").read().replace("\n", " "); print(text[:300])' "$PROMPT_PATH")

  local cmd=(bun "$TASK_EVENTS_SCRIPT" emit-fields
    --eventType "$event_type"
    --taskId "$TASK_ID"
    --source "claude-cli"
    --status "$status"
    --repo "$REPO"
    --repoName "$REPO_NAME"
    --branch "$BRANCH"
    --base "$BASE"
    --logDir "$LOG_DIR"
    --worktree "$WORKTREE"
    --promptPath "$PROMPT_PATH"
    --finalPromptPath "$FINAL_PROMPT_PATH"
    --outputPath "$OUTPUT_PATH"
    --taskSummary "$task_summary"
    --payloadFile "$payload_file")

  if [[ -n "$exit_code" ]]; then
    cmd+=(--exitCode "$exit_code")
  fi
  if [[ -n "$duration_ms" ]]; then
    cmd+=(--durationMs "$duration_ms")
  fi
  if [[ -n "$pr_url" ]]; then
    cmd+=(--prUrl "$pr_url")
  fi
  if [[ -n "$pr_number" ]]; then
    cmd+=(--prNumber "$pr_number")
  fi
  if [[ -n "$error_text" ]]; then
    cmd+=(--error "$error_text")
  fi

  "${cmd[@]}" >/dev/null
}

notify_openclaw() {
  local state="$1"
  local pr_url="${2:-}"

  if ! command -v openclaw >/dev/null 2>&1; then
    echo "==> [notify] openclaw not found — skipping completion notification"
    return 0
  fi

  local msg="ACTION REQUIRED: Claude run state changed for $REPO_NAME / $BRANCH — $state"
  if [[ -n "$pr_url" ]]; then
    msg="$msg — $pr_url"
  fi

  openclaw agent --agent main --message "$msg" >/dev/null 2>&1 || true
  echo "==> [notify] OpenClaw wake sent ($state)"
}

cat > "$FINAL_PROMPT_PATH" <<EOF
$(cat "$PROMPT_PATH")

---
Standard completion rules for this run:
- Work only on branch: $BRANCH
- Never push to main
- Never merge your own PR
- Before claiming completion, run the repo quality checks required by its own docs/CLAUDE.md
- If you make code or doc changes that should be kept: commit them, push branch '$BRANCH' to origin, open or update a PR, comment '@cursor review' on the PR, and then report back
- In your final response, include: what changed, what checks ran, whether the branch was pushed, the PR link/number, and whether '@cursor review' was posted
- If the task turns out to require no code/doc changes, say that explicitly instead of opening a PR
EOF

PROMPT_CHARS=$(wc -c < "$FINAL_PROMPT_PATH" | tr -d ' ')
if [[ "$PROMPT_CHARS" -gt 8000 ]]; then
  echo "Prompt is too long after standard controls were added ($PROMPT_CHARS chars). Shrink it and move standing guidance into repo memory." >&2
  exit 1
fi

cat > "$META_PATH" <<EOF
REPO=$REPO
REPO_NAME=$REPO_NAME
BRANCH=$BRANCH
BASE=$BASE
STAMP=$STAMP
TASK_ID=$TASK_ID
WORKTREE=$WORKTREE
LOG_DIR=$LOG_DIR
PROMPT_PATH=$PROMPT_PATH
FINAL_PROMPT_PATH=$FINAL_PROMPT_PATH
OUTPUT_PATH=$OUTPUT_PATH
KEEP_WORKTREE=$KEEP_WORKTREE
EOF

echo "==> Repo: $REPO"
echo "==> Base: $BASE"
echo "==> Branch: $BRANCH"
echo "==> Task ID: $TASK_ID"
echo "==> Worktree: $WORKTREE"
echo "==> Log dir: $LOG_DIR"
echo "==> Prompt chars: $PROMPT_CHARS"
echo "==> Check state: bun /home/ubuntu/.openclaw/workspace/scripts/task-events-state.ts --task-id $TASK_ID"

git -C "$REPO" fetch origin "$BASE" --prune

if git -C "$REPO" show-ref --verify --quiet "refs/heads/$BRANCH"; then
  echo "Local branch already exists: $BRANCH" >&2
  exit 1
fi

if git -C "$REPO" ls-remote --exit-code --heads origin "$BRANCH" >/dev/null 2>&1; then
  echo "Remote branch already exists: origin/$BRANCH" >&2
  exit 1
fi

git -C "$REPO" worktree add -b "$BRANCH" "$WORKTREE" "origin/$BASE"

cd "$WORKTREE"

START_EPOCH_MS=$(python3 -c 'import time; print(int(time.time() * 1000))')
START_PAYLOAD_FILE=$(write_payload_file '{"stage":"claude-launch"}')
emit_task_event 'task.started' 'started' "$START_PAYLOAD_FILE"
rm -f "$START_PAYLOAD_FILE"

echo "==> Starting Claude..."
echo "==> Output will be tee'd to $OUTPUT_PATH"

set +e
claude --print --dangerously-skip-permissions "$(cat "$FINAL_PROMPT_PATH")" | tee "$OUTPUT_PATH"
CLAUDE_EXIT=${PIPESTATUS[0]}
set -e

END_EPOCH_MS=$(python3 -c 'import time; print(int(time.time() * 1000))')
DURATION_MS="$((END_EPOCH_MS - START_EPOCH_MS))"

if [[ $CLAUDE_EXIT -ne 0 ]]; then
  FAILED_PAYLOAD_FILE=$(write_payload_file '{"stage":"claude-finished"}')
  emit_task_event 'task.failed' 'failed' "$FAILED_PAYLOAD_FILE" "$CLAUDE_EXIT" "$DURATION_MS" '' '' 'Claude exited non-zero'
  rm -f "$FAILED_PAYLOAD_FILE"
  notify_openclaw "failed"
  echo "Claude run failed with exit code: $CLAUDE_EXIT" >&2
  exit "$CLAUDE_EXIT"
fi

COMPLETED_PAYLOAD_FILE=$(write_payload_file '{"stage":"claude-finished"}')
emit_task_event 'task.completed' 'completed' "$COMPLETED_PAYLOAD_FILE" "$CLAUDE_EXIT" "$DURATION_MS"
rm -f "$COMPLETED_PAYLOAD_FILE"

NOTIFY_STATE="completed"
NOTIFY_PR_URL=""

if rg -qi '(no changes were made|no code or doc changes|nothing to review|no further action is needed)' "$OUTPUT_PATH"; then
  NO_CHANGES_PAYLOAD_FILE=$(write_payload_file '{"signal":"no-keeper-changes-detected"}')
  emit_task_event 'task.no_changes' 'no_changes' "$NO_CHANGES_PAYLOAD_FILE" "$CLAUDE_EXIT" "$DURATION_MS"
  rm -f "$NO_CHANGES_PAYLOAD_FILE"
  NOTIFY_STATE="no_changes"
fi

if rg -qi '(branch was pushed|pushed branch|git push|pushed to origin|branch pushed)' "$OUTPUT_PATH" && \
   rg -qi '(PR #[0-9]+|pull request|https://github\.com/.*/pull/[0-9]+)' "$OUTPUT_PATH"; then
  PR_URL=$(python3 -c 'import re, sys; text=open(sys.argv[1], "r", encoding="utf-8", errors="ignore").read(); m=re.search(r"https://github\\.com/[^\\s)]+/pull/\\d+", text); print(m.group(0) if m else "")' "$OUTPUT_PATH")
  PR_NUMBER_RAW=$(python3 -c 'import re, sys; text=open(sys.argv[1], "r", encoding="utf-8", errors="ignore").read(); m=re.search(r"PR #(\\d+)", text, re.IGNORECASE) or re.search(r"/pull/(\\d+)", text); print(m.group(1) if m else "")' "$OUTPUT_PATH")
  REVIEW_PAYLOAD_FILE=$(write_payload_file '{"signal":"pushed-and-pr-detected"}')
  emit_task_event 'task.review_ready' 'review_ready' "$REVIEW_PAYLOAD_FILE" "$CLAUDE_EXIT" "$DURATION_MS" "$PR_URL" "$PR_NUMBER_RAW"
  rm -f "$REVIEW_PAYLOAD_FILE"
  NOTIFY_STATE="review_ready"
  NOTIFY_PR_URL="$PR_URL"
fi

notify_openclaw "$NOTIFY_STATE" "$NOTIFY_PR_URL"

echo "==> Claude run finished"
if [[ $KEEP_WORKTREE -eq 1 ]]; then
  echo "==> Worktree kept at: $WORKTREE"
fi
