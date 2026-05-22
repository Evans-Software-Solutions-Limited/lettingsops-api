import { describe, it, expect } from "vitest";
import { formatError } from "../formatError";

describe("formatError", () => {
  it("captures name from a plain Error and drops the message", () => {
    const out = formatError(new Error("alice@example.com is not verified"));
    expect(out.errorName).toBe("Error");
    // The PII-bearing message MUST NOT appear anywhere in the returned shape.
    expect(JSON.stringify(out)).not.toContain("alice@example.com");
    expect(out).not.toHaveProperty("message");
    expect(out).not.toHaveProperty("stack");
  });

  it("captures the AWS SDK error shape (name + $metadata.httpStatusCode)", () => {
    // Shape modelled after @aws-sdk/client-ses MessageRejected.
    class MessageRejected extends Error {
      override name = "MessageRejected";
      $metadata = { httpStatusCode: 400 };
    }
    const out = formatError(
      new MessageRejected("Email address is not verified: alice@example.com"),
    );
    expect(out).toEqual({
      errorName: "MessageRejected",
      errorCode: undefined,
      errorStatusCode: 400,
    });
    expect(JSON.stringify(out)).not.toContain("alice@example.com");
  });

  it("captures a string error.code (e.g. Postgres SQLSTATE via Drizzle)", () => {
    class PgError extends Error {
      override name = "PostgresError";
      code = "23505"; // unique_violation
    }
    const out = formatError(
      new PgError(
        "duplicate key value violates unique constraint; DETAIL: Key (email)=(alice@example.com) already exists.",
      ),
    );
    expect(out.errorName).toBe("PostgresError");
    expect(out.errorCode).toBe("23505");
    expect(JSON.stringify(out)).not.toContain("alice@example.com");
  });

  it("prefers numeric statusCode over $metadata.httpStatusCode when both exist", () => {
    class HttpError extends Error {
      override name = "HttpError";
      statusCode = 503;
      $metadata = { httpStatusCode: 500 };
    }
    expect(formatError(new HttpError("x")).errorStatusCode).toBe(503);
  });

  it("ignores non-string code (defensive against ill-typed errors)", () => {
    class WeirdError extends Error {
      override name = "Weird";
      code = 42; // not a string — drizzle wraps numeric codes elsewhere
    }
    expect(formatError(new WeirdError("x")).errorCode).toBeUndefined();
  });

  it("classifies a non-Error throw as Unknown", () => {
    expect(formatError("alice@example.com")).toEqual({ errorName: "Unknown" });
    expect(formatError(42)).toEqual({ errorName: "Unknown" });
    expect(formatError(null)).toEqual({ errorName: "Unknown" });
    expect(formatError(undefined)).toEqual({ errorName: "Unknown" });
  });
});
