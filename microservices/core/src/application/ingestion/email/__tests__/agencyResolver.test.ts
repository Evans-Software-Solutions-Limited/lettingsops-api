import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Db } from "@lettingsops/db";
import { resolveAgencyFromInboundEmail } from "../agencyResolver";

// ─── Mock chainable Drizzle query builder ─────────────────────────────────────

function mockChain<T>(result: T) {
  const chain: Record<string, unknown> = {};
  const promise = Promise.resolve(result);
  const fluent = ["from", "where", "limit"];
  for (const method of fluent) {
    chain[method] = () => chain;
  }
  chain["then"] = (
    resolve: Parameters<Promise<T>["then"]>[0],
    reject?: Parameters<Promise<T>["then"]>[1],
  ) => promise.then(resolve, reject);
  return chain;
}

describe("resolveAgencyFromInboundEmail", () => {
  let mockDb: Partial<Db>;
  let selectSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    selectSpy = vi.fn(() => mockChain([{ id: "agency-uuid-1" }]));
    mockDb = { select: selectSpy } as unknown as Partial<Db>;
  });

  it("returns the agencyId when the recipient matches a row", async () => {
    const result = await resolveAgencyFromInboundEmail(
      "lettings@agency-test.com",
      mockDb as Db,
    );
    expect(result).toBe("agency-uuid-1");
    expect(selectSpy).toHaveBeenCalledTimes(1);
  });

  it("returns null when no row matches", async () => {
    selectSpy = vi.fn(() => mockChain([])) as ReturnType<typeof vi.fn>;
    mockDb = { select: selectSpy } as unknown as Partial<Db>;

    const result = await resolveAgencyFromInboundEmail(
      "nobody@example.com",
      mockDb as Db,
    );
    expect(result).toBeNull();
  });

  it("short-circuits to null on empty input — no DB round-trip", async () => {
    const result = await resolveAgencyFromInboundEmail("", mockDb as Db);
    expect(result).toBeNull();
    expect(selectSpy).not.toHaveBeenCalled();
  });

  it("short-circuits to null on whitespace-only input — no DB round-trip", async () => {
    const result = await resolveAgencyFromInboundEmail("   \t  ", mockDb as Db);
    expect(result).toBeNull();
    expect(selectSpy).not.toHaveBeenCalled();
  });

  // ── Inspector Brad MEDIUM finding, PR #41 ────────────────────────────────

  it("normalises mixed-case recipients to lowercase before lookup", async () => {
    // Real forwarders deliver `To: Lettings@Agency-Test.COM` with
    // whatever capitalisation the sender's MUA decided. Without
    // normalisation, `eq()` byte-compares against the stored value and
    // 401s well-formed traffic. The resolver must lowercase both sides.
    await resolveAgencyFromInboundEmail(
      "  Lettings@Agency-Test.COM  ",
      mockDb as Db,
    );

    // The query was issued exactly once.
    expect(selectSpy).toHaveBeenCalledTimes(1);
    // We can't directly inspect the WHERE predicate value from the
    // chainable mock, but we CAN inspect the limit() call's preceding
    // where() — capture both calls via a closure spy.
  });

  it("captures the normalised value in the where() predicate", async () => {
    // More precise: rebuild the chain so we can spy on `.where()`'s
    // argument shape. Drizzle's `eq(sql\`lower(\${col})\`, value)`
    // produces an SQL chunk whose `queryChunks` contains the raw
    // `value` — we walk one level deep to confirm it's the lowercased
    // string.
    const whereSpy = vi.fn();
    const chain: Record<string, unknown> = {};
    chain["from"] = () => chain;
    chain["where"] = (predicate: unknown) => {
      whereSpy(predicate);
      return chain;
    };
    chain["limit"] = () => Promise.resolve([{ id: "agency-uuid-1" }]);
    selectSpy = vi.fn(() => chain) as ReturnType<typeof vi.fn>;
    mockDb = { select: selectSpy } as unknown as Partial<Db>;

    await resolveAgencyFromInboundEmail(
      "  Lettings@Agency-Test.COM  ",
      mockDb as Db,
    );

    expect(whereSpy).toHaveBeenCalledTimes(1);
    // The predicate is a Drizzle SQL object — JSON.stringify includes
    // the parameter values verbatim. Search for the normalised string.
    const serialised = JSON.stringify(whereSpy.mock.calls[0]?.[0] ?? null);
    expect(serialised).toContain("lettings@agency-test.com");
    expect(serialised).not.toContain("Lettings@Agency-Test.COM");
  });
});
