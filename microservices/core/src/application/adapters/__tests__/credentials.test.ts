import { describe, it, expect, afterEach } from "vitest";
import { loadCredentials, setSecretReader } from "../credentials";

describe("loadCredentials", () => {
  afterEach(() => {
    // Restore the default env-backed reader and scrub any env we set.
    setSecretReader(null);
    delete process.env.TEST_SECRET;
    delete process.env.SST_RESOURCE_TestSecret;
  });

  describe("no secret configured", () => {
    it("returns null for null", () => {
      expect(loadCredentials(null)).toBeNull();
    });

    it("returns null for undefined", () => {
      expect(loadCredentials(undefined)).toBeNull();
    });

    it("returns null for an empty string", () => {
      expect(loadCredentials("")).toBeNull();
    });
  });

  describe("with an injected reader", () => {
    it("parses a JSON object credential", () => {
      setSecretReader(() => JSON.stringify({ bucket: "my-bucket" }));
      expect(loadCredentials<{ bucket: string }>("AnySecret")).toEqual({
        bucket: "my-bucket",
      });
    });

    it("returns a bare (non-JSON) string credential verbatim", () => {
      setSecretReader(() => "api-key-abc");
      expect(loadCredentials("AnySecret")).toBe("api-key-abc");
    });

    it("throws when the configured secret is absent at runtime", () => {
      setSecretReader(() => undefined);
      expect(() => loadCredentials("MissingSecret")).toThrow(
        /MissingSecret.*not present at runtime/,
      );
    });
  });

  describe("default env-backed reader", () => {
    it("reads a directly-linked env var", () => {
      process.env.TEST_SECRET = JSON.stringify({ token: "t1" });
      expect(loadCredentials<{ token: string }>("TEST_SECRET")).toEqual({
        token: "t1",
      });
    });

    it("reads the SST_RESOURCE_<name> blob and unwraps `.value`", () => {
      process.env.SST_RESOURCE_TestSecret = JSON.stringify({
        value: "sekret-token",
        type: "Secret",
      });
      expect(loadCredentials("TestSecret")).toBe("sekret-token");
    });

    it("falls back to the raw blob when it has no string `.value`", () => {
      // No `value` field → reader hands back the raw blob, which
      // loadCredentials then JSON-parses into the object.
      process.env.SST_RESOURCE_TestSecret = JSON.stringify({ type: "Secret" });
      expect(loadCredentials("TestSecret")).toEqual({ type: "Secret" });
    });

    it("falls back to the raw blob when it is not valid JSON", () => {
      process.env.SST_RESOURCE_TestSecret = "not-json-at-all";
      expect(loadCredentials("TestSecret")).toBe("not-json-at-all");
    });

    it("throws when neither env form is present", () => {
      expect(() => loadCredentials("TestSecret")).toThrow(
        /TestSecret.*not present at runtime/,
      );
    });
  });
});
