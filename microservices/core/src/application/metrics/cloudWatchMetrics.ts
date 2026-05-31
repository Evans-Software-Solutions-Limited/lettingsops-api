/**
 * CloudWatch custom-metric publisher.
 *
 * Design reference: `.kiro/specs/01-platform-hardening/design.md` §4.1
 * ("custom metrics published from the API via `PutMetricData` for the
 * lead-creation counters").
 *
 * Publishes one metric — `LeadsCreated` in the `LettingsOps` namespace,
 * dimensioned by `source` only. The Ingestion dashboard's "Leads
 * created (last hour, by source)" widget reads from this metric.
 *
 * Why source-only and not `(source, agencyId)` as the original design
 * suggested: every unique dimension value combination is a separate
 * billed custom metric in CloudWatch (~$0.30/metric/month with a
 * 15-month retention tail), so a per-tenant dimension scales the bill
 * linearly with `N agencies × 4 sources` — easily £100s/month at modest
 * scale and largely unread, since per-tenant lead counts are better
 * served by a `SELECT count(*) FROM leads WHERE agency_id = ?` against
 * the operational DB. design.md and tasks.md G4 were updated to record
 * this deviation. See Inspector Brad's medium-severity finding on
 * PR #39.
 *
 * Fire-and-forget by design. A `PutMetricData` failure must NOT surface
 * to the caller — observability instrumentation can't take the request
 * path down. Errors are swallowed but logged at `warn` so a sustained
 * outage is visible in the Lambda log group. The client is constructed
 * lazily and cached so warm-Lambda invocations don't pay the
 * connection-pool setup cost on every request.
 */
import {
  CloudWatchClient,
  PutMetricDataCommand,
} from "@aws-sdk/client-cloudwatch";
import { logger, formatError } from "@lettingsops/api-utils/logger";

const NAMESPACE = "LettingsOps";

export type LeadSource = "email" | "phone" | "portal" | "manual";

let cachedClient: CloudWatchClient | undefined;

function getClient(): CloudWatchClient {
  if (!cachedClient) {
    cachedClient = new CloudWatchClient({});
  }
  return cachedClient;
}

/**
 * Test-only hook to override or reset the cached CloudWatch client.
 * Production code MUST NOT call this — there's no auth or scope check
 * because it would be dead weight at runtime.
 */
export function __setCloudWatchClientForTests(
  client: CloudWatchClient | undefined,
): void {
  cachedClient = client;
}

/**
 * Publish a `LeadsCreated` data point. Resolves once the SDK call has
 * either completed or failed (and been swallowed). Callers should
 * `void`-prefix this in hot paths so the request doesn't await the
 * metric publish — see usage in `LeadRepository.create`.
 *
 * Called from `LeadRepository.create` so every ingestion path
 * (HTTP `POST /leads`, email Lambda, ElevenLabs phone webhook) gets
 * counted via the single choke point. Don't call this from services
 * directly — duplicate calls would double-count.
 */
export async function publishLeadCreated(source: LeadSource): Promise<void> {
  try {
    await getClient().send(
      new PutMetricDataCommand({
        Namespace: NAMESPACE,
        MetricData: [
          {
            MetricName: "LeadsCreated",
            Unit: "Count",
            Value: 1,
            Dimensions: [{ Name: "source", Value: source }],
            Timestamp: new Date(),
          },
        ],
      }),
    );
  } catch (err) {
    // Observability publish failures must not break the request path.
    logger.warn("CloudWatch PutMetricData failed", {
      metric: "LeadsCreated",
      source,
      ...formatError(err),
    });
  }
}
