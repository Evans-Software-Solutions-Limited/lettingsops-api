#!/usr/bin/env bun
import { readTaskEvents, type TaskEvent } from "./task-events";

function usage(): never {
  console.error(
    [
      "Usage:",
      "  bun scripts/task-events-show.ts [--task-id <id>] [--repo <path-or-name>] [--limit <n>]",
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

const rawArgs = process.argv.slice(2);
const args = rawArgs[0]?.endsWith("task-events-show.ts")
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

let events = await readTaskEvents();

if (taskId) {
  events = events.filter((event) => event.taskId === taskId);
}

if (repo) {
  events = events.filter((event) => matchesRepo(event, repo));
}

const selected = events.slice(-limit);
for (const event of selected) {
  console.log(JSON.stringify(event));
}
