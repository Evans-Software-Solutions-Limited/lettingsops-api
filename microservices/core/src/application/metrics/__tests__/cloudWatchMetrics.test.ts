// vitest.setup.ts globally mocks this module so other tests don't touch
// the AWS SDK. Here we want to test the real implementation — unmock.
import { vi } from "vitest";
vi.unmock("../cloudWatchMetrics");

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  CloudWatchClient,
  PutMetricDataCommand,
} from "@aws-sdk/client-cloudwatch";
import {
  publishLeadCreated,
  __setCloudWatchClientForTests,
} from "../cloudWatchMetrics";

// A stand-in for the AWS SDK client: spy on `.send()` so we can inspect
// the command instance that gets sent.
function makeFakeClient(
  sendImpl: (cmd: unknown) => Promise<unknown> = () => Promise.resolve({}),
): { send: ReturnType<typeof vi.fn> } {
  return { send: vi.fn(sendImpl) };
}

describe("publishLeadCreated", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    __setCloudWatchClientForTests(undefined);
  });

  it("sends a PutMetricDataCommand with the LettingsOps namespace and LeadsCreated metric", async () => {
    const fake = makeFakeClient();
    __setCloudWatchClientForTests(fake as unknown as CloudWatchClient);

    await publishLeadCreated("email");

    expect(fake.send).toHaveBeenCalledTimes(1);
    const cmd = fake.send.mock.calls[0]?.[0];
    expect(cmd).toBeInstanceOf(PutMetricDataCommand);
    const input = (cmd as PutMetricDataCommand).input;
    expect(input.Namespace).toBe("LettingsOps");
    expect(input.MetricData?.[0]?.MetricName).toBe("LeadsCreated");
    expect(input.MetricData?.[0]?.Value).toBe(1);
    expect(input.MetricData?.[0]?.Unit).toBe("Count");
  });

  it("dimensions the metric by source only (no per-tenant cost explosion)", async () => {
    // Regression for Inspector Brad's medium-severity finding on
    // PR #39: a per-tenant dimension multiplies billed custom metrics
    // by every active agency. Source-only stays bounded at 4 metrics
    // total. If a future PR wants per-tenant lead counts, they go
    // through a DB query, not a new dimension here.
    const fake = makeFakeClient();
    __setCloudWatchClientForTests(fake as unknown as CloudWatchClient);

    await publishLeadCreated("phone");

    const cmd = fake.send.mock.calls[0]?.[0] as PutMetricDataCommand;
    const dims = cmd.input.MetricData?.[0]?.Dimensions ?? [];
    expect(dims).toEqual([{ Name: "source", Value: "phone" }]);
    expect(dims).toHaveLength(1);
  });

  it("stamps the data point with a current timestamp", async () => {
    const fake = makeFakeClient();
    __setCloudWatchClientForTests(fake as unknown as CloudWatchClient);
    const before = Date.now();

    await publishLeadCreated("manual");

    const cmd = fake.send.mock.calls[0]?.[0] as PutMetricDataCommand;
    const ts = cmd.input.MetricData?.[0]?.Timestamp as Date;
    expect(ts).toBeInstanceOf(Date);
    expect(ts.getTime()).toBeGreaterThanOrEqual(before);
    expect(ts.getTime()).toBeLessThanOrEqual(Date.now());
  });

  it("swallows SDK errors so the request path is not broken", async () => {
    // PutMetricData failures must never surface to the caller — the
    // request that prompted the publish has already succeeded.
    const fake = makeFakeClient(() =>
      Promise.reject(new Error("Throttled by CloudWatch")),
    );
    __setCloudWatchClientForTests(fake as unknown as CloudWatchClient);

    await expect(publishLeadCreated("email")).resolves.toBeUndefined();
    expect(fake.send).toHaveBeenCalledTimes(1);
  });

  it("reuses the cached client across multiple publishes (no rebuild per call)", async () => {
    const fake = makeFakeClient();
    __setCloudWatchClientForTests(fake as unknown as CloudWatchClient);

    await publishLeadCreated("portal");
    await publishLeadCreated("email");

    expect(fake.send).toHaveBeenCalledTimes(2);
    // Both calls hit the same client instance — no test-double swap in
    // between, so we know the module didn't construct a fresh client
    // mid-test.
  });
});
