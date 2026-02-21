import type { S3Event } from "aws-lambda";

export const handler = async (event: S3Event): Promise<void> => {
  console.log("Email processor triggered", JSON.stringify(event));
  // TODO: parse email from S3, run conversation state service, auto-reply if needed
};
