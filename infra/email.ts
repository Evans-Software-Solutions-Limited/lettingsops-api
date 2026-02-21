import * as sst from "sst";

// Secret for the inbound email domain (e.g. "inbound.lettingsops.io")
const emailDomain = new sst.Secret("LettingsOpsEmailDomain");

// S3 bucket to store raw inbound emails from SES
export const emailBucket = new sst.aws.Bucket("LettingsOpsEmailBucket");

// Lambda that processes inbound emails (triggered by S3)
export const emailProcessorFn = new sst.aws.Function("EmailProcessor", {
  handler: "microservices/core/src/emailProcessor.handler",
  environment: {
    DATABASE_URL: new sst.Secret("LettingsOpsDatabaseUrl").value,
    EMAIL_DOMAIN: emailDomain.value,
    EMAIL_BUCKET: emailBucket.name,
  },
  link: [emailBucket],
});

// S3 event notification → Lambda on ObjectCreated
emailBucket.notify({
  notifications: [
    {
      name: "OnEmailReceived",
      function: emailProcessorFn,
      events: ["s3:ObjectCreated:*"],
    },
  ],
});

// TODO: Domain verification required for SES. Set MX record to inbound-smtp.eu-west-2.amazonaws.com and verify domain in AWS SES.
