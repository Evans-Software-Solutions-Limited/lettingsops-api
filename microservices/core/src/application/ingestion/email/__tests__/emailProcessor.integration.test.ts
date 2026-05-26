import { describe, it, expect, vi, beforeEach } from "vitest";
import { processEmail } from "../emailIngestionService";
import { processConversationState } from "../../../conversation/conversationStateService";
import { ANY_AGENCY } from "../../../repositories/tenantScopedRepository";

// Mock the repositories so we don't need real DB connections
const mockLeadRepo = {
  findByMessageId: vi.fn(),
  findByEmail: vi.fn(),
  create: vi.fn(),
  addNote: vi.fn(),
};

const mockConversationRepo = {
  findByAgencyAndEmail: vi.fn(),
  create: vi.fn(),
  appendMessageId: vi.fn(),
  setCollectedFields: vi.fn(),
  markComplete: vi.fn(),
};

const mockAgencyRepo = {
  getRequiredFields: vi.fn(),
};

vi.mock("../../../repositories/leadRepository", () => ({
  LeadRepository: vi.fn(() => mockLeadRepo),
}));

vi.mock("../../../repositories/conversationRepository", () => ({
  ConversationRepository: vi.fn(() => mockConversationRepo),
}));

vi.mock("../../../repositories/agencyRepository", () => ({
  AgencyRepository: vi.fn(() => mockAgencyRepo),
}));

describe("Email Processing Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLeadRepo.findByMessageId.mockResolvedValue(null);
    mockLeadRepo.findByEmail.mockResolvedValue(null);
    mockConversationRepo.findByAgencyAndEmail.mockResolvedValue(null);
  });

  it("LLM-extracted name should be passed through to lead creation", async () => {
    mockLeadRepo.create.mockResolvedValue({
      id: "lead-123",
      name: "John Smith",
      email: "john@example.com",
      source: "email",
      status: "NEW",
      createdAt: "2024-06-01T10:00:00.000Z",
      updatedAt: "2024-06-01T10:00:00.000Z",
    });

    const result = await processEmail(
      {
        messageId: "msg-llm-name",
        from: "john@example.com",
        fromName: "John Smith", // LLM-extracted name
        subject: "Enquiry",
        body: "Body",
        receivedAt: new Date().toISOString(),
      },
      ANY_AGENCY,
    );

    expect(result.action).toBe("CREATED");
    expect(result.leadId).toBe("lead-123");
    expect(mockLeadRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "John Smith",
      }),
    );
  });

  it("should fallback to email prefix when LLM name not available", async () => {
    mockLeadRepo.create.mockResolvedValue({
      id: "lead-fallback",
      name: "jane.doe",
      email: "jane.doe@example.com",
      source: "email",
      status: "NEW",
      createdAt: "2024-06-01T10:00:00.000Z",
      updatedAt: "2024-06-01T10:00:00.000Z",
    });

    const result = await processEmail(
      {
        messageId: "msg-no-llm-name",
        from: "jane.doe@example.com",
        // No fromName provided
        subject: "Enquiry",
        body: "Body",
        receivedAt: new Date().toISOString(),
      },
      ANY_AGENCY,
    );

    expect(result.action).toBe("CREATED");
    expect(mockLeadRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "jane.doe",
      }),
    );
  });

  it("lead creation should be idempotent for duplicate messageIds", async () => {
    const existingLead = {
      id: "lead-dup",
      name: "Test User",
      email: "test@example.com",
      source: "email",
      status: "NEW",
      createdAt: "2024-06-01T10:00:00.000Z",
      updatedAt: "2024-06-01T10:00:00.000Z",
    };

    mockLeadRepo.findByMessageId.mockResolvedValue(existingLead);

    const result = await processEmail(
      {
        messageId: "msg-dup",
        from: "test@example.com",
        fromName: "Test User",
        subject: "Enquiry",
        body: "Body",
        receivedAt: new Date().toISOString(),
      },
      ANY_AGENCY,
    );

    expect(result.action).toBe("IGNORED");
    expect(result.leadId).toBe("lead-dup");
    expect(mockLeadRepo.create).not.toHaveBeenCalled();
  });

  it("should merge emails from same sender", async () => {
    const existingLead = {
      id: "lead-merge",
      name: "User Name",
      email: "user@example.com",
      source: "email",
      status: "NEW",
      createdAt: "2024-06-01T10:00:00.000Z",
      updatedAt: "2024-06-01T10:00:00.000Z",
    };

    mockLeadRepo.findByMessageId.mockResolvedValue(null);
    mockLeadRepo.findByEmail.mockResolvedValue(existingLead);
    mockLeadRepo.addNote.mockResolvedValue(undefined);

    const result = await processEmail(
      {
        messageId: "msg-second",
        from: "user@example.com",
        fromName: "User Name",
        subject: "Follow-up",
        body: "More info",
        receivedAt: new Date().toISOString(),
      },
      ANY_AGENCY,
    );

    expect(result.action).toBe("MERGED");
    expect(result.leadId).toBe("lead-merge");
    expect(mockLeadRepo.addNote).toHaveBeenCalled();
    expect(mockLeadRepo.create).not.toHaveBeenCalled();
  });

  it("should extract and preserve all LLM-extracted fields", async () => {
    mockLeadRepo.create.mockResolvedValue({
      id: "lead-fields",
      name: "Alice Johnson",
      email: "alice@example.com",
      source: "email",
      status: "NEW",
      createdAt: "2024-06-01T10:00:00.000Z",
      updatedAt: "2024-06-01T10:00:00.000Z",
    });

    const result = await processEmail(
      {
        messageId: "msg-fields",
        from: "alice@example.com",
        fromName: "Alice Johnson", // LLM-extracted
        subject: "Enquiry",
        body: "Body with details",
        receivedAt: new Date().toISOString(),
      },
      ANY_AGENCY,
    );

    expect(result.action).toBe("CREATED");
    expect(mockLeadRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Alice Johnson", // Name from LLM takes precedence
        email: "alice@example.com",
        source: "email",
        status: "NEW",
      }),
    );
  });

  it("should handle processConversationState receiving leadId", async () => {
    const mockConversation = {
      id: "conv-123",
      agencyId: "agency-123",
      leadId: "lead-123",
      tenantEmail: "test@example.com",
      conversationType: "VIEWING_ENQUIRY" as const,
      threadMessageIds: ["msg-001"],
      collectedFields: { name: "Test User" },
      status: "active",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const mockRequiredFields = [
      {
        id: "field-1",
        agencyId: "agency-123",
        fieldKey: "phone",
        fieldLabel: "Phone",
        sortOrder: 0,
        createdAt: new Date(),
      },
    ];

    mockConversationRepo.findByAgencyAndEmail.mockResolvedValue(null);
    mockConversationRepo.create.mockResolvedValue(mockConversation);
    mockConversationRepo.appendMessageId.mockResolvedValue(undefined);
    mockConversationRepo.setCollectedFields.mockResolvedValue(undefined);
    mockAgencyRepo.getRequiredFields.mockResolvedValue(mockRequiredFields);

    const result = await processConversationState({
      agencyId: "agency-123",
      tenantEmail: "test@example.com",
      messageId: "msg-001",
      extractedFields: { name: "Test User" },
      conversationType: "VIEWING_ENQUIRY",
      leadId: "lead-123",
    });

    expect(result.conversationId).toBe("conv-123");
    // `agencyId` moved from a per-call arg to a constructor field on
    // ConversationRepository in Block E (E3c). The scope is verified
    // at the constructor site (see conversationStateService), not on
    // the create() input.
    expect(mockConversationRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        leadId: "lead-123",
      }),
    );
  });
});
