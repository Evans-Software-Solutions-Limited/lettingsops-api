import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { logger } from "../logger";
import { runWithRequestContext } from "../requestContext";

interface Line {
  level: string;
  time: string;
  msg: string;
  [k: string]: unknown;
}

describe("logger", () => {
  let stdoutSpy: ReturnType<typeof vi.spyOn>;
  let stderrSpy: ReturnType<typeof vi.spyOn>;
  let stdoutLines: string[];
  let stderrLines: string[];

  beforeEach(() => {
    stdoutLines = [];
    stderrLines = [];
    stdoutSpy = vi
      .spyOn(process.stdout, "write")
      .mockImplementation((chunk: string | Uint8Array) => {
        stdoutLines.push(chunk.toString());
        return true;
      });
    stderrSpy = vi
      .spyOn(process.stderr, "write")
      .mockImplementation((chunk: string | Uint8Array) => {
        stderrLines.push(chunk.toString());
        return true;
      });
  });

  afterEach(() => {
    stdoutSpy.mockRestore();
    stderrSpy.mockRestore();
  });

  function lastStdout(): Line {
    const raw = stdoutLines[stdoutLines.length - 1];
    if (!raw) throw new Error("no stdout line");
    return JSON.parse(raw.trim()) as Line;
  }

  function lastStderr(): Line {
    const raw = stderrLines[stderrLines.length - 1];
    if (!raw) throw new Error("no stderr line");
    return JSON.parse(raw.trim()) as Line;
  }

  it("emits info to stdout with level/time/msg", () => {
    logger.info("hello");
    const line = lastStdout();
    expect(line.level).toBe("info");
    expect(line.msg).toBe("hello");
    expect(new Date(line.time).toString()).not.toBe("Invalid Date");
  });

  it("emits warn to stdout", () => {
    logger.warn("slow path");
    expect(lastStdout().level).toBe("warn");
  });

  it("emits error to stderr — keeps Lambda's Errors metric honest", () => {
    logger.error("kaboom");
    expect(stdoutLines).toHaveLength(0);
    expect(lastStderr().level).toBe("error");
  });

  it("merges request context fields into every line", () => {
    runWithRequestContext({ requestId: "req-1", agencyId: "ag-1" }, () => {
      logger.info("doing work");
    });
    const line = lastStdout();
    expect(line.requestId).toBe("req-1");
    expect(line.agencyId).toBe("ag-1");
  });

  it("explicit ctx fields override the request context", () => {
    runWithRequestContext({ agencyId: "ag-from-scope" }, () => {
      logger.info("override", { agencyId: "ag-from-call" });
    });
    expect(lastStdout().agencyId).toBe("ag-from-call");
  });

  it("scrubs PII keys from the merged context", () => {
    logger.info("ingested", {
      agencyId: "ag-1",
      tenant: { email: "alice@example.com" },
    });
    const line = lastStdout();
    expect(line.agencyId).toBe("ag-1");
    expect(line.tenant).toEqual({ email: "<redacted>" });
  });

  it("works without a request scope (cold-start path)", () => {
    logger.info("cold start", { agencyId: "ag-1" });
    const line = lastStdout();
    expect(line.agencyId).toBe("ag-1");
    expect(line).not.toHaveProperty("requestId"); // none set
  });

  describe("reserved-field precedence", () => {
    // Regression for Inspector Brad's lead on PR #33: the open `LogContext`
    // shape (`[key: string]: unknown`) means a caller can pass `level` /
    // `time` / `msg` keys, and the request context can plant the same keys
    // via `updateRequestContext`. Both must lose to the actual emit-time
    // values — otherwise a stray `{ level: "DEBUG" }` silently misclassifies
    // the stream and breaks CloudWatch `level=error` queries.

    it("ignores caller-supplied `level` override", () => {
      logger.info("hi", { level: "DEBUG" } as unknown as Record<
        string,
        unknown
      >);
      expect(lastStdout().level).toBe("info");
    });

    it("ignores caller-supplied `msg` override", () => {
      logger.info("real msg", { msg: "fake msg" } as unknown as Record<
        string,
        unknown
      >);
      expect(lastStdout().msg).toBe("real msg");
    });

    it("ignores caller-supplied `time` override", () => {
      logger.info("hi", { time: "1999-01-01T00:00:00Z" } as unknown as Record<
        string,
        unknown
      >);
      // Time is the emit-time ISO string, not the caller's value.
      expect(lastStdout().time).not.toBe("1999-01-01T00:00:00Z");
      expect(new Date(lastStdout().time).getFullYear()).toBeGreaterThan(2000);
    });

    it("ignores request-context-supplied reserved-field overrides", () => {
      // Mirror of the caller-side test, exercised via the ALS scope —
      // because `updateRequestContext` can plant arbitrary keys at any point
      // upstream of the actual log call.
      runWithRequestContext(
        { level: "DEBUG", msg: "from-scope" } as unknown as Record<
          string,
          unknown
        >,
        () => {
          logger.info("real msg");
        },
      );
      const line = lastStdout();
      expect(line.level).toBe("info");
      expect(line.msg).toBe("real msg");
    });
  });

  it("writes one JSON line per call, newline-terminated", () => {
    logger.info("a");
    logger.info("b");
    expect(stdoutLines).toHaveLength(2);
    expect(stdoutLines[0]?.endsWith("\n")).toBe(true);
    expect(stdoutLines[1]?.endsWith("\n")).toBe(true);
  });
});
