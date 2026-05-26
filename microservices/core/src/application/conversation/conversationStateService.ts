/**
 * ConversationStateService
 *
 * Manages conversation state and field collection for email conversations.
 * Provides both an Elysia plugin for HTTP handlers and a standalone function for Lambda.
 */
import Elysia from "elysia";
import type { ConversationTypeEnum } from "@lettingsops/db";
import { AgencyRepository } from "../repositories/agencyRepository";
import { ConversationRepository } from "../repositories/conversationRepository";

export type ConversationStateInput = {
  agencyId: string;
  tenantEmail: string;
  messageId: string;
  extractedFields: Record<string, string>; // partial — from LLM (or stub)
  conversationType: ConversationTypeEnum;
  leadId?: string;
};

export type ConversationStateResult = {
  conversationId: string;
  conversationType: ConversationTypeEnum;
  collectedFields: Record<string, string>;
  missingFields: string[]; // fieldKey values still not collected
  isComplete: boolean;
};

/**
 * Core logic for processing conversation state
 * Can be used directly without Elysia (e.g., in Lambda)
 */
export async function processConversationState(
  input: ConversationStateInput,
): Promise<ConversationStateResult> {
  // ConversationRepository is now tenant-scoped via its constructor.
  // input.agencyId is the resolved agency for this conversation — pass
  // it through so reads / writes are scope-checked at the DB.
  const conversationRepo = new ConversationRepository(
    undefined,
    input.agencyId,
  );
  const agencyRepo = new AgencyRepository();

  // 1. Find or create conversation
  let conversation = await conversationRepo.findByAgencyAndEmail(
    input.agencyId,
    input.tenantEmail,
  );

  if (!conversation) {
    conversation = await conversationRepo.create({
      tenantEmail: input.tenantEmail,
      leadId: input.leadId,
      conversationType: input.conversationType,
    });
  }

  // 2. Append message ID
  await conversationRepo.appendMessageId(conversation.id, input.messageId);

  // 3. Merge extracted fields into collected fields
  const mergedFields = {
    ...(conversation.collectedFields ?? {}),
    ...input.extractedFields,
  };

  // 4. Persist merged fields
  await conversationRepo.setCollectedFields(conversation.id, mergedFields);

  // 5. Get required fields for agency
  const requiredFields = await agencyRepo.getRequiredFields(input.agencyId);
  const requiredFieldKeys = requiredFields.map((f) => f.fieldKey);

  // 6. Type-aware routing
  let missingFields: string[];
  let isComplete: boolean;

  if (input.conversationType === "VIEWING_ENQUIRY") {
    // Full qualification loop
    missingFields = requiredFieldKeys.filter(
      (fieldKey) => !(fieldKey in mergedFields),
    );
    isComplete = missingFields.length === 0;
  } else {
    // MAINTENANCE_REQUEST / GENERAL_ENQUIRY / OTHER — skip qualification, log and complete
    missingFields = [];
    isComplete = true;
  }

  // 7. Mark complete if necessary
  if (isComplete) {
    await conversationRepo.markComplete(conversation.id);
  }

  // 8. Return result
  return {
    conversationId: conversation.id,
    conversationType: input.conversationType,
    collectedFields: mergedFields,
    missingFields,
    isComplete,
  };
}

/**
 * Elysia plugin for HTTP handlers
 */
export const ConversationStateService = new Elysia({
  name: "ConversationStateService",
}).decorate("conversationStateService", {
  async process(
    input: ConversationStateInput,
  ): Promise<ConversationStateResult> {
    return processConversationState(input);
  },
});
