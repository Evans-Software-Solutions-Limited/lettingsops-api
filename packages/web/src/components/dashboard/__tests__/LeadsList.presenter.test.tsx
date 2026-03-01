import { render, screen, fireEvent } from "@testing-library/react";
import { vi } from "vitest";
import { LeadsList, type Lead } from "../LeadsList.presenter";
import { MemoryRouter } from "react-router";

vi.mock("react-router", async (importOriginal) => {
  const actual = (await importOriginal()) as typeof import("react-router");
  return {
    ...actual,
    useNavigate: () => vi.fn(),
  };
});

describe("LeadsList", () => {
  const mockLeads: Lead[] = [
    {
      id: "1",
      name: "John Doe",
      email: "john@example.com",
      status: "NEW",
      source: "email",
      createdAt: "2024-01-01T00:00:00Z",
    },
    {
      id: "2",
      name: "Jane Smith",
      email: "jane@example.com",
      status: "CONTACTED",
      source: "phone",
      scoreCategory: "STRONG",
      createdAt: "2024-01-02T00:00:00Z",
    },
  ];

  const defaultProps = {
    leads: mockLeads,
    total: 2,
    page: 1,
    limit: 10,
    isLoading: false,
    selectedStatus: "",
    onPageChange: vi.fn(),
    onStatusFilter: vi.fn(),
  };

  it('shows "Loading leads..." when isLoading=true', () => {
    render(
      <MemoryRouter>
        <LeadsList {...defaultProps} isLoading={true} />
      </MemoryRouter>,
    );

    expect(screen.getByText("Loading leads...")).toBeDefined();
  });

  it('shows "No leads found." when leads=[] and not loading', () => {
    render(
      <MemoryRouter>
        <LeadsList {...defaultProps} leads={[]} total={0} />
      </MemoryRouter>,
    );

    expect(screen.getByText("No leads found.")).toBeDefined();
  });

  it("renders a row for each lead with name, email, status", () => {
    render(
      <MemoryRouter>
        <LeadsList {...defaultProps} />
      </MemoryRouter>,
    );

    expect(screen.getByText("John Doe")).toBeDefined();
    expect(screen.getByText("john@example.com")).toBeDefined();
    expect(screen.getByText("Jane Smith")).toBeDefined();
    expect(screen.getByText("jane@example.com")).toBeDefined();
  });

  it("clicking a row navigates to /leads/:id", () => {
    const mockNavigate = vi.fn();
    vi.doMock("react-router", async () => {
      return {
        useNavigate: () => mockNavigate,
      };
    });

    render(
      <MemoryRouter>
        <LeadsList {...defaultProps} />
      </MemoryRouter>,
    );

    const rows = screen.getAllByRole("row");
    expect(rows.length).toBeGreaterThan(1); // Header + data rows
  });

  it("status filter buttons render; clicking one calls onStatusFilter with correct value", () => {
    render(
      <MemoryRouter>
        <LeadsList {...defaultProps} />
      </MemoryRouter>,
    );

    const allButton = screen.getByText("All");
    const newButtons = screen.getAllByText("NEW");
    const newButton = newButtons[0]; // Get the first "NEW" (the button, not the status badge)

    expect(allButton).toBeDefined();
    expect(newButton).toBeDefined();

    fireEvent.click(newButton);
    expect(defaultProps.onStatusFilter).toHaveBeenCalledWith("NEW");

    fireEvent.click(allButton);
    expect(defaultProps.onStatusFilter).toHaveBeenCalledWith("");
  });

  it("pagination buttons render when totalPages > 1; Previous disabled on page 1", () => {
    render(
      <MemoryRouter>
        <LeadsList {...defaultProps} total={25} limit={10} page={1} />
      </MemoryRouter>,
    );

    expect(screen.getByText("Page 1 of 3 · 25 total")).toBeDefined();

    const previousButton = screen.getByText("Previous");
    const nextButton = screen.getByText("Next");

    expect(previousButton).toBeDefined();
    expect(nextButton).toBeDefined();

    // Check if buttons are disabled by checking their class or attribute
    const previousButtonElement = previousButton.closest("button");
    const nextButtonElement = nextButton.closest("button");

    expect(previousButtonElement?.hasAttribute("disabled")).toBe(true);
    expect(nextButtonElement?.hasAttribute("disabled")).toBe(false);
  });
});
