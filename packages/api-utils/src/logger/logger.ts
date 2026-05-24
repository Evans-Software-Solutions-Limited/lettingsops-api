/**
 * Structured logger.
 *
 * Emits one JSON object per log line to stdout (CloudWatch picks it up
 * line-delimited). Each line carries `level`, `time`, `msg`, the fields from
 * the active request context (if any), and any additional fields the call site
 * passed. All values flow through the PII scrub first.
 *
 * Why a tiny in-house module and not pino/winston: the surface we need is
 * three functions, and we want explicit control over the scrub rules. Pulling
 * a logger library would just add a dependency without removing code.
 */
import { scrub } from "./scrub";
import { getRequestContext } from "./requestContext";

export type LogLevel = "info" | "warn" | "error";

export interface LogContext {
  requestId?: string;
  agencyId?: string;
  estateAgentId?: string;
  callId?: string;
  messageId?: string;
  [key: string]: unknown;
}

interface LogLine extends Record<string, unknown> {
  level: LogLevel;
  time: string;
  msg: string;
}

function emit(level: LogLevel, msg: string, ctx?: LogContext): void {
  const merged: LogContext = {
    ...(getRequestContext() ?? {}),
    ...(ctx ?? {}),
  };

  // Reserved fields go AFTER the spread so caller- and request-context-supplied
  // keys cannot rewrite them. `LogContext` is open (`[key: string]: unknown`),
  // and a stray `{ level: "DEBUG" }` planted via `updateRequestContext` or
  // passed at the call site would otherwise silently misclassify the stream
  // and break CloudWatch `level=error` queries.
  const line: LogLine = {
    ...scrub(merged),
    level,
    time: new Date().toISOString(),
    msg,
  };

  // stdout for info/warn, stderr for error — matches Lambda's standard
  // streams so CloudWatch Logs Insights `level=error` queries line up with
  // what AWS surfaces as "Errors" on the function dashboard.
  const stream = level === "error" ? process.stderr : process.stdout;
  stream.write(JSON.stringify(line) + "\n");
}

export const logger = {
  info: (msg: string, ctx?: LogContext): void => emit("info", msg, ctx),
  warn: (msg: string, ctx?: LogContext): void => emit("warn", msg, ctx),
  error: (msg: string, ctx?: LogContext): void => emit("error", msg, ctx),
};
