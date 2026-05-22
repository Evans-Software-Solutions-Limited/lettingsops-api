import { describe, it, expect } from "vitest";
import { scrub, DEFAULT_PII_KEYS } from "../scrub";

describe("scrub", () => {
  it("redacts top-level PII keys", () => {
    const out = scrub({
      email: "alice@example.com",
      phone: "+44 7700 900000",
      agencyId: "agency-1",
    });
    expect(out).toEqual({
      email: "<redacted>",
      phone: "<redacted>",
      agencyId: "agency-1",
    });
  });

  it("redacts PII keys nested inside non-PII keys", () => {
    const out = scrub({
      tenant: { email: "alice@example.com", name: "Alice" },
      agencyId: "agency-1",
    });
    expect(out).toEqual({
      tenant: { email: "<redacted>", name: "<redacted>" },
      agencyId: "agency-1",
    });
  });

  it("walks arrays of objects", () => {
    const out = scrub({
      contacts: [
        { email: "a@x.com", role: "primary" },
        { email: "b@x.com", role: "guarantor" },
      ],
    });
    expect(out).toEqual({
      contacts: [
        { email: "<redacted>", role: "primary" },
        { email: "<redacted>", role: "guarantor" },
      ],
    });
  });

  it("leaves arrays of primitives untouched", () => {
    const out = scrub({ tags: ["new", "viewing-booked"] });
    expect(out).toEqual({ tags: ["new", "viewing-booked"] });
  });

  it("redacts the value even when the value is itself an object", () => {
    // Per design §3.2: redact based on the key, not based on inspecting the
    // value. If `extractedFields` is in the PII set, the entire payload is
    // replaced — we don't peek inside to decide which sub-fields to keep.
    const out = scrub({
      extractedFields: { tenantEmail: "a@x.com", tenantName: "Alice" },
    });
    expect(out).toEqual({ extractedFields: "<redacted>" });
  });

  it("returns primitives unchanged", () => {
    expect(scrub("hello")).toBe("hello");
    expect(scrub(42)).toBe(42);
    expect(scrub(null)).toBe(null);
    expect(scrub(undefined)).toBe(undefined);
    expect(scrub(true)).toBe(true);
  });

  it("returns empty object and empty array unchanged in shape", () => {
    expect(scrub({})).toEqual({});
    expect(scrub([])).toEqual([]);
  });

  it("preserves missing fields (does not invent keys)", () => {
    const out = scrub({ agencyId: "a", requestId: "r" });
    expect(out).not.toHaveProperty("email");
    expect(out).not.toHaveProperty("phone");
  });

  it("does not walk class instances (Date, Error)", () => {
    const now = new Date();
    const err = new Error("boom");
    const out = scrub({ createdAt: now, lastError: err });
    expect(out.createdAt).toBe(now); // same reference, not walked
    expect(out.lastError).toBe(err);
  });

  it("redacts the class-instance value when its key is in the PII set", () => {
    // The key signals PII intent — the value's type doesn't matter.
    const out = scrub({ name: new Date() });
    expect(out).toEqual({ name: "<redacted>" });
  });

  it("accepts a custom PII key set", () => {
    const out = scrub(
      { secret: "shhh", agencyId: "a" },
      { keys: new Set(["secret"]) },
    );
    expect(out).toEqual({ secret: "<redacted>", agencyId: "a" });
  });

  it("does not mutate the input", () => {
    const input = { email: "a@x.com", agencyId: "a" };
    const snapshot = { ...input };
    scrub(input);
    expect(input).toEqual(snapshot);
  });

  it("DEFAULT_PII_KEYS includes the spec'd keys", () => {
    // Locks the spec's PII list — adding a new field that carries PII means
    // updating this list AND adding the key here in the same PR.
    expect(DEFAULT_PII_KEYS).toContain("email");
    expect(DEFAULT_PII_KEYS).toContain("phone");
    expect(DEFAULT_PII_KEYS).toContain("address");
    expect(DEFAULT_PII_KEYS).toContain("name");
    expect(DEFAULT_PII_KEYS).toContain("body");
    expect(DEFAULT_PII_KEYS).toContain("transcript");
    expect(DEFAULT_PII_KEYS).toContain("message");
    expect(DEFAULT_PII_KEYS).toContain("extractedFields");
    expect(DEFAULT_PII_KEYS).toContain("answers");
    expect(DEFAULT_PII_KEYS).toContain("collectedFields");
  });
});
