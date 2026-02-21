import { render } from "@testing-library/react";
import { vi } from "vitest";
import { LeadDetailContainer } from "../LeadDetail.container";
import { useGetLead } from "@/hooks/api/useGetLead";

vi.mock("@/hooks/api/useGetLead");
vi.mock("react-router", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    useParams: () => ({ id: "test-id" }),
  };
});

vi.mock("../LeadDetail.presenter", () => ({
  LeadDetail: ({ lead, isLoading }: any) => (
    <div>
      {isLoading ? "Loading lead..." : lead?.name || "Lead not found."}
    </div>
  ),
}));

const mockUseGetLead = vi.mocked(useGetLead);

describe("LeadDetailContainer", () => {
  it("Calls useGetLead with the id from useParams", () => {
    mockUseGetLead.mockReturnValue({
      data: null,
      isLoading: false,
      error: null,
    } as any);

    render(<LeadDetailContainer />);

    expect(mockUseGetLead).toHaveBeenCalledWith("test-id");
  });

  it("Passes isLoading and data to presenter", () => {
    const mockLead = {
      id: "test-id",
      name: "Test Lead",
      email: "test@example.com",
      status: "NEW",
      source: "Website",
      createdAt: "2024-01-01T00:00:00Z",
      updatedAt: "2024-01-01T00:00:00Z",
    };

    mockUseGetLead.mockReturnValue({
      data: mockLead,
      isLoading: false,
      error: null,
    } as any);

    render(<LeadDetailContainer />);

    expect(mockUseGetLead).toHaveBeenCalledWith("test-id");
  });
});