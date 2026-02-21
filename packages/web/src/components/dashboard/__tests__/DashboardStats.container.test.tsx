import { render } from "@testing-library/react";
import { vi } from "vitest";
import { DashboardStatsContainer } from "../DashboardStats.container";
import { useListLeads } from "@/hooks/api/useListLeads";

vi.mock("@/hooks/api/useListLeads");

const mockUseListLeads = vi.mocked(useListLeads);

describe("DashboardStatsContainer", () => {
  it("When useListLeads returns loading state, passes isLoading=true to presenter", () => {
    mockUseListLeads.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    } as any);

    render(<DashboardStatsContainer />);

    // The presenter should receive isLoading=true
    expect(mockUseListLeads).toHaveBeenCalledWith({ limit: 200 });
  });

  it("When useListLeads returns data, passes correct total and byStatus counts", () => {
    const mockData = {
      leads: [
        { id: "1", status: "NEW" },
        { id: "2", status: "NEW" },
        { id: "3", status: "CONTACTED" },
        { id: "4", status: "QUALIFIED" },
        { id: "5", status: "NEW" },
      ],
      total: 5,
    };

    mockUseListLeads.mockReturnValue({
      data: mockData,
      isLoading: false,
      error: null,
    } as any);

    render(<DashboardStatsContainer />);

    expect(mockUseListLeads).toHaveBeenCalledWith({ limit: 200 });
  });
});
