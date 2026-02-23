/**
 * ConversationStateService
 *
 * Manages conversation state and field collection for email conversations.
 * Provides both an Elysia plugin for HTTP handlers and a standalone function for Lambda.
 */
import Elysia from "elysia";
import { AgencyRepository } from "../repositories/agencyRepository";
import { ConversationRepository } from "../repositories/conversationRepository";

export type ConversationStateInput = {
  agencyId: string;
  tenantEmail: string;
  messageId: string;
  extractedFields: Record<string, string>; // partial — from LLM (or stub)
  leadId?: string;
};

export type ConversationStateResult = {
  conversationId: string;
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
  const conversationRepo = new ConversationRepository();
  const agencyRepo = new AgencyRepository();

  // 1. Find or create conversation
  let conversation = await conversationRepo.findByAgencyAndEmail(
    input.agencyId,
    input.tenantEmail,
  );

  if (!conversation) {
    conversation = await conversationRepo.create({
      agencyId: input.agencyId,
      tenantEmail: input.tenantEmail,
      leadId: input.leadId,
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

  // 6. Identify missing fields
  const missingFields = requiredFieldKeys.filter(
    (fieldKey) => !(fieldKey in mergedFields),
  );

  // 7. Determine completion
  const isComplete = missingFields.length === 0;

  // 8. Mark complete if necessary
  if (isComplete) {
    await conversationRepo.markComplete(conversation.id);
  }

  // 9. Return result
  return {
    conversationId: conversation.id,
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
