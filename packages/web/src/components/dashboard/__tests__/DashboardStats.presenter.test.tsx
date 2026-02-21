import { render, screen } from "@testing-library/react";
import { DashboardStats } from "../DashboardStats.presenter";

describe("DashboardStats", () => {
  const mockByStatus = {
    NEW: 5,
    CONTACTED: 3,
    QUALIFYING: 2,
    QUALIFIED: 1,
    VIEWING_BOOKED: 1,
    CONVERTED: 1,
  };

  it("renders stat cards with correct values", () => {
    render(
      <DashboardStats total={13} byStatus={mockByStatus} isLoading={false} />,
    );

    expect(screen.getByText("Total Leads")).toBeDefined();
    expect(screen.getByText("13")).toBeDefined();

    expect(screen.getByText("New")).toBeDefined();
    expect(screen.getByText("5")).toBeDefined();

    expect(screen.getByText("Contacted")).toBeDefined();
    expect(screen.getByText("3")).toBeDefined();

    expect(screen.getByText("Qualifying")).toBeDefined();
    expect(screen.getByText("2")).toBeDefined();

    expect(screen.getByText("Qualified")).toBeDefined();
    expect(screen.getByText("Viewing Booked")).toBeDefined();
    expect(screen.getByText("Converted")).toBeDefined();

    // Use getAllByText for the "1" values that appear multiple times
    const oneElements = screen.getAllByText("1");
    expect(oneElements.length).toBeGreaterThan(0);
  });

  it('shows "—" for all values when isLoading=true', () => {
    render(<DashboardStats total={0} byStatus={{}} isLoading={true} />);

    const emDashes = screen.getAllByText("—");
    expect(emDashes.length).toBe(7); // Total 7 stat cards
  });

  it("renders correct count for each status key", () => {
    const customByStatus = {
      NEW: 10,
      CONTACTED: 5,
      QUALIFYING: 3,
    };

    render(
      <DashboardStats total={18} byStatus={customByStatus} isLoading={false} />,
    );

    expect(screen.getByText("10")).toBeDefined();
    expect(screen.getByText("5")).toBeDefined();
    expect(screen.getByText("3")).toBeDefined();
  });
});
