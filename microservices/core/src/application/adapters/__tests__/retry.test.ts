import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { retryIntegrationCall, MAX_ATTEMPTS, BACKOFF_MS } from "../retry";
import { IntegrationError } from "../integrationError";
import type { IntegrationEventsRepository } from "../../repositories/integrationEventsRepository";

const EVENT_ID = "ev-uuid-1";

/** Fake tenant-scoped audit repo — just records create / updateStatus calls. */
function makeEvents() {
  const create = vi.fn(async () => ({
    id: EVENT_ID,
    agencyId: "agency-1",
    call: "crm.pushLead",
    refId: null,
    status: "pending",
    attempts: 0,
    lastError: null,
    createdAt: new Date("2026-06-02T10:00:00.000Z"),
    updatedAt: new Date("2026-06-02T10:00:00.000Z"),
  }));
  const updateStatus = vi.fn(async () => {});
  return {
    create,
    updateStatus,
  } as unknown as IntegrationEventsRepository;
}

const CALL = "crm.pushLead";

describe("retryIntegrationCall", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("succeeds on the first attempt", async () => {
    const events = makeEvents();
    const fn = vi.fn(async () => ({ externalId: "crm-1" }));

    const result = await retryIntegrationCall(CALL, fn, {
      events,
      refId: "lead-1",
    });

    expect(result).toEqual({
      ok: true,
      value: { externalId: "crm-1" },
      attempts: 1,
    });
    expect(fn).toHaveBeenCalledTimes(1);
    expect(events.create).toHaveBeenCalledWith({
      call: CALL,
      refId: "lead-1",
      status: "pending",
    });
    expect(events.updateStatus).toHaveBeenCalledTimes(1);
    expect(events.updateStatus).toHaveBeenCalledWith(EVENT_ID, {
      status: "succeeded",
      attempts: 1,
      lastError: null,
    });
    // No backoff timer was ever scheduled.
    expect(vi.getTimerCount()).toBe(0);
  });

  it("retries a transient failure, then succeeds", async () => {
    const events = makeEvents();
    const fn = vi
      .fn()
      .mockRejectedValueOnce(
        new IntegrationError("503 from CRM", { call: CALL, attempt: 1 }),
      )
      .mockResolvedValueOnce({ externalId: "crm-2" });

    const promise = retryIntegrationCall(CALL, fn, { events, refId: "lead-1" });
    // Walk the first backoff (1s) so the second attempt runs.
    await vi.advanceTimersByTimeAsync(BACKOFF_MS[0]);
    const result = await promise;

    expect(result).toEqual({
      ok: true,
      value: { externalId: "crm-2" },
      attempts: 2,
    });
    expect(fn).toHaveBeenCalledTimes(2);
    expect(events.updateStatus).toHaveBeenNthCalledWith(1, EVENT_ID, {
      status: "retrying",
      attempts: 1,
      lastError: "503 from CRM",
    });
    expect(events.updateStatus).toHaveBeenNthCalledWith(2, EVENT_ID, {
      status: "succeeded",
      attempts: 2,
      lastError: null,
    });
  });

  it("exhausts all attempts, marks failed_permanent, and does NOT throw", async () => {
    const events = makeEvents();
    const fn = vi
      .fn()
      .mockRejectedValue(
        new IntegrationError("still down", { call: CALL, attempt: 0 }),
      );

    const promise = retryIntegrationCall(CALL, fn, { events, refId: "lead-1" });
    // Drain the full 1s + 5s + 30s schedule.
    await vi.advanceTimersByTimeAsync(BACKOFF_MS.reduce((a, b) => a + b, 0));
    const result = await promise;

    expect(result.ok).toBe(false);
    expect(result.attempts).toBe(MAX_ATTEMPTS);
    expect(fn).toHaveBeenCalledTimes(MAX_ATTEMPTS);
    // Three interim "retrying" writes + one terminal "failed_permanent".
    expect(events.updateStatus).toHaveBeenCalledTimes(MAX_ATTEMPTS);
    expect(events.updateStatus).toHaveBeenLastCalledWith(EVENT_ID, {
      status: "failed_permanent",
      attempts: MAX_ATTEMPTS,
      lastError: "still down",
    });
  });

  it("short-circuits a non-retryable IntegrationError with no backoff", async () => {
    const events = makeEvents();
    const fn = vi.fn().mockRejectedValue(
      new IntegrationError("401 bad creds", {
        call: CALL,
        attempt: 1,
        retryable: false,
      }),
    );

    const result = await retryIntegrationCall(CALL, fn, {
      events,
      refId: "lead-1",
    });

    expect(result.ok).toBe(false);
    expect(result.attempts).toBe(1);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0); // never backed off
    expect(events.updateStatus).toHaveBeenCalledTimes(1);
    expect(events.updateStatus).toHaveBeenCalledWith(EVENT_ID, {
      status: "failed_permanent",
      attempts: 1,
      lastError: "401 bad creds",
    });
  });

  it("treats a plain Error as permanent (no retry, name-only audit message)", async () => {
    const events = makeEvents();
    const fn = vi.fn().mockRejectedValue(new TypeError("unexpected bug"));

    const result = await retryIntegrationCall(CALL, fn, {
      events,
      refId: "lead-1",
    });

    expect(result.ok).toBe(false);
    expect(result.attempts).toBe(1);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
    // formatError classifies by name and never leaks the raw message.
    expect(events.updateStatus).toHaveBeenCalledWith(EVENT_ID, {
      status: "failed_permanent",
      attempts: 1,
      lastError: "TypeError",
    });
  });

  it("always lands a pending event row up front", async () => {
    const events = makeEvents();
    const fn = vi.fn(async () => ({ externalId: "x" }));

    await retryIntegrationCall(CALL, fn, { events, refId: "lead-9" });

    expect(events.create).toHaveBeenCalledTimes(1);
    expect(events.create).toHaveBeenCalledWith({
      call: CALL,
      refId: "lead-9",
      status: "pending",
    });
  });

  it("still runs the call (and does not throw) when the audit create fails", async () => {
    const events = makeEvents();
    (events.create as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error("db down"),
    );
    const fn = vi.fn(async () => ({ externalId: "crm-ok" }));

    const result = await retryIntegrationCall(CALL, fn, { events });

    expect(result).toEqual({
      ok: true,
      value: { externalId: "crm-ok" },
      attempts: 1,
    });
    expect(fn).toHaveBeenCalledTimes(1);
    // No eventId → status writes are no-ops.
    expect(events.updateStatus).not.toHaveBeenCalled();
  });

  it("returns the successful outcome even when the status write fails", async () => {
    const events = makeEvents();
    (events.updateStatus as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("status write failed"),
    );
    const fn = vi.fn(async () => ({ externalId: "crm-ok" }));

    const result = await retryIntegrationCall(CALL, fn, { events });

    expect(result.ok).toBe(true);
  });

  it("redacts PII and caps length in the audited last_error", async () => {
    const events = makeEvents();
    const fn = vi
      .fn()
      .mockRejectedValue(
        new IntegrationError(
          "push failed for jane.doe@example.com / +44 7700 900123",
          { call: CALL, attempt: 1, retryable: false },
        ),
      );

    await retryIntegrationCall(CALL, fn, { events, refId: "lead-1" });

    const lastError = (events.updateStatus as ReturnType<typeof vi.fn>).mock
      .calls[0][1].lastError as string;
    expect(lastError).not.toContain("jane.doe@example.com");
    expect(lastError).not.toContain("900123");
    expect(lastError).toContain("[redacted-email]");
    expect(lastError).toContain("[redacted-phone]");
  });

  it("caps an over-long audit message", async () => {
    const events = makeEvents();
    const long = "x".repeat(500);
    const fn = vi.fn().mockRejectedValue(
      new IntegrationError(long, {
        call: CALL,
        attempt: 1,
        retryable: false,
      }),
    );

    await retryIntegrationCall(CALL, fn, { events, refId: "lead-1" });

    const lastError = (events.updateStatus as ReturnType<typeof vi.fn>).mock
      .calls[0][1].lastError as string;
    expect(lastError.length).toBeLessThanOrEqual(301); // 300 + ellipsis
    expect(lastError.endsWith("…")).toBe(true);
  });

  it("does not throw when the audit write fails on the failure branch", async () => {
    const events = makeEvents();
    // The "audit flaky during a real failure" scenario: both fn and the
    // failed_permanent status write reject.
    (events.updateStatus as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("status write failed"),
    );
    const fn = vi.fn().mockRejectedValue(
      new IntegrationError("401", {
        call: CALL,
        attempt: 1,
        retryable: false,
      }),
    );

    const result = await retryIntegrationCall(CALL, fn, { events });

    expect(result.ok).toBe(false);
    expect(result.attempts).toBe(1);
  });

  it("passes the 1-indexed attempt number to fn", async () => {
    const events = makeEvents();
    const seen: number[] = [];
    const fn = vi.fn(async (attempt: number) => {
      seen.push(attempt);
      if (attempt < 2) {
        throw new IntegrationError("retry me", { call: CALL, attempt });
      }
      return { externalId: "ok" };
    });

    const promise = retryIntegrationCall(CALL, fn, { events });
    await vi.advanceTimersByTimeAsync(BACKOFF_MS[0]);
    await promise;

    expect(seen).toEqual([1, 2]);
  });
});
