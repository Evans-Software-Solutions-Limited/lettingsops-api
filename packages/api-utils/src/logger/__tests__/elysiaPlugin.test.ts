import { describe, it, expect } from "vitest";
import Elysia from "elysia";
import { requestContextPlugin } from "../elysiaPlugin";
import { getRequestContext } from "../requestContext";

describe("requestContextPlugin", () => {
  it("seeds requestId from x-amzn-RequestId on the header", async () => {
    let seen: string | undefined;
    const app = new Elysia().use(requestContextPlugin).get("/", () => {
      seen = getRequestContext()?.requestId;
      return "ok";
    });

    const res = await app.handle(
      new Request("http://localhost/", {
        headers: { "x-amzn-RequestId": "amz-abc-123" },
      }),
    );

    expect(res.status).toBe(200);
    expect(seen).toBe("amz-abc-123");
  });

  it("generates a fallback requestId when no header is present", async () => {
    let seen: string | undefined;
    const app = new Elysia().use(requestContextPlugin).get("/", () => {
      seen = getRequestContext()?.requestId;
      return "ok";
    });

    await app.handle(new Request("http://localhost/"));

    expect(seen).toBeDefined();
    expect(seen?.length).toBeGreaterThan(0);
  });

  it("opens an independent scope per request", async () => {
    const seen: (string | undefined)[] = [];
    const app = new Elysia().use(requestContextPlugin).get("/", () => {
      seen.push(getRequestContext()?.requestId);
      return "ok";
    });

    await app.handle(
      new Request("http://localhost/", {
        headers: { "x-amzn-RequestId": "first" },
      }),
    );
    await app.handle(
      new Request("http://localhost/", {
        headers: { "x-amzn-RequestId": "second" },
      }),
    );

    expect(seen).toEqual(["first", "second"]);
  });
});
