import type { S3Event } from "aws-lambda";
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import PostalMime from "postal-mime";
import OpenAI from "openai";
import { processConversationState } from "./application/conversation/conversationStateService";
import { processEmail } from "./application/ingestion/email/emailIngestionService";
import { AutoReplyService } from "./application/reply/autoReplyService";
import type { ConversationTypeEnum } from "@lettingsops/db";
import { getDb, agencies } from "@lettingsops/db";
import { eq } from "drizzle-orm";

const s3 = new S3Client({});
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const autoReplyService = new AutoReplyService();

export const handler = async (event: S3Event): Promise<void> => {
  console.log("Email processor triggered", JSON.stringify(event));

  try {
    const record = event.Records[0];
    if (!record) {
      console.error("No S3 records in event");
      return;
    }

    const bucket = record.s3.bucket.name;
    const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, " "));

    // 1. Fetch raw email from S3
    const s3Response = await s3.send(
      new GetObjectCommand({ Bucket: bucket, Key: key }),
    );
    const rawEmail = await s3Response.Body?.transformToByteArray();
    if (!rawEmail) throw new Error("Empty email body from S3");

    // 2. Parse email
    const parser = new PostalMime();
    const parsed = await parser.parse(Buffer.from(rawEmail));

    const tenantEmail = parsed.from?.address ?? "";
    const recipientEmail =
      parsed.to?.[0]?.address ?? process.env.EMAIL_DOMAIN ?? "";
    const emailBody = parsed.text ?? parsed.html ?? "";
    const subject = parsed.subject ?? "";

    if (!tenantEmail) {
      console.error("Could not determine sender email");
      return;
    }

    // 3. Resolve agencyId from recipient address
    const db = getDb();
    const agency = await db
      .select()
      .from(agencies)
      .where(eq(agencies.inboundEmail, recipientEmail))
      .limit(1)
      .then((rows: (typeof agencies.$inferSelect)[]) => rows[0]);

    if (!agency) {
      console.warn(`No agency found for recipient: ${recipientEmail}`);
      return;
    }

    // 4. LLM classification + field extraction
    const systemPrompt = `You are an AI assistant for a lettings agency.
Analyse the email and return JSON with:
- "type": one of "VIEWING_ENQUIRY" | "MAINTENANCE_REQUEST" | "GENERAL_ENQUIRY" | "OTHER"
- "fields": object of extracted fields — only include keys where the value is clearly present in the email:
  name, phone, employment_status, annual_salary, monthly_income, move_in_date, current_living_situation
Respond with valid JSON only, no markdown.`;

    const llmResponse = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Subject: ${subject}\n\n${emailBody}` },
      ],
      response_format: { type: "json_object" },
    });

    let conversationType: ConversationTypeEnum = "OTHER";
    let extractedFields: Record<string, string> = {};

    try {
      const llmParsed = JSON.parse(
        llmResponse.choices[0]?.message?.content ?? "{}",
      );
      conversationType = llmParsed.type ?? "OTHER";
      extractedFields = llmParsed.fields ?? {};
    } catch {
      console.warn("Failed to parse LLM response, defaulting to OTHER");
    }

    // 5. Create or merge lead from LLM-extracted data
    const ingestionResult = await processEmail({
      messageId: key,
      from: tenantEmail,
      fromName: extractedFields.name, // Use LLM-extracted name if available
      subject,
      body: emailBody,
      receivedAt: new Date().toISOString(),
    });

    const leadId = ingestionResult.leadId;
    console.log(
      `Lead ${ingestionResult.action}:`,
      leadId,
      JSON.stringify(ingestionResult),
    );

    // 6. Process conversation state with leadId
    const result = await processConversationState({
      agencyId: agency.id,
      tenantEmail,
      messageId: key,
      extractedFields,
      conversationType,
      leadId,
    });

    console.log("Conversation state processed", JSON.stringify(result));

    // 7. Send auto-reply to tenant
    await autoReplyService.sendReply({
      result,
      tenantEmail,
      agencyId: agency.id,
      propertyRef: extractedFields.property_ref,
    });

    console.log("Auto-reply sent for conversation", result.conversationId);
  } catch (error) {
    console.error("Error processing email", error);
    throw error;
  }
};
