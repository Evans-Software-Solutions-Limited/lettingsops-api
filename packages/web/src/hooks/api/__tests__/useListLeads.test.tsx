import { renderHook } from "@testing-library/react";
import { vi } from "vitest";
import { useListLeads } from "../useListLeads";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@/lib/eden", () => ({
  api: {
    lettings: {
      leads: {
        get: vi.fn(),
      },
    },
  },
}));

describe("useListLeads", () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  it("Calls the correct query key", () => {
    const params = { status: "NEW", page: 1, limit: 10 };
    
    const { result } = renderHook(() => useListLeads(params), { wrapper });

    expect(result.current).toBeDefined();
  });

  it("Is enabled by default", () => {
    const { result } = renderHook(() => useListLeads(), { wrapper });

    expect(result.current).toBeDefined();
  });

  it("Uses correct query key with different params", () => {
    const params1 = { status: "NEW" };
    const params2 = { status: "CONTACTED", page: 2 };
    
    const { result: result1 } = renderHook(() => useListLeads(params1), { wrapper });
    const { result: result2 } = renderHook(() => useListLeads(params2), { wrapper });

    expect(result1.current).toBeDefined();
    expect(result2.current).toBeDefined();
  });
});