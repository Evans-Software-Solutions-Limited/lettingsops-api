#!/usr/bin/env bun
import { readTaskEvents, type TaskEvent } from "./task-events";

function usage(): never {
  console.error(
    [
      "Usage:",
      "  bun scripts/task-events-state.ts --task-id <id>",
      "  bun scripts/task-events-state.ts --repo <path-or-name> [--limit <n>]",
    ].join("\n"),
  );
  process.exit(1);
}

function matchesRepo(event: TaskEvent, query: string): boolean {
  return (
    event.repo === query ||
    event.repoName === query ||
    event.repo?.includes(query) === true
  );
}

function projectState(events: TaskEvent[]): string {
  if (events.length === 0) return "unknown";
  const latest = events[events.length - 1];
  switch (latest.eventType) {
    case "task.review_ready":
      return "review_ready";
    case "task.no_changes":
      return "no_changes";
    case "task.failed":
      return "failed";
    case "task.completed":
      return "completed";
    case "task.started":
      return "running";
    default:
      return latest.status || "unknown";
  }
}

const rawArgs = process.argv.slice(2);
const args = rawArgs[0]?.endsWith("task-events-state.ts")
  ? rawArgs.slice(1)
  : rawArgs;
let taskId = "";
let repo = "";
let limit = 20;

for (let index = 0; index < args.length; index += 1) {
  const arg = args[index];
  if (arg === "--task-id") {
    taskId = args[++index] ?? usage();
    continue;
  }
  if (arg === "--repo") {
    repo = args[++index] ?? usage();
    continue;
  }
  if (arg === "--limit") {
    limit = Number(args[++index] ?? usage());
    continue;
  }
  usage();
}

if (!taskId && !repo) {
  usage();
}

let events = await readTaskEvents();
if (taskId) {
  events = events.filter((event) => event.taskId === taskId);
  console.log(
    JSON.stringify({
      taskId,
      eventCount: events.length,
      state: projectState(events),
      latestEvent: events[events.length - 1] ?? null,
    }),
  );
  process.exit(0);
}

const byTask = new Map<string, TaskEvent[]>();
for (const event of events) {
  if (!matchesRepo(event, repo)) continue;
  const current = byTask.get(event.taskId) ?? [];
  current.push(event);
  byTask.set(event.taskId, current);
}

const summaries = Array.from(byTask.entries())
  .map(([currentTaskId, taskEvents]) => ({
    taskId: currentTaskId,
    eventCount: taskEvents.length,
    state: projectState(taskEvents),
    latestEvent: taskEvents[taskEvents.length - 1],
  }))
  .sort((a, b) =>
    (a.latestEvent?.timestamp ?? "").localeCompare(
      b.latestEvent?.timestamp ?? "",
    ),
  )
  .slice(-limit);

for (const summary of summaries) {
  console.log(JSON.stringify(summary));
}
