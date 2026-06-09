#!/usr/bin/env bun
/**
 * task-events-mcp-server: read-only stdio MCP server over the local task event stream.
 *
 * Tools:
 *   task_state         – current state for a task or all tasks for a repo
 *   task_events_recent – raw recent events, optionally filtered
 *
 * Transport: stdio (connect via `bun scripts/task-events-mcp-server.ts`)
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { readTaskEvents, type TaskEvent } from "./task-events";

// ---------------------------------------------------------------------------
// Projection helpers – mirror task-events-state.ts logic exactly
// ---------------------------------------------------------------------------

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

function matchesRepo(event: TaskEvent, query: string): boolean {
  return (
    event.repo === query ||
    event.repoName === query ||
    event.repo?.includes(query) === true
  );
}

// ---------------------------------------------------------------------------
// Server
// ---------------------------------------------------------------------------

const server = new Server(
  { name: "task-events", version: "1.0.0" },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "task_state",
      description:
        "Get the projected state of one task (by taskId) or all tasks matching a repo. " +
        "Returns taskId, eventCount, state, and latestEvent for each task.",
      inputSchema: {
        type: "object" as const,
        properties: {
          taskId: {
            type: "string",
            description: "Task ID to query. Returns a single task summary.",
          },
          repo: {
            type: "string",
            description:
              "Repo path or name to filter by. Returns summaries for all matching tasks.",
          },
          limit: {
            type: "number",
            description:
              "Max tasks to return when querying by repo (default 20).",
          },
        },
      },
    },
    {
      name: "task_events_recent",
      description:
        "Return recent raw task events from the event stream. " +
        "Results are chronologically ordered (oldest first), sliced to the tail.",
      inputSchema: {
        type: "object" as const,
        properties: {
          taskId: {
            type: "string",
            description: "Filter events to this task ID.",
          },
          repo: {
            type: "string",
            description: "Filter events to this repo path or name.",
          },
          limit: {
            type: "number",
            description: "Max events to return (default 50).",
          },
        },
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args = {} } = request.params;
  const toolArgs = args as { taskId?: string; repo?: string; limit?: number };

  // ------------------------------------------------------------------
  // task_state
  // ------------------------------------------------------------------
  if (name === "task_state") {
    const { taskId, repo, limit = 20 } = toolArgs;
    const events = await readTaskEvents();

    if (taskId) {
      const taskEvents = events.filter((e) => e.taskId === taskId);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                taskId,
                eventCount: taskEvents.length,
                state: projectState(taskEvents),
                latestEvent: taskEvents[taskEvents.length - 1] ?? null,
              },
              null,
              2,
            ),
          },
        ],
      };
    }

    const byTask = new Map<string, TaskEvent[]>();
    for (const event of events) {
      if (repo && !matchesRepo(event, repo)) continue;
      const current = byTask.get(event.taskId) ?? [];
      current.push(event);
      byTask.set(event.taskId, current);
    }

    const summaries = Array.from(byTask.entries())
      .map(([tid, taskEvents]) => ({
        taskId: tid,
        eventCount: taskEvents.length,
        state: projectState(taskEvents),
        latestEvent: taskEvents[taskEvents.length - 1] ?? null,
      }))
      .sort((a, b) =>
        (a.latestEvent?.timestamp ?? "").localeCompare(
          b.latestEvent?.timestamp ?? "",
        ),
      )
      .slice(-limit);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(summaries, null, 2),
        },
      ],
    };
  }

  // ------------------------------------------------------------------
  // task_events_recent
  // ------------------------------------------------------------------
  if (name === "task_events_recent") {
    const { taskId, repo, limit = 50 } = toolArgs;
    let events = await readTaskEvents();
    if (taskId) events = events.filter((e) => e.taskId === taskId);
    if (repo) events = events.filter((e) => matchesRepo(e, repo));
    events = events.slice(-limit);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(events, null, 2),
        },
      ],
    };
  }

  throw new Error(`Unknown tool: ${name}`);
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

const transport = new StdioServerTransport();
await server.connect(transport);
