import { databaseUrl, emailDomain, openAIKey } from "./secrets";

const region = aws.getRegionOutput().name;
const callerIdentity = aws.getCallerIdentityOutput();

// Stage-specific SES rule set name so each stage (staging, production) gets its own; avoids AlreadyExists across stacks.
const receiptRuleSetName = `lettingsops-inbound-${$app.stage}`;

// S3 bucket to store raw inbound emails from SES.
// Policy includes SES write permission (SourceAccount + SourceArn required by AWS).
export const emailBucket = new sst.aws.Bucket("LettingsOpsEmailBucket", {
  policy: callerIdentity.apply((identity) =>
    region.apply((regionName) => [
      {
        actions: ["s3:PutObject"],
        principals: [
          { type: "service" as const, identifiers: ["ses.amazonaws.com"] },
        ],
        paths: ["*"],
        conditions: [
          {
            test: "StringEquals" as const,
            variable: "aws:SourceAccount",
            values: [identity.accountId],
          },
          {
            test: "StringEquals" as const,
            variable: "aws:SourceArn",
            values: [
              `arn:aws:ses:${regionName}:${identity.accountId}:receipt-rule-set/${receiptRuleSetName}:receipt-rule/store-in-s3`,
            ],
          },
        ],
      },
    ]),
  ),
});

// Email-processor Lambda — declared as an explicit `sst.aws.Function` so
// `infra/observability.ts` can target it for alarms and dashboards via
// `emailProcessor.nodes.function.name`. The bucket notification below
// then wires this function as the S3 ObjectCreated handler.
export const emailProcessor = new sst.aws.Function(
  "LettingsOpsEmailProcessor",
  {
    handler: "microservices/core/src/emailProcessor.handler",
    environment: {
      DATABASE_URL: databaseUrl.value,
      EMAIL_DOMAIN: emailDomain.value,
      EMAIL_BUCKET: emailBucket.name,
      OPENAI_API_KEY: openAIKey.value,
    },
    link: [emailBucket],
  },
);

// S3 event notification → email processor Lambda on ObjectCreated.
emailBucket.notify({
  notifications: [
    {
      name: "OnEmailReceived",
      function: emailProcessor.arn,
      events: ["s3:ObjectCreated:*"],
    },
  ],
});

// SES Receipt Rule Set — routes inbound email to S3 (name is per-stage to avoid AlreadyExists).
const receiptRuleSet = new aws.ses.ReceiptRuleSet("LettingsOpsRuleSet", {
  ruleSetName: receiptRuleSetName,
});

const activeReceiptRuleSet = new aws.ses.ActiveReceiptRuleSet(
  "LettingsOpsActiveRuleSet",
  { ruleSetName: receiptRuleSet.ruleSetName },
);

/** SES receipt rule that stores inbound email in S3; exported so the resource is retained and ordering is explicit. */
export const inboundReceiptRule = new aws.ses.ReceiptRule(
  "LettingsOpsInboundRule",
  {
    name: "store-in-s3",
    ruleSetName: receiptRuleSet.ruleSetName,
    enabled: true,
    recipients: [emailDomain.value],
    s3Actions: [
      {
        bucketName: emailBucket.name,
        objectKeyPrefix: "incoming/",
        position: 1,
      },
    ],
  },
  { dependsOn: [emailBucket, activeReceiptRuleSet] },
);
