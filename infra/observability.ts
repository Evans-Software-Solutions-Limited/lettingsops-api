/**
 * Block G — Observability: SNS topic, dashboards, alarms.
 *
 * Design reference: `.kiro/specs/01-platform-hardening/design.md` §4.
 *
 * Layout:
 *   §4.3 → `alarmsTopic` + email subscription pulled from
 *          `LettingsOpsAlarmEmail` SST secret.
 *   §4.1 → Three CloudWatch dashboards (Ingestion, Lambda health,
 *          Email reputation).
 *   §4.2 → Five MetricAlarms wired to `alarmsTopic.arn`:
 *            - LambdaErrorRate         (api.handler error rate > 1% / 5m)
 *            - EmailProcessorFailureRate (> 5% / 5m)
 *            - ElevenLabsWebhookFailures (any non-2xx / 5m)
 *            - SesBounceRate           (> 2% / 15m)
 *            - SesComplaintRate        (> 0.1% / 15m)
 *
 * The Lambda alarms target specific functions via the `FunctionName`
 * dimension. The function names are read off `apiRoute.nodes.function`
 * (from `infra/api.ts`) and `emailProcessor.nodes.function` (from
 * `infra/email.ts`) so we don't bake in SST's internal naming scheme.
 *
 * The `ElevenLabsWebhookFailures` alarm watches the API Gateway 4XX/5XX
 * counters at the v2 API level. Per-route filtering is not available on
 * the `$default` route shape, so this triggers on ANY non-2xx response
 * from the API — a deliberate conservative choice for the first cut; if
 * it proves noisy we'll swap to a custom CloudWatch metric published by
 * the ElevenLabs webhook handler (G4 follow-up).
 */
import { alarmEmail } from "./secrets";
import { apiRoute, lettingsAPI } from "./api";
import { emailProcessor } from "./email";

// ── §4.3 Notification target ────────────────────────────────────────────────

/** SNS topic that receives every alarm action. */
export const alarmsTopic = new aws.sns.Topic("LettingsOpsAlarms", {
  displayName: `LettingsOps Alarms (${$app.stage})`,
});

// Email subscription. AWS sends a confirmation email on first deploy —
// the recipient must click the confirmation link once before alarms
// start delivering. `endpointAutoConfirms: false` is the AWS default and
// is what we want; we leave it explicit for grep-ability.
new aws.sns.TopicSubscription("LettingsOpsAlarmsEmail", {
  topic: alarmsTopic.arn,
  protocol: "email",
  endpoint: alarmEmail.value,
  endpointAutoConfirms: false,
});

// Function-name handles used by the alarms and dashboards below.
const apiFunctionName = apiRoute.nodes.function.name;
const emailProcessorFunctionName = emailProcessor.nodes.function.name;

// ── §4.1 Dashboards ─────────────────────────────────────────────────────────

// CloudWatch dashboards expect `dashboardBody` as a JSON string. The
// widget bodies below embed Pulumi `Output`s (Lambda function names,
// region) — `$jsonStringify` resolves those before serialising, so we
// can write the widget tree as a plain object.
const region = aws.getRegionOutput().name;

/** Ingestion — lead creation rate by source + OpenAI call latency. */
export const ingestionDashboard = new aws.cloudwatch.Dashboard(
  "LettingsOpsIngestionDashboard",
  {
    dashboardName: `LettingsOps-Ingestion-${$app.stage}`,
    dashboardBody: $jsonStringify({
      widgets: [
        {
          type: "metric",
          x: 0,
          y: 0,
          width: 12,
          height: 6,
          properties: {
            title: "Leads created (last hour, by source)",
            view: "timeSeries",
            stacked: false,
            region,
            period: 60,
            stat: "Sum",
            metrics: [
              ["LettingsOps", "LeadsCreated", "source", "email"],
              ["...", "phone"],
              ["...", "portal"],
              ["...", "manual"],
            ],
          },
        },
        {
          type: "metric",
          x: 12,
          y: 0,
          width: 12,
          height: 6,
          properties: {
            title: "OpenAI extraction duration (p50 / p95 / p99)",
            view: "timeSeries",
            stacked: false,
            region,
            period: 60,
            metrics: [
              [
                "AWS/Lambda",
                "Duration",
                "FunctionName",
                emailProcessorFunctionName,
                { stat: "p50" },
              ],
              ["...", { stat: "p95" }],
              ["...", { stat: "p99" }],
            ],
          },
        },
      ],
    }),
  },
);

/** Lambda health — invocations, errors, duration percentiles. */
export const lambdaHealthDashboard = new aws.cloudwatch.Dashboard(
  "LettingsOpsLambdaHealthDashboard",
  {
    dashboardName: `LettingsOps-LambdaHealth-${$app.stage}`,
    dashboardBody: $jsonStringify({
      widgets: [
        {
          type: "metric",
          x: 0,
          y: 0,
          width: 12,
          height: 6,
          properties: {
            title: "api.handler — invocations vs. errors",
            view: "timeSeries",
            stacked: false,
            region,
            period: 60,
            metrics: [
              [
                "AWS/Lambda",
                "Invocations",
                "FunctionName",
                apiFunctionName,
                { stat: "Sum" },
              ],
              [
                "AWS/Lambda",
                "Errors",
                "FunctionName",
                apiFunctionName,
                { stat: "Sum" },
              ],
            ],
          },
        },
        {
          type: "metric",
          x: 12,
          y: 0,
          width: 12,
          height: 6,
          properties: {
            title: "api.handler — duration percentiles",
            view: "timeSeries",
            stacked: false,
            region,
            period: 60,
            metrics: [
              [
                "AWS/Lambda",
                "Duration",
                "FunctionName",
                apiFunctionName,
                { stat: "p50" },
              ],
              ["...", { stat: "p95" }],
              ["...", { stat: "p99" }],
            ],
          },
        },
        {
          type: "metric",
          x: 0,
          y: 6,
          width: 12,
          height: 6,
          properties: {
            title: "emailProcessor.handler — invocations vs. errors",
            view: "timeSeries",
            stacked: false,
            region,
            period: 60,
            metrics: [
              [
                "AWS/Lambda",
                "Invocations",
                "FunctionName",
                emailProcessorFunctionName,
                { stat: "Sum" },
              ],
              [
                "AWS/Lambda",
                "Errors",
                "FunctionName",
                emailProcessorFunctionName,
                { stat: "Sum" },
              ],
            ],
          },
        },
        {
          type: "metric",
          x: 12,
          y: 6,
          width: 12,
          height: 6,
          properties: {
            title: "emailProcessor.handler — duration percentiles",
            view: "timeSeries",
            stacked: false,
            region,
            period: 60,
            metrics: [
              [
                "AWS/Lambda",
                "Duration",
                "FunctionName",
                emailProcessorFunctionName,
                { stat: "p50" },
              ],
              ["...", { stat: "p95" }],
              ["...", { stat: "p99" }],
            ],
          },
        },
      ],
    }),
  },
);

/** Email reputation — SES success/failure, bounce, complaint. */
export const emailReputationDashboard = new aws.cloudwatch.Dashboard(
  "LettingsOpsEmailReputationDashboard",
  {
    dashboardName: `LettingsOps-EmailReputation-${$app.stage}`,
    dashboardBody: $jsonStringify({
      widgets: [
        {
          type: "metric",
          x: 0,
          y: 0,
          width: 12,
          height: 6,
          properties: {
            title: "SES — Send vs. Delivery",
            view: "timeSeries",
            stacked: false,
            region,
            period: 300,
            stat: "Sum",
            metrics: [
              ["AWS/SES", "Send"],
              ["AWS/SES", "Delivery"],
            ],
          },
        },
        {
          type: "metric",
          x: 12,
          y: 0,
          width: 12,
          height: 6,
          properties: {
            title: "SES — Bounce + Complaint rate",
            view: "timeSeries",
            stacked: false,
            region,
            period: 300,
            stat: "Sum",
            metrics: [
              ["AWS/SES", "Bounce"],
              ["AWS/SES", "Complaint"],
              ["AWS/SES", "Reject"],
            ],
          },
        },
      ],
    }),
  },
);

// ── §4.2 Alarms ─────────────────────────────────────────────────────────────

/**
 * Lambda error rate > 1% over 5 minutes on `api.handler`. Implemented as
 * a metric-math expression rather than the raw Errors counter so that a
 * baseline of 0 invocations doesn't trip the alarm — a 1% rate of 0 is
 * undefined, and `treatMissingData: notBreaching` keeps quiet periods
 * from paging.
 */
export const lambdaErrorRateAlarm = new aws.cloudwatch.MetricAlarm(
  "LettingsOpsLambdaErrorRate",
  {
    alarmDescription:
      "api.handler error rate > 1% over 5 minutes — investigate Lambda errors / Sentry",
    comparisonOperator: "GreaterThanThreshold",
    evaluationPeriods: 1,
    threshold: 1,
    treatMissingData: "notBreaching",
    alarmActions: [alarmsTopic.arn],
    metricQueries: [
      {
        id: "errorRate",
        expression: "100 * (errors / IF(invocations > 0, invocations, 1))",
        label: "Error rate (%)",
        returnData: true,
      },
      {
        id: "errors",
        metric: {
          namespace: "AWS/Lambda",
          metricName: "Errors",
          dimensions: { FunctionName: apiFunctionName },
          period: 300,
          stat: "Sum",
        },
      },
      {
        id: "invocations",
        metric: {
          namespace: "AWS/Lambda",
          metricName: "Invocations",
          dimensions: { FunctionName: apiFunctionName },
          period: 300,
          stat: "Sum",
        },
      },
    ],
  },
);

/** Email-processor error rate > 5% over 5 minutes. Same math as above. */
export const emailProcessorFailureRateAlarm = new aws.cloudwatch.MetricAlarm(
  "LettingsOpsEmailProcessorFailureRate",
  {
    alarmDescription:
      "emailProcessor.handler error rate > 5% over 5 minutes — inbound email pipeline at risk",
    comparisonOperator: "GreaterThanThreshold",
    evaluationPeriods: 1,
    threshold: 5,
    treatMissingData: "notBreaching",
    alarmActions: [alarmsTopic.arn],
    metricQueries: [
      {
        id: "errorRate",
        expression: "100 * (errors / IF(invocations > 0, invocations, 1))",
        label: "Error rate (%)",
        returnData: true,
      },
      {
        id: "errors",
        metric: {
          namespace: "AWS/Lambda",
          metricName: "Errors",
          dimensions: { FunctionName: emailProcessorFunctionName },
          period: 300,
          stat: "Sum",
        },
      },
      {
        id: "invocations",
        metric: {
          namespace: "AWS/Lambda",
          metricName: "Invocations",
          dimensions: { FunctionName: emailProcessorFunctionName },
          period: 300,
          stat: "Sum",
        },
      },
    ],
  },
);

/**
 * ElevenLabs webhook failures — any non-2xx response from the API
 * Gateway HTTP API over 5 minutes. Uses the API-wide 5xx/4xx counters
 * since `$default` route doesn't dimensionalize per-path. If this
 * proves noisy we'll swap to a route-specific custom metric published
 * by the ElevenLabs handler in a follow-up.
 */
export const elevenLabsWebhookFailuresAlarm = new aws.cloudwatch.MetricAlarm(
  "LettingsOpsElevenLabsWebhookFailures",
  {
    alarmDescription:
      "ANY non-2xx HTTP response from the lettings API in the last 5 minutes — covers ElevenLabs webhook failures plus other 4xx/5xx",
    comparisonOperator: "GreaterThanOrEqualToThreshold",
    evaluationPeriods: 1,
    threshold: 1,
    treatMissingData: "notBreaching",
    alarmActions: [alarmsTopic.arn],
    metricQueries: [
      {
        id: "nonSuccess",
        expression: "fourXX + fiveXX",
        label: "Non-2xx responses",
        returnData: true,
      },
      {
        id: "fourXX",
        metric: {
          namespace: "AWS/ApiGateway",
          metricName: "4xx",
          dimensions: { ApiId: lettingsAPI.nodes.api.id },
          period: 300,
          stat: "Sum",
        },
      },
      {
        id: "fiveXX",
        metric: {
          namespace: "AWS/ApiGateway",
          metricName: "5xx",
          dimensions: { ApiId: lettingsAPI.nodes.api.id },
          period: 300,
          stat: "Sum",
        },
      },
    ],
  },
);

/** SES bounce rate > 2% over 15 minutes. SES already publishes the
 * `Reputation.BounceRate` metric as a fraction in [0,1]. */
export const sesBounceRateAlarm = new aws.cloudwatch.MetricAlarm(
  "LettingsOpsSesBounceRate",
  {
    alarmDescription:
      "SES bounce rate > 2% over 15 minutes — risk of SES sending pause",
    comparisonOperator: "GreaterThanThreshold",
    evaluationPeriods: 1,
    threshold: 0.02,
    treatMissingData: "notBreaching",
    alarmActions: [alarmsTopic.arn],
    namespace: "AWS/SES",
    metricName: "Reputation.BounceRate",
    period: 900,
    statistic: "Average",
  },
);

/** SES complaint rate > 0.1% over 15 minutes. */
export const sesComplaintRateAlarm = new aws.cloudwatch.MetricAlarm(
  "LettingsOpsSesComplaintRate",
  {
    alarmDescription:
      "SES complaint rate > 0.1% over 15 minutes — sender reputation at risk",
    comparisonOperator: "GreaterThanThreshold",
    evaluationPeriods: 1,
    threshold: 0.001,
    treatMissingData: "notBreaching",
    alarmActions: [alarmsTopic.arn],
    namespace: "AWS/SES",
    metricName: "Reputation.ComplaintRate",
    period: 900,
    statistic: "Average",
  },
);
