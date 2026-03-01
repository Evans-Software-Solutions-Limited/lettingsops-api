import { render } from "@testing-library/react";
import { vi } from "vitest";
import { LeadDetailContainer } from "../LeadDetail.container";
import { useGetLead } from "@/hooks/api/useGetLead";
import { useGetLeadCommunication } from "@/hooks/api/useGetLeadCommunication";

vi.mock("@/hooks/api/useGetLead");
vi.mock("@/hooks/api/useGetLeadCommunication");
vi.mock("react-router", async () => {
  return {
    useParams: () => ({ id: "test-id" }),
  };
});

vi.mock("../LeadDetail.presenter", () => ({
  LeadDetail: ({ lead, isLoading }: { lead: unknown; isLoading: boolean }) => (
    <div>
      {isLoading
        ? "Loading lead..."
        : (lead as { name?: string })?.name || "Lead not found."}
    </div>
  ),
}));

const mockUseGetLead = vi.mocked(useGetLead);
const mockUseGetLeadCommunication = vi.mocked(useGetLeadCommunication);

describe("LeadDetailContainer", () => {
  beforeEach(() => {
    mockUseGetLeadCommunication.mockReturnValue({
      data: null,
      isLoading: false,
      error: null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
  });

  it("Calls useGetLead with the id from useParams", () => {
    mockUseGetLead.mockReturnValue({
      data: null,
      isLoading: false,
      error: null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
      source: "email",
      createdAt: "2024-01-01T00:00:00Z",
      updatedAt: "2024-01-01T00:00:00Z",
    };

    mockUseGetLead.mockReturnValue({
      data: mockLead,
      isLoading: false,
      error: null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    render(<LeadDetailContainer />);

    expect(mockUseGetLead).toHaveBeenCalledWith("test-id");
  });
});
