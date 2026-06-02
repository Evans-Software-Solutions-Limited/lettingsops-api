import { describe, it, expect, afterEach } from "vitest";
import { loadCredentials, setSecretReader } from "../credentials";

describe("loadCredentials", () => {
  afterEach(() => {
    // Restore the default env-backed reader and scrub any env we set.
    setSecretReader(null);
    delete process.env.LettingsOpsTestSecret;
    delete process.env.SST_RESOURCE_LettingsOpsTestSecret;
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
      process.env.LettingsOpsTestSecret = JSON.stringify({ token: "t1" });
      expect(
        loadCredentials<{ token: string }>("LettingsOpsTestSecret"),
      ).toEqual({ token: "t1" });
    });

    it("reads the SST_RESOURCE_<name> blob and unwraps `.value`", () => {
      process.env.SST_RESOURCE_LettingsOpsTestSecret = JSON.stringify({
        value: "sekret-token",
        type: "Secret",
      });
      expect(loadCredentials("LettingsOpsTestSecret")).toBe("sekret-token");
    });

    it("falls back to the raw blob when it has no string `.value`", () => {
      // No `value` field → reader hands back the raw blob, which
      // loadCredentials then JSON-parses into the object.
      process.env.SST_RESOURCE_LettingsOpsTestSecret = JSON.stringify({
        type: "Secret",
      });
      expect(loadCredentials("LettingsOpsTestSecret")).toEqual({
        type: "Secret",
      });
    });

    it("falls back to the raw blob when it is not valid JSON", () => {
      process.env.SST_RESOURCE_LettingsOpsTestSecret = "not-json-at-all";
      expect(loadCredentials("LettingsOpsTestSecret")).toBe("not-json-at-all");
    });

    it("throws when neither env form is present", () => {
      expect(() => loadCredentials("LettingsOpsTestSecret")).toThrow(
        /LettingsOpsTestSecret.*not present at runtime/,
      );
    });

    it("refuses to read a secret name outside the LettingsOps namespace", () => {
      // The footgun: a DB-stored config value naming an unrelated env var.
      process.env.DATABASE_URL = "postgres://secret";
      try {
        expect(() => loadCredentials("DATABASE_URL")).toThrow(
          /LettingsOps\* SST namespace/,
        );
      } finally {
        delete process.env.DATABASE_URL;
      }
    });

    it("refuses names with injection-y shapes even under the prefix", () => {
      expect(() => loadCredentials("LettingsOps../../etc")).toThrow(
        /LettingsOps\* SST namespace/,
      );
    });
  });
});
