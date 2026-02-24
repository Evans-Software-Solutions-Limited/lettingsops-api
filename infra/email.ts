import { databaseUrl, emailDomain, openAIKey } from "./secrets";

// S3 bucket to store raw inbound emails from SES
export const emailBucket = new sst.aws.Bucket("LettingsOpsEmailBucket");

// S3 event notification → Lambda on ObjectCreated
emailBucket.notify({
  notifications: [
    {
      name: "OnEmailReceived",
      function: {
        handler: "microservices/core/src/emailProcessor.handler",
        environment: {
          DATABASE_URL: databaseUrl.value,
          EMAIL_DOMAIN: emailDomain.value,
          EMAIL_BUCKET: emailBucket.name,
          OPENAI_API_KEY: openAIKey.value,
        },
        link: [emailBucket],
      },
      events: ["s3:ObjectCreated:*"],
    },
  ],
});

// S3 bucket policy to allow SES to write emails to the bucket
const emailBucketPolicy = new aws.s3.BucketPolicy(
  "LettingsOpsEmailBucketPolicy",
  {
    bucket: emailBucket.name,
    policy: aws.getCallerIdentityOutput().apply((identity) =>
      emailBucket.arn.apply((bucketArn) =>
        JSON.stringify({
          Version: "2012-10-17",
          Statement: [
            {
              Sid: "AllowSESPuts",
              Effect: "Allow",
              Principal: {
                Service: "ses.amazonaws.com",
              },
              Action: "s3:PutObject",
              Resource: `${bucketArn}/*`,
              Condition: {
                StringEquals: {
                  "aws:SourceAccount": identity.accountId,
                },
              },
            },
          ],
        }),
      ),
    ),
  },
);

// SES Receipt Rule Set — routes inbound email to S3
const receiptRuleSet = new aws.ses.ReceiptRuleSet("LettingsOpsRuleSet", {
  ruleSetName: "lettingsops-inbound",
});

new aws.ses.ActiveReceiptRuleSet("LettingsOpsActiveRuleSet", {
  ruleSetName: receiptRuleSet.ruleSetName,
});

new aws.ses.ReceiptRule("LettingsOpsInboundRule", {
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
  dependsOn: [emailBucketPolicy],
});
