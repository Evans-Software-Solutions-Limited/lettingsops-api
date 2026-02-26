import { describe, it, expect, vi, beforeEach } from "vitest";
import { AutoReplyService, type SESEmailSender } from "../autoReplyService";
import type { AgencyRepository } from "../../repositories/agencyRepository";
import type { ConversationStateResult } from "../../conversation/conversationStateService";

const NOW = new Date("2024-06-01T10:00:00.000Z");

// Mock SES sender
const mockSESender: SESEmailSender = {
  send: vi.fn(),
};

// Mock agency repository
const mockAgencyRepository = {
  findById: vi.fn(),
  getRequiredFields: vi.fn(),
} as unknown as AgencyRepository;

describe("AutoReplyService", () => {
  let service: AutoReplyService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AutoReplyService(mockSESender, mockAgencyRepository);
  });

  describe("VIEWING_ENQUIRY - incomplete", () => {
    it("should send qualification question email for incomplete viewing enquiry", async () => {
      const result: ConversationStateResult = {
        conversationId: "conv-uuid-1",
        conversationType: "VIEWING_ENQUIRY",
        collectedFields: { name: "John Doe" },
        missingFields: ["email", "phone", "move_in_date"],
        isComplete: false,
      };

      vi.mocked(mockAgencyRepository.findById).mockResolvedValue({
        id: "agency-uuid-1",
        name: "Premier Lettings",
        inboundEmail: "hello@premierlets.com",
        createdAt: NOW,
        updatedAt: NOW,
      });

      await service.sendReply({
        result,
        tenantEmail: "john@example.com",
        agencyId: "agency-uuid-1",
        propertyRef: "PROP-001",
      });

      expect(mockSESender.send).toHaveBeenCalledOnce();

      const callArgs = vi.mocked(mockSESender.send).mock.calls[0][0];
      expect(callArgs.Source).toBe("noreply@lettingsops.com");
      expect(callArgs.Destination.ToAddresses).toEqual(["john@example.com"]);
      expect(callArgs.Message.Subject.Data).toContain("a few details we need");

      // Check that email body contains the property ref and all missing questions
      const htmlBody = callArgs.Message.Body.Html.Data;
      expect(htmlBody).toContain("PROP-001");
      expect(htmlBody).toContain("What is your email address?");
      expect(htmlBody).toContain("What is your phone number?");
      expect(htmlBody).toContain("When are you looking to move in?");
      expect(htmlBody).toContain("Premier Lettings");
    });

    it("should handle custom field to question mapping", async () => {
      const result: ConversationStateResult = {
        conversationId: "conv-uuid-2",
        conversationType: "VIEWING_ENQUIRY",
        collectedFields: { name: "Jane Doe" },
        missingFields: ["monthly_income"],
        isComplete: false,
      };

      vi.mocked(mockAgencyRepository.findById).mockResolvedValue({
        id: "agency-uuid-1",
        name: "Test Agency",
        inboundEmail: "test@agency.com",
        createdAt: NOW,
        updatedAt: NOW,
      });

      await service.sendReply({
        result,
        tenantEmail: "jane@example.com",
        agencyId: "agency-uuid-1",
      });

      const callArgs = vi.mocked(mockSESender.send).mock.calls[0][0];
      const htmlBody = callArgs.Message.Body.Html.Data;
      expect(htmlBody).toContain("approximate monthly income");
    });

    it("should use agency name from repository", async () => {
      const result: ConversationStateResult = {
        conversationId: "conv-uuid-3",
        conversationType: "VIEWING_ENQUIRY",
        collectedFields: {},
        missingFields: ["name"],
        isComplete: false,
      };

      vi.mocked(mockAgencyRepository.findById).mockResolvedValue({
        id: "agency-uuid-2",
        name: "Acme Properties Ltd",
        inboundEmail: "contact@acme.com",
        createdAt: NOW,
        updatedAt: NOW,
      });

      await service.sendReply({
        result,
        tenantEmail: "user@example.com",
        agencyId: "agency-uuid-2",
      });

      const callArgs = vi.mocked(mockSESender.send).mock.calls[0][0];
      const htmlBody = callArgs.Message.Body.Html.Data;
      expect(htmlBody).toContain("Acme Properties Ltd");
    });

    it("should handle missing agency gracefully", async () => {
      const result: ConversationStateResult = {
        conversationId: "conv-uuid-4",
        conversationType: "VIEWING_ENQUIRY",
        collectedFields: {},
        missingFields: ["email"],
        isComplete: false,
      };

      vi.mocked(mockAgencyRepository.findById).mockResolvedValue(null);

      await service.sendReply({
        result,
        tenantEmail: "user@example.com",
        agencyId: "agency-uuid-999",
      });

      const callArgs = vi.mocked(mockSESender.send).mock.calls[0][0];
      const htmlBody = callArgs.Message.Body.Html.Data;
      // Should default to "Our Team" when agency not found
      expect(htmlBody).toContain("Our Team");
    });
  });

  describe("VIEWING_ENQUIRY - complete", () => {
    it("should send completion acknowledgement for complete viewing enquiry", async () => {
      const result: ConversationStateResult = {
        conversationId: "conv-uuid-5",
        conversationType: "VIEWING_ENQUIRY",
        collectedFields: {
          name: "John Doe",
          email: "john@example.com",
          phone: "07700123456",
          move_in_date: "2024-08-01",
        },
        missingFields: [],
        isComplete: true,
      };

      vi.mocked(mockAgencyRepository.findById).mockResolvedValue({
        id: "agency-uuid-1",
        name: "Premier Lettings",
        inboundEmail: "hello@premierlets.com",
        createdAt: NOW,
        updatedAt: NOW,
      });

      await service.sendReply({
        result,
        tenantEmail: "john@example.com",
        agencyId: "agency-uuid-1",
        propertyRef: "PROP-002",
      });

      expect(mockSESender.send).toHaveBeenCalledOnce();

      const callArgs = vi.mocked(mockSESender.send).mock.calls[0][0];
      expect(callArgs.Message.Subject.Data).toContain("in touch");

      const htmlBody = callArgs.Message.Body.Html.Data;
      expect(htmlBody).toContain("PROP-002");
      expect(htmlBody).toContain("we have everything we need");
      expect(htmlBody).toContain("Premier Lettings");
      expect(htmlBody).not.toContain("remaining");
    });

    it("should include property ref in subject when available", async () => {
      const result: ConversationStateResult = {
        conversationId: "conv-uuid-6",
        conversationType: "VIEWING_ENQUIRY",
        collectedFields: { name: "Jane" },
        missingFields: [],
        isComplete: true,
      };

      vi.mocked(mockAgencyRepository.findById).mockResolvedValue({
        id: "agency-uuid-1",
        name: "Test Agency",
        inboundEmail: "test@agency.com",
        createdAt: NOW,
        updatedAt: NOW,
      });

      await service.sendReply({
        result,
        tenantEmail: "jane@example.com",
        agencyId: "agency-uuid-1",
        propertyRef: "FLAT-42",
      });

      const callArgs = vi.mocked(mockSESender.send).mock.calls[0][0];
      const htmlBody = callArgs.Message.Body.Html.Data;
      expect(htmlBody).toContain("FLAT-42");
    });
  });

  describe("MAINTENANCE_REQUEST", () => {
    it("should send acknowledgement for maintenance request", async () => {
      const result: ConversationStateResult = {
        conversationId: "conv-uuid-7",
        conversationType: "MAINTENANCE_REQUEST",
        collectedFields: { issue: "Leaky tap" },
        missingFields: [],
        isComplete: true,
      };

      vi.mocked(mockAgencyRepository.findById).mockResolvedValue({
        id: "agency-uuid-1",
        name: "Property Management Co",
        inboundEmail: "maintenance@propmanage.com",
        createdAt: NOW,
        updatedAt: NOW,
      });

      await service.sendReply({
        result,
        tenantEmail: "tenant@example.com",
        agencyId: "agency-uuid-1",
      });

      expect(mockSESender.send).toHaveBeenCalledOnce();

      const callArgs = vi.mocked(mockSESender.send).mock.calls[0][0];
      expect(callArgs.Message.Subject.Data).toContain("received your");

      const htmlBody = callArgs.Message.Body.Html.Data;
      expect(htmlBody).toContain("maintenance request");
      expect(htmlBody).toContain("Property Management Co");
    });
  });

  describe("GENERAL_ENQUIRY", () => {
    it("should send acknowledgement for general enquiry", async () => {
      const result: ConversationStateResult = {
        conversationId: "conv-uuid-8",
        conversationType: "GENERAL_ENQUIRY",
        collectedFields: { question: "Do you have any properties available?" },
        missingFields: [],
        isComplete: true,
      };

      vi.mocked(mockAgencyRepository.findById).mockResolvedValue({
        id: "agency-uuid-1",
        name: "General Lettings",
        inboundEmail: "info@generallets.com",
        createdAt: NOW,
        updatedAt: NOW,
      });

      await service.sendReply({
        result,
        tenantEmail: "enquiry@example.com",
        agencyId: "agency-uuid-1",
      });

      const callArgs = vi.mocked(mockSESender.send).mock.calls[0][0];
      const htmlBody = callArgs.Message.Body.Html.Data;
      expect(htmlBody).toContain("enquiry");
      expect(htmlBody).toContain("General Lettings");
    });
  });

  describe("OTHER type", () => {
    it("should send generic acknowledgement for OTHER type", async () => {
      const result: ConversationStateResult = {
        conversationId: "conv-uuid-9",
        conversationType: "OTHER",
        collectedFields: { content: "Some message" },
        missingFields: [],
        isComplete: true,
      };

      vi.mocked(mockAgencyRepository.findById).mockResolvedValue({
        id: "agency-uuid-1",
        name: "Other Agency",
        inboundEmail: "contact@other.com",
        createdAt: NOW,
        updatedAt: NOW,
      });

      await service.sendReply({
        result,
        tenantEmail: "other@example.com",
        agencyId: "agency-uuid-1",
      });

      const callArgs = vi.mocked(mockSESender.send).mock.calls[0][0];
      const htmlBody = callArgs.Message.Body.Html.Data;
      expect(htmlBody).toContain("message");
      expect(htmlBody).toContain("Other Agency");
    });
  });

  describe("Email structure", () => {
    it("should always include proper email structure and charset", async () => {
      const result: ConversationStateResult = {
        conversationId: "conv-uuid-10",
        conversationType: "VIEWING_ENQUIRY",
        collectedFields: {},
        missingFields: ["name"],
        isComplete: false,
      };

      vi.mocked(mockAgencyRepository.findById).mockResolvedValue({
        id: "agency-uuid-1",
        name: "Test",
        inboundEmail: "test@test.com",
        createdAt: NOW,
        updatedAt: NOW,
      });

      await service.sendReply({
        result,
        tenantEmail: "test@example.com",
        agencyId: "agency-uuid-1",
      });

      const callArgs = vi.mocked(mockSESender.send).mock.calls[0][0];
      expect(callArgs.Message.Subject.Charset).toBe("UTF-8");
      expect(callArgs.Message.Body.Html.Charset).toBe("UTF-8");

      const htmlBody = callArgs.Message.Body.Html.Data;
      expect(htmlBody).toContain("<!DOCTYPE html>");
      expect(htmlBody).toContain("<html>");
      expect(htmlBody).toContain("</html>");
      expect(htmlBody).toContain("<meta charset");
    });

    it("should always send from configured email address", async () => {
      const result: ConversationStateResult = {
        conversationId: "conv-uuid-11",
        conversationType: "GENERAL_ENQUIRY",
        collectedFields: {},
        missingFields: [],
        isComplete: true,
      };

      vi.mocked(mockAgencyRepository.findById).mockResolvedValue({
        id: "agency-uuid-1",
        name: "Test",
        inboundEmail: "test@test.com",
        createdAt: NOW,
        updatedAt: NOW,
      });

      await service.sendReply({
        result,
        tenantEmail: "user@example.com",
        agencyId: "agency-uuid-1",
      });

      const callArgs = vi.mocked(mockSESender.send).mock.calls[0][0];
      expect(callArgs.Source).toBe("noreply@lettingsops.com");
    });
  });

  describe("Logging", () => {
    it("should log successful reply send", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      const result: ConversationStateResult = {
        conversationId: "conv-uuid-12",
        conversationType: "VIEWING_ENQUIRY",
        collectedFields: {},
        missingFields: ["email"],
        isComplete: false,
      };

      vi.mocked(mockAgencyRepository.findById).mockResolvedValue({
        id: "agency-uuid-1",
        name: "Test",
        inboundEmail: "test@test.com",
        createdAt: NOW,
        updatedAt: NOW,
      });

      await service.sendReply({
        result,
        tenantEmail: "user@example.com",
        agencyId: "agency-uuid-1",
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Auto-reply sent to user@example.com"),
      );

      consoleSpy.mockRestore();
    });
  });
});
