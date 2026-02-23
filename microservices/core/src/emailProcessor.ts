import type { S3Event } from "aws-lambda";
import { processConversationState } from "./application/conversation/conversationStateService";

export const handler = async (event: S3Event): Promise<void> => {
  console.log("Email processor triggered", JSON.stringify(event));

  try {
    // Parse the S3 event
    const record = event.Records[0];
    if (!record) {
      console.error("No S3 records in event");
      return;
    }

    const bucket = record.s3.bucket.name;
    const key = record.s3.object.key;

    console.log(`Processing email from S3: bucket=${bucket}, key=${key}`);

    // Call conversation state service with stub values
    // TODO: resolve agencyId from SES recipient address
    // TODO: parse tenantEmail from raw email
    // TODO: extract fields using LLM in future PR
    const result = await processConversationState({
      agencyId: "stub-agency-id",
      tenantEmail: "stub@example.com",
      messageId: key,
      extractedFields: {},
      leadId: undefined,
    });

    console.log("Conversation state processed", JSON.stringify(result));
  } catch (error) {
    console.error("Error processing email", error);
    throw error;
  }
};
