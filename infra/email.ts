import { databaseUrl, emailDomain } from "./secrets";

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
        },
        link: [emailBucket],
      },
      events: ["s3:ObjectCreated:*"],
    },
  ],
});

// TODO: Domain verification required for SES. Set MX record to inbound-smtp.eu-west-2.amazonaws.com and verify domain in AWS SES.
