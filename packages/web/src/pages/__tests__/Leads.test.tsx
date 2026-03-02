import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { BrowserRouter } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Leads from "../Leads";

// Mock the hook
vi.mock("@/hooks/api/useListLeads", () => ({
  useListLeads: vi.fn(),
}));

import { useListLeads } from "@/hooks/api/useListLeads";

describe("Leads Page", () => {
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
    (useListLeads as any).mockReturnValue({
      data: null,
      isLoading: true,
      error: null,
    });

    const { container } = render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <Leads />
        </BrowserRouter>
      </QueryClientProvider>,
    );

    // Check for skeleton loaders (animate-pulse class)
    const skeletons = container.querySelectorAll(".animate-pulse");
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it("should render error state", () => {
    const error = new Error("Failed to load leads");
    (useListLeads as any).mockReturnValue({
      data: null,
      isLoading: false,
      error,
    });

    render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <Leads />
        </BrowserRouter>
      </QueryClientProvider>,
    );

    expect(screen.getByText("Error loading leads")).toBeTruthy();
    expect(screen.getByText("Failed to load leads")).toBeTruthy();
  });

  it("should render leads table with data", () => {
    const mockData = {
      leads: [
        {
          id: "1",
          name: "John Smith",
          email: "john@example.com",
          source: "phone",
          status: "new",
          score: 85,
          scoreCategory: "high",
        },
        {
          id: "2",
          name: "Jane Doe",
          email: "jane@example.com",
          source: "web",
          status: "pending",
          score: 65,
          scoreCategory: "medium",
        },
      ],
      total: 2,
      page: 1,
      limit: 10,
    };

    (useListLeads as any).mockReturnValue({
      data: mockData,
      isLoading: false,
      error: null,
    });

    render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <Leads />
        </BrowserRouter>
      </QueryClientProvider>,
    );

    expect(screen.getByText("John Smith")).toBeTruthy();
    expect(screen.getByText("jane@example.com")).toBeTruthy();
    expect(screen.getByText("Showing 2 of 2 leads")).toBeTruthy();
  });

  it("should render empty state when no leads found", () => {
    (useListLeads as any).mockReturnValue({
      data: {
        leads: [],
        total: 0,
        page: 1,
        limit: 10,
      },
      isLoading: false,
      error: null,
    });

    render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <Leads />
        </BrowserRouter>
      </QueryClientProvider>,
    );

    expect(screen.getByText("No leads found")).toBeTruthy();
  });
});
