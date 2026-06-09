#!/usr/bin/env bun
import { mkdir, appendFile, readFile } from "node:fs/promises";
import { dirname } from "node:path";

export type TaskEvent = {
  eventId: string;
  eventType: string;
  taskId: string;
  timestamp: string;
  source: string;
  status: string;
  repo?: string;
  repoName?: string;
  branch?: string;
  base?: string;
  logDir?: string;
  worktree?: string;
  taskSummary?: string;
  promptPath?: string;
  finalPromptPath?: string;
  outputPath?: string;
  exitCode?: number;
  durationMs?: number;
  prUrl?: string;
  prNumber?: number;
  checks?: string[];
  artifacts?: string[];
  error?: string;
  payload: Record<string, unknown>;
};

const DEFAULT_EVENTS_PATH = "/tmp/openclaw-task-events/events.jsonl";

function nowIso(date = new Date()): string {
  return date.toISOString();
}

function randomId(prefix: string): string {
  const stamp = nowIso().replaceAll(":", "").replaceAll(".", "-");
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${stamp}_${rand}`;
}

async function ensureFile(path: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  try {
    await readFile(path, "utf8");
  } catch {
    await appendFile(path, "", "utf8");
  }
}

export async function appendTaskEvent(
  event: Omit<TaskEvent, "eventId" | "timestamp"> &
    Partial<Pick<TaskEvent, "eventId" | "timestamp">>,
  eventsPath = DEFAULT_EVENTS_PATH,
): Promise<TaskEvent> {
  await ensureFile(eventsPath);

  const fullEvent: TaskEvent = {
    eventId: event.eventId ?? randomId("evt"),
    timestamp: event.timestamp ?? nowIso(),
    ...event,
  };

  await appendFile(eventsPath, `${JSON.stringify(fullEvent)}\n`, "utf8");
  return fullEvent;
}

export async function readTaskEvents(
  eventsPath = DEFAULT_EVENTS_PATH,
): Promise<TaskEvent[]> {
  await ensureFile(eventsPath);
  const content = await readFile(eventsPath, "utf8");
  return content
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as TaskEvent);
}

function parseFlags(args: string[]): Record<string, string> {
  const flags: Record<string, string> = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2);
    const next = args[index + 1];
    if (next === undefined || next.startsWith("--")) {
      flags[key] = "true";
      continue;
    }
    flags[key] = next;
    index += 1;
  }
  return flags;
}

function parseOptionalInt(value?: string): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

async function main(): Promise<void> {
  const rawArgs = process.argv.slice(2);
  const args = rawArgs[0]?.endsWith("task-events.ts")
    ? rawArgs.slice(1)
    : rawArgs;
  const command = args[0];

  if (command === "new-task-id") {
    console.log(randomId("task"));
    return;
  }

  if (command === "emit") {
    const raw = args[1];
    if (!raw) {
      throw new Error("Usage: task-events.ts emit '<json>'");
    }
    const event = JSON.parse(raw) as Omit<TaskEvent, "eventId" | "timestamp"> &
      Partial<Pick<TaskEvent, "eventId" | "timestamp">>;
    const written = await appendTaskEvent(event);
    console.log(JSON.stringify(written));
    return;
  }

  if (command === "emit-fields") {
    const flags = parseFlags(args.slice(1));
    if (!flags.eventType || !flags.taskId || !flags.source || !flags.status) {
      throw new Error(
        "Usage: task-events.ts emit-fields --eventType <type> --taskId <id> --source <source> --status <status> [other flags]",
      );
    }

    const payload = flags.payloadFile
      ? (JSON.parse(await readFile(flags.payloadFile, "utf8")) as Record<
          string,
          unknown
        >)
      : flags.payloadJson
        ? (JSON.parse(flags.payloadJson) as Record<string, unknown>)
        : {};
    const event: Omit<TaskEvent, "eventId" | "timestamp"> &
      Partial<Pick<TaskEvent, "eventId" | "timestamp">> = {
      eventType: flags.eventType,
      taskId: flags.taskId,
      source: flags.source,
      status: flags.status,
      repo: flags.repo,
      repoName: flags.repoName,
      branch: flags.branch,
      base: flags.base,
      logDir: flags.logDir,
      worktree: flags.worktree,
      taskSummary: flags.taskSummary,
      promptPath: flags.promptPath,
      finalPromptPath: flags.finalPromptPath,
      outputPath: flags.outputPath,
      exitCode: parseOptionalInt(flags.exitCode),
      durationMs: parseOptionalInt(flags.durationMs),
      prUrl: flags.prUrl,
      prNumber: parseOptionalInt(flags.prNumber),
      error: flags.error,
      payload,
    };

    const written = await appendTaskEvent(event);
    console.log(JSON.stringify(written));
    return;
  }

  if (command === "list") {
    const events = await readTaskEvents();
    for (const event of events) {
      console.log(JSON.stringify(event));
    }
    return;
  }

  console.error(
    [
      "Usage:",
      "  bun scripts/task-events.ts new-task-id",
      "  bun scripts/task-events.ts emit '<json>'",
      "  bun scripts/task-events.ts emit-fields --eventType <type> --taskId <id> --source <source> --status <status>",
      "  bun scripts/task-events.ts list",
    ].join("\n"),
  );
  process.exit(1);
}

if (import.meta.path === Bun.main) {
  await main();
}
