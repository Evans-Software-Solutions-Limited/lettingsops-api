/**
 * AutoReplyService
 *
 * Sends automated SES replies to tenants based on conversation state.
 * Handles three reply paths:
 * 1. VIEWING_ENQUIRY + incomplete: send all missing qualification questions in one email
 * 2. VIEWING_ENQUIRY + complete: send acknowledgement
 * 3. MAINTENANCE_REQUEST / GENERAL_ENQUIRY: send acknowledgement
 */
import { SendEmailCommand, SESClient } from "@aws-sdk/client-ses";
import type { ConversationStateResult } from "../conversation/conversationStateService";
import { AgencyRepository } from "../repositories/agencyRepository";
import { logger } from "@lettingsops/api-utils/logger";

/**
 * Friendly mapping of field keys to human-readable questions
 */
const fieldToQuestionMap: Record<string, string> = {
  name: "What is your full name?",
  email: "What is your email address?",
  phone: "What is your phone number?",
  employment_status: "What is your current employment status?",
  annual_salary: "What is your approximate annual salary?",
  move_in_date: "When are you looking to move in?",
  current_living_situation: "What is your current living situation?",
  monthly_income: "What is your approximate monthly income?",
};

export interface SESEmailSender {
  send(params: {
    Source: string;
    Destination: { ToAddresses: string[] };
    Message: {
      Subject: { Data: string; Charset: string };
      Body: { Html: { Data: string; Charset: string } };
    };
  }): Promise<void>;
}

/**
 * Default SES client wrapper
 */
class DefaultSESClient implements SESEmailSender {
  private client: SESClient;

  constructor() {
    this.client = new SESClient({});
  }

  async send(params: {
    Source: string;
    Destination: { ToAddresses: string[] };
    Message: {
      Subject: { Data: string; Charset: string };
      Body: { Html: { Data: string; Charset: string } };
    };
  }): Promise<void> {
    await this.client.send(
      new SendEmailCommand({
        Source: params.Source,
        Destination: params.Destination,
        Message: params.Message,
      }),
    );
  }
}

export interface AutoReplyServiceInput {
  result: ConversationStateResult;
  tenantEmail: string;
  agencyId: string;
  propertyRef?: string;
}

export class AutoReplyService {
  static readonly key = "AutoReplyService";

  private sesSender: SESEmailSender;
  private agencyRepository: AgencyRepository;
  private defaultFromEmail: string;

  constructor(sesSender?: SESEmailSender, agencyRepository?: AgencyRepository) {
    this.sesSender = sesSender ?? new DefaultSESClient();
    this.agencyRepository = agencyRepository ?? new AgencyRepository();
    // Default from email can be overridden via env var or agency config
    this.defaultFromEmail =
      process.env.AUTO_REPLY_FROM_EMAIL ?? "noreply@lettingsops.com";
  }

  async sendReply(input: AutoReplyServiceInput): Promise<void> {
    const { result, tenantEmail, agencyId, propertyRef } = input;

    // Get agency name for personalization
    const agency = await this.agencyRepository.findById(agencyId);
    const agencyName = agency?.name ?? "Our Team";

    let subject: string;
    let htmlBody: string;

    if (result.conversationType === "VIEWING_ENQUIRY") {
      if (!result.isComplete) {
        // Incomplete viewing enquiry — ask for all missing fields in one email
        const questions = result.missingFields.map(
          (fieldKey) => fieldToQuestionMap[fieldKey] ?? `${fieldKey}?`,
        );
        subject =
          result.missingFields.length === 1
            ? `Thanks for your interest! One more thing...`
            : `Thanks for your interest — a few details we need`;

        htmlBody = this.buildQualificationEmailHtml({
          agencyName,
          propertyRef,
          questions,
        });
      } else {
        // Complete viewing enquiry — send acknowledgement
        subject = `Thanks for your interest — we'll be in touch!`;
        htmlBody = this.buildCompleteEnquiryEmailHtml({
          agencyName,
          propertyRef,
        });
      }
    } else if (
      result.conversationType === "MAINTENANCE_REQUEST" ||
      result.conversationType === "GENERAL_ENQUIRY"
    ) {
      // Maintenance request or general enquiry — simple acknowledgement
      subject = "We've received your message";
      const inquiryType =
        result.conversationType === "MAINTENANCE_REQUEST"
          ? "maintenance request"
          : "enquiry";
      htmlBody = this.buildAcknowledgementEmailHtml({
        agencyName,
        inquiryType,
      });
    } else {
      // OTHER type — generic acknowledgement
      subject = "We've received your message";
      htmlBody = this.buildAcknowledgementEmailHtml({
        agencyName,
        inquiryType: "message",
      });
    }

    // Send the email
    await this.sesSender.send({
      Source: this.defaultFromEmail,
      Destination: { ToAddresses: [tenantEmail] },
      Message: {
        Subject: { Data: subject, Charset: "UTF-8" },
        Body: { Html: { Data: htmlBody, Charset: "UTF-8" } },
      },
    });

    // Drop tenantEmail from the structured log: it's PII and the
    // conversationId + agencyId pair is enough to correlate downstream.
    logger.info("Auto-reply sent", {
      agencyId,
      conversationId: result.conversationId,
    });
  }

  private buildQualificationEmailHtml(params: {
    agencyName: string;
    propertyRef?: string;
    questions: string[];
  }): string {
    const { agencyName, propertyRef, questions } = params;
    const propertyLine = propertyRef
      ? ` for property <strong>${propertyRef}</strong>`
      : "";
    const questionsHtml = questions
      .map((q) => `<li class="question-item"><strong>${q}</strong></li>`)
      .join("\n        ");

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; color: #333; line-height: 1.6; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
    .content { margin: 20px 0; }
    .questions-list { padding-left: 1.5em; margin: 15px 0; }
    .question-item { background-color: #e8f4f8; padding: 12px 15px; border-left: 4px solid #0066cc; margin: 10px 0; }
    .footer { font-size: 12px; color: #999; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2>Thanks for your interest${propertyLine}!</h2>
    </div>
    <div class="content">
      <p>To help us find the best match for you, could you please reply with:</p>
      <ol class="questions-list">
        ${questionsHtml}
      </ol>
      <p>Reply to this email with your answers, and we'll take it from here.</p>
    </div>
    <div class="footer">
      <p>Best regards,<br>${agencyName}</p>
      <p>We're here to help — reply to this email anytime.</p>
    </div>
  </div>
</body>
</html>
    `.trim();
  }

  private buildCompleteEnquiryEmailHtml(params: {
    agencyName: string;
    propertyRef?: string;
  }): string {
    const { agencyName, propertyRef } = params;
    const propertyLine = propertyRef
      ? ` for <strong>${propertyRef}</strong>`
      : "";

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; color: #333; line-height: 1.6; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #f0f8f0; padding: 15px; border-radius: 5px; margin-bottom: 20px; border-left: 4px solid #00aa00; }
    .content { margin: 20px 0; }
    .footer { font-size: 12px; color: #999; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2>Thanks${propertyLine} — we have everything we need!</h2>
    </div>
    <div class="content">
      <p>We've received all the information we need to move forward with your application.</p>
      <p>Our team will review your details and get back to you shortly with next steps.</p>
      <p>In the meantime, if you have any questions, feel free to reply to this email.</p>
    </div>
    <div class="footer">
      <p>Best regards,<br>${agencyName}</p>
      <p>We look forward to helping you find your next home.</p>
    </div>
  </div>
</body>
</html>
    `.trim();
  }

  private buildAcknowledgementEmailHtml(params: {
    agencyName: string;
    inquiryType: string;
  }): string {
    const { agencyName, inquiryType } = params;

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; color: #333; line-height: 1.6; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
    .content { margin: 20px 0; }
    .footer { font-size: 12px; color: #999; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2>We've received your ${inquiryType}</h2>
    </div>
    <div class="content">
      <p>Thank you for getting in touch with us. We've received your ${inquiryType} and our team will get back to you as soon as possible.</p>
      <p>We appreciate your patience and look forward to helping you.</p>
    </div>
    <div class="footer">
      <p>Best regards,<br>${agencyName}</p>
      <p>If you need anything in the meantime, feel free to reply to this email.</p>
    </div>
  </div>
</body>
</html>
    `.trim();
  }
}
