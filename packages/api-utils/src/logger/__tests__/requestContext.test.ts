import { describe, it, expect } from "vitest";
import {
  runWithRequestContext,
  enterRequestContext,
  updateRequestContext,
  getRequestContext,
} from "../requestContext";

describe("requestContext", () => {
  describe("runWithRequestContext", () => {
    it("makes ctx visible inside the callback", () => {
      runWithRequestContext({ requestId: "r1", agencyId: "a1" }, () => {
        expect(getRequestContext()).toEqual({
          requestId: "r1",
          agencyId: "a1",
        });
      });
    });

    it("returns the callback's return value", () => {
      const out = runWithRequestContext({ requestId: "r1" }, () => 42);
      expect(out).toBe(42);
    });

    it("does not leak ctx outside the callback", () => {
      runWithRequestContext({ requestId: "inside" }, () => {});
      expect(getRequestContext()).toBeUndefined();
    });

    it("propagates ctx across awaited work", async () => {
      const seen = await runWithRequestContext(
        { requestId: "r1" },
        async () => {
          await Promise.resolve();
          return getRequestContext()?.requestId;
        },
      );
      expect(seen).toBe("r1");
    });
  });

  describe("updateRequestContext", () => {
    it("enriches the active scope (e.g. auth resolving agencyId)", () => {
      runWithRequestContext({ requestId: "r1" }, () => {
        updateRequestContext({ agencyId: "a1" });
        expect(getRequestContext()).toEqual({
          requestId: "r1",
          agencyId: "a1",
        });
      });
    });

    it("is a no-op outside a scope", () => {
      // Should not throw.
      updateRequestContext({ agencyId: "ghost" });
      expect(getRequestContext()).toBeUndefined();
    });
  });

  describe("enterRequestContext", () => {
    it("sets the scope without a wrapping callback", async () => {
      // Run inside an isolated runWithRequestContext so this test does not
      // poison the global scope for subsequent tests — enterWith would
      // otherwise persist for the rest of this Node execution context.
      await runWithRequestContext({}, () => {
        enterRequestContext({ requestId: "entered" });
        expect(getRequestContext()?.requestId).toBe("entered");
      });
    });
  });

  describe("getRequestContext", () => {
    it("returns undefined outside any scope", () => {
      expect(getRequestContext()).toBeUndefined();
    });
  });
});
