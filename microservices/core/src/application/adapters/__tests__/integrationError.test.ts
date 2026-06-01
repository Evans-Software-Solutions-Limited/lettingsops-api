import { describe, it, expect } from "vitest";
import { IntegrationError } from "../integrationError";

describe("IntegrationError", () => {
  it("preserves the message on the base Error", () => {
    const err = new IntegrationError("CRM responded with 502", {
      call: "crm.pushLead",
      attempt: 1,
    });
    expect(err.message).toBe("CRM responded with 502");
  });

  it("is an instance of Error (so `try/catch (err) {}` blocks see it)", () => {
    const err = new IntegrationError("boom", {
      call: "crm.pushLead",
      attempt: 1,
    });
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(IntegrationError);
  });

  it("carries the call, attempt, and retryable fields verbatim", () => {
    const err = new IntegrationError("503 Service Unavailable", {
      call: "slotSource.bookSlot",
      attempt: 2,
      retryable: true,
    });
    expect(err.call).toBe("slotSource.bookSlot");
    expect(err.attempt).toBe(2);
    expect(err.retryable).toBe(true);
  });

  it("defaults `retryable` to true when omitted (transient is the common case)", () => {
    const err = new IntegrationError("timeout", {
      call: "crm.pushLead",
      attempt: 1,
    });
    expect(err.retryable).toBe(true);
  });

  it("respects `retryable: false` for permanent failures (auth, malformed request)", () => {
    // The retry helper reads this to short-circuit the backoff
    // schedule — burning attempts on an auth-misconfig error is
    // pure latency, no value.
    const err = new IntegrationError(
      "401 Unauthorized — CRM credentials rejected",
      {
        call: "crm.pushLead",
        attempt: 1,
        retryable: false,
      },
    );
    expect(err.retryable).toBe(false);
  });

  it("sets the standard ES2022 `cause` slot when provided (no own field on this class)", () => {
    // Validates that downstream `formatError`-style helpers that walk
    // `Error#cause` will find the original exception attached.
    const original = new Error("connect ECONNREFUSED 10.0.0.1:443");
    const err = new IntegrationError("CRM unreachable", {
      call: "crm.pushLead",
      attempt: 1,
      cause: original,
    });
    expect(err.cause).toBe(original);
  });

  it("leaves `cause` unset when not provided", () => {
    const err = new IntegrationError("boom", {
      call: "crm.pushLead",
      attempt: 1,
    });
    expect(err.cause).toBeUndefined();
  });

  it("sets `name` to 'IntegrationError' so structured loggers tag it correctly", () => {
    const err = new IntegrationError("boom", {
      call: "crm.pushLead",
      attempt: 1,
    });
    expect(err.name).toBe("IntegrationError");
  });
});
