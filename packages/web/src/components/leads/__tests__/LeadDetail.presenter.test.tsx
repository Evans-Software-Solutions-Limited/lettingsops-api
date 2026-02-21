import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { LeadDetail } from "../LeadDetail.presenter";

describe("LeadDetail", () => {
  const mockLead = {
    id: "1",
    name: "John Doe",
    email: "john@example.com",
    phone: "+1234567890",
    propertyRef: "PROP123",
    status: "NEW",
    source: "Website",
    score: 85,
    scoreCategory: "High",
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-02T00:00:00Z",
  };

  it('shows "Loading lead..." when isLoading=true', () => {
    render(
      <MemoryRouter>
        <LeadDetail lead={null} isLoading={true} />
      </MemoryRouter>,
    );

    expect(screen.getByText("Loading lead...")).toBeDefined();
  });

  it('shows "Lead not found." when lead=null and not loading', () => {
    render(
      <MemoryRouter>
        <LeadDetail lead={null} isLoading={false} />
      </MemoryRouter>,
    );

    expect(screen.getByText("Lead not found.")).toBeDefined();
  });

  it("renders lead name, email, status badge when lead is provided", () => {
    render(
      <MemoryRouter>
        <LeadDetail lead={mockLead} isLoading={false} />
      </MemoryRouter>,
    );

    expect(screen.getByText("John Doe")).toBeDefined();
    expect(screen.getByText("john@example.com")).toBeDefined();
    expect(screen.getByText("NEW")).toBeDefined();
  });

  it('renders "—" for missing optional fields (phone, propertyRef)', () => {
    const leadWithoutOptionalFields = {
      ...mockLead,
      phone: null,
      propertyRef: undefined,
    };

    render(
      <MemoryRouter>
        <LeadDetail lead={leadWithoutOptionalFields} isLoading={false} />
      </MemoryRouter>,
    );

    const phoneField = screen.getByText("Phone").parentElement;
    const propertyRefField = screen.getByText("Property Ref").parentElement;

    expect(phoneField?.textContent).toContain("—");
    expect(propertyRefField?.textContent).toContain("—");
  });

  it("renders all fields correctly when data is available", () => {
    render(
      <MemoryRouter>
        <LeadDetail lead={mockLead} isLoading={false} />
      </MemoryRouter>,
    );

    expect(screen.getByText("John Doe")).toBeDefined();
    expect(screen.getByText("john@example.com")).toBeDefined();
    expect(screen.getByText("Website")).toBeDefined();
    expect(screen.getByText("85 (High)")).toBeDefined();
    expect(screen.getByText("PROP123")).toBeDefined();
    expect(screen.getByText("+1234567890")).toBeDefined();
  });
});
