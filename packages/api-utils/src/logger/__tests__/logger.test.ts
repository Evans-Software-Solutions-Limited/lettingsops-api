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

  it("writes one JSON line per call, newline-terminated", () => {
    logger.info("a");
    logger.info("b");
    expect(stdoutLines).toHaveLength(2);
    expect(stdoutLines[0]?.endsWith("\n")).toBe(true);
    expect(stdoutLines[1]?.endsWith("\n")).toBe(true);
  });
});
