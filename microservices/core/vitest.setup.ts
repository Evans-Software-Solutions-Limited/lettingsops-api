import { vi } from "vitest";

// Create a mock database client that handles drizzle-orm queries
const createChainableDb = () => {
  // Mock lead object for returns
  const mockLead = {
    id: "mock-lead-uuid",
    name: "Mock Lead",
    email: "mock@example.com",
    phone: null,
    propertyRef: null,
    propertyRent: null,
    message: null,
    source: "email",
    status: "NEW",
    score: null,
    scoreCategory: null,
    metadata: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const chain = {
    select: () => chain,
    from: () => chain,
    where: () => chain,
    insert: () => ({
      values: () => ({
        returning: async () => [mockLead],
      }),
    }),
    update: () => ({
      set: () => ({
        where: async () => [mockLead],
      }),
    }),
    returning: async () => [mockLead],
    limit: () => chain,
    offset: () => chain,
    then: (resolve: (value: unknown) => void) => {
      resolve([]);
      return Promise.resolve([]);
    },
  };
  return chain;
};

// Mock the database client globally
vi.mock("@lettingsops/db", () => ({
  getDb: vi.fn(() => createChainableDb()),
  communicationLogs: { id: {} },
  leads: { id: {} },
  viewings: { id: {} },
  agencies: { id: {} },
  conversations: { id: {} },
  qualifications: { id: {} },
  emailConversations: {
    id: {},
    agencyId: {},
    tenantEmail: {},
    status: {},
    updatedAt: {},
    collectedFields: {},
  },
  viewingRequests: { id: {}, leadId: {}, agencyId: {}, status: {} },
  estateAgents: { id: {}, agencyId: {} },
  agencyRequiredFields: { id: {}, agencyId: {}, fieldKey: {} },
  availabilityWindows: { id: {}, agencyId: {}, estateAgentId: {} },
  apiKeys: {
    id: {},
    agencyId: {},
    keyHash: {},
    revokedAt: {},
    createdAt: {},
  },
}));
