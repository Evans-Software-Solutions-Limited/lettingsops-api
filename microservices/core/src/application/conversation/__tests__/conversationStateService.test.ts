import { describe, it, expect, vi, beforeEach } from "vitest";
import { processConversationState } from "../conversationStateService";
import { ConversationRepository } from "../../repositories/conversationRepository";
import { AgencyRepository } from "../../repositories/agencyRepository";

// Mock the repositories
vi.mock("../../repositories/conversationRepository", () => ({
  ConversationRepository: vi.fn(),
}));
vi.mock("../../repositories/agencyRepository", () => ({
  AgencyRepository: vi.fn(),
}));

const NOW = new Date("2024-06-01T10:00:00.000Z");

const mockConversation = {
  id: "conv-uuid-1",
  agencyId: "agency-uuid-1",
  leadId: "lead-uuid-1",
  tenantEmail: "tenant@example.com",
  threadMessageIds: ["msg-001"],
  collectedFields: { name: "John Doe" },
  status: "active",
  createdAt: NOW,
  updatedAt: NOW,
};

const mockRequiredFields = [
  {
    id: "field-uuid-1",
    agencyId: "agency-uuid-1",
    fieldKey: "name",
    fieldLabel: "Full Name",
    sortOrder: 0,
    createdAt: NOW,
  },
  {
    id: "field-uuid-2",
    agencyId: "agency-uuid-1",
    fieldKey: "email",
    fieldLabel: "Email Address",
    sortOrder: 1,
    createdAt: NOW,
  },
  {
    id: "field-uuid-3",
    agencyId: "agency-uuid-1",
    fieldKey: "phone",
    fieldLabel: "Phone Number",
    sortOrder: 2,
    createdAt: NOW,
  },
];

describe("ConversationStateService", () => {
  let mockConversationRepo: {
    findByAgencyAndEmail: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    appendMessageId: ReturnType<typeof vi.fn>;
    setCollectedFields: ReturnType<typeof vi.fn>;
    markComplete: ReturnType<typeof vi.fn>;
  };
  let mockAgencyRepo: {
    getRequiredFields: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockConversationRepo = {
      findByAgencyAndEmail: vi.fn(),
      create: vi.fn(),
      appendMessageId: vi.fn(),
      setCollectedFields: vi.fn(),
      markComplete: vi.fn(),
    };

    mockAgencyRepo = {
      getRequiredFields: vi.fn(),
    };

    // Mock the repository constructors
    (
      ConversationRepository as unknown as ReturnType<typeof vi.fn>
    ).mockImplementation(() => mockConversationRepo);
    (
      AgencyRepository as unknown as ReturnType<typeof vi.fn>
    ).mockImplementation(() => mockAgencyRepo);
  });

  describe("new conversation", () => {
    it("creates a new conversation, merges fields, identifies missing, returns correct result", async () => {
      // Setup: no existing conversation
      mockConversationRepo.findByAgencyAndEmail.mockResolvedValue(null);
      mockConversationRepo.create.mockResolvedValue(mockConversation);
      mockAgencyRepo.getRequiredFields.mockResolvedValue(mockRequiredFields);

      const result = await processConversationState({
        agencyId: "agency-uuid-1",
        tenantEmail: "tenant@example.com",
        messageId: "msg-002",
        extractedFields: { email: "john@example.com" },
      });

      // Assertions
      expect(mockConversationRepo.findByAgencyAndEmail).toHaveBeenCalledOnce();
      expect(mockConversationRepo.create).toHaveBeenCalledOnce();
      expect(mockConversationRepo.appendMessageId).toHaveBeenCalledWith(
        "conv-uuid-1",
        "msg-002",
      );

      expect(result.conversationId).toBe("conv-uuid-1");
      expect(result.collectedFields).toMatchObject({
        name: "John Doe",
        email: "john@example.com",
      });
      expect(result.missingFields).toContain("phone");
      expect(result.isComplete).toBe(false);
    });

    it("does not call markComplete when fields are still missing", async () => {
      mockConversationRepo.findByAgencyAndEmail.mockResolvedValue(null);
      mockConversationRepo.create.mockResolvedValue(mockConversation);
      mockAgencyRepo.getRequiredFields.mockResolvedValue(mockRequiredFields);

      await processConversationState({
        agencyId: "agency-uuid-1",
        tenantEmail: "tenant@example.com",
        messageId: "msg-002",
        extractedFields: { email: "john@example.com" },
      });

      expect(mockConversationRepo.markComplete).not.toHaveBeenCalled();
    });
  });

  describe("existing conversation", () => {
    it("merges new fields on top of existing", async () => {
      mockConversationRepo.findByAgencyAndEmail.mockResolvedValue(
        mockConversation,
      );
      mockAgencyRepo.getRequiredFields.mockResolvedValue(mockRequiredFields);

      const result = await processConversationState({
        agencyId: "agency-uuid-1",
        tenantEmail: "tenant@example.com",
        messageId: "msg-002",
        extractedFields: { email: "john@example.com", phone: "+447700900001" },
      });

      // Should have name from existing + merged fields
      expect(result.collectedFields).toMatchObject({
        name: "John Doe", // from existing
        email: "john@example.com", // newly extracted
        phone: "+447700900001", // newly extracted
      });
      expect(result.missingFields).toHaveLength(0);
      expect(result.isComplete).toBe(true);
    });
  });

  describe("completion", () => {
    it("marks complete when all required fields are collected", async () => {
      mockConversationRepo.findByAgencyAndEmail.mockResolvedValue(
        mockConversation,
      );
      mockAgencyRepo.getRequiredFields.mockResolvedValue(mockRequiredFields);

      await processConversationState({
        agencyId: "agency-uuid-1",
        tenantEmail: "tenant@example.com",
        messageId: "msg-002",
        extractedFields: { email: "john@example.com", phone: "+447700900001" },
      });

      expect(mockConversationRepo.markComplete).toHaveBeenCalledOnce();
      expect(mockConversationRepo.markComplete).toHaveBeenCalledWith(
        "conv-uuid-1",
      );
    });

    it("returns isComplete = true when all required fields collected", async () => {
      mockConversationRepo.findByAgencyAndEmail.mockResolvedValue(
        mockConversation,
      );
      mockAgencyRepo.getRequiredFields.mockResolvedValue(mockRequiredFields);

      const result = await processConversationState({
        agencyId: "agency-uuid-1",
        tenantEmail: "tenant@example.com",
        messageId: "msg-002",
        extractedFields: { email: "john@example.com", phone: "+447700900001" },
      });

      expect(result.isComplete).toBe(true);
      expect(result.missingFields).toHaveLength(0);
    });

    it("returns isComplete = false when fields still missing", async () => {
      mockConversationRepo.findByAgencyAndEmail.mockResolvedValue(
        mockConversation,
      );
      mockAgencyRepo.getRequiredFields.mockResolvedValue(mockRequiredFields);

      const result = await processConversationState({
        agencyId: "agency-uuid-1",
        tenantEmail: "tenant@example.com",
        messageId: "msg-002",
        extractedFields: { email: "john@example.com" },
      });

      expect(result.isComplete).toBe(false);
      expect(result.missingFields).toContain("phone");
    });
  });

  describe("field merging", () => {
    it("new fields override existing ones with same key", async () => {
      mockConversationRepo.findByAgencyAndEmail.mockResolvedValue(
        mockConversation,
      );
      mockAgencyRepo.getRequiredFields.mockResolvedValue(mockRequiredFields);

      const result = await processConversationState({
        agencyId: "agency-uuid-1",
        tenantEmail: "tenant@example.com",
        messageId: "msg-002",
        extractedFields: { name: "Jane Doe" }, // Override existing name
      });

      expect(result.collectedFields.name).toBe("Jane Doe");
    });
  });
});
