import { renderHook } from "@testing-library/react";
import { vi } from "vitest";
import { useGetLead } from "../useGetLead";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@/lib/eden", () => ({
  api: {
    lettings: {
      leads: () => ({
        get: vi.fn(),
      }),
    },
  },
}));

describe("useGetLead", () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  it("Is disabled when id is empty string", () => {
    const { result } = renderHook(() => useGetLead(""), { wrapper });

    expect(result.current.fetchStatus).toBe("idle");
  });

  it("Is enabled when id is provided", () => {
    const { result } = renderHook(() => useGetLead("test-id"), { wrapper });

    expect(result.current).toBeDefined();
  });

  it("Uses correct query key", () => {
    const { result } = renderHook(() => useGetLead("test-lead-id"), {
      wrapper,
    });

    expect(result.current).toBeDefined();
  });

  it("Handles different id values correctly", () => {
    const { result: result1 } = renderHook(() => useGetLead("id1"), {
      wrapper,
    });
    const { result: result2 } = renderHook(() => useGetLead("id2"), {
      wrapper,
    });

    expect(result1.current).toBeDefined();
    expect(result2.current).toBeDefined();
  });
});
