import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { BrowserRouter } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import LeadDetail from "../LeadDetail";

// Mock the hooks
vi.mock("@/hooks/api/useGetLead", () => ({
  useGetLead: vi.fn(),
}));

vi.mock("@/hooks/api/useGetLeadCommunication", () => ({
  useGetLeadCommunication: vi.fn(),
}));

// Mock useParams
vi.mock("react-router", async () => {
  const actual = await vi.importActual("react-router");
  return {
    ...actual,
    useParams: vi.fn(() => ({ id: "lead-1" })),
  };
});

import { useGetLead } from "@/hooks/api/useGetLead";
import { useGetLeadCommunication } from "@/hooks/api/useGetLeadCommunication";

describe("LeadDetail Page", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    vi.clearAllMocks();
  });

  it("should render loading state", () => {
    (useGetLead as any).mockReturnValue({
      data: null,
      isLoading: true,
      error: null,
      isError: false,
    });

    (useGetLeadCommunication as any).mockReturnValue({
      data: null,
      isLoading: true,
      error: null,
    });

    const { container } = render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <LeadDetail />
        </BrowserRouter>
      </QueryClientProvider>,
    );

    // Check for skeleton loaders (will be multiple skeletons)
    const skeletons = container.querySelectorAll(".animate-pulse");
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it("should render error state", () => {
    const error = new Error("Failed to load lead");
    (useGetLead as any).mockReturnValue({
      data: null,
      isLoading: false,
      error,
      isError: true,
    });

    (useGetLeadCommunication as any).mockReturnValue({
      data: null,
      isLoading: false,
      error: null,
    });

    render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <LeadDetail />
        </BrowserRouter>
      </QueryClientProvider>,
    );

    expect(screen.getByText("Error loading lead")).toBeTruthy();
  });

  it("should render lead details when data is loaded", () => {
    const mockLead = {
      id: "lead-1",
      name: "John Smith",
      email: "john@example.com",
      phone: "07700 123456",
      propertyRef: "PROP-001",
      status: "pending",
      source: "phone",
      score: 85,
      scoreCategory: "high",
      createdAt: "2024-01-15T10:00:00Z",
      updatedAt: "2024-01-15T10:00:00Z",
    };

    (useGetLead as any).mockReturnValue({
      data: mockLead,
      isLoading: false,
      error: null,
      isError: false,
    });

    (useGetLeadCommunication as any).mockReturnValue({
      data: {
        leadId: "lead-1",
        communications: [],
      },
      isLoading: false,
      error: null,
    });

    render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <LeadDetail />
        </BrowserRouter>
      </QueryClientProvider>,
    );

    expect(screen.getByText("John Smith")).toBeTruthy();
    expect(screen.getByText("john@example.com")).toBeTruthy();
    expect(screen.getByText("07700 123456")).toBeTruthy();
    expect(screen.getByText("PROP-001")).toBeTruthy();
  });
});
