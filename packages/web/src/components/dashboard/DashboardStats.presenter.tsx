import { Card } from "@/components/ui/card";

interface DashboardStatsProps {
  total: number;
  byStatus: Record<string, number>;
  isLoading: boolean;
}

const statConfig = [
  { key: "total", label: "Total Leads", borderColor: "#fafafa" },
  { key: "NEW", label: "New", borderColor: "#3f3f46" },
  { key: "CONTACTED", label: "Contacted", borderColor: "#1e3a8a" },
  { key: "QUALIFYING", label: "Qualifying", borderColor: "#78350f" },
  { key: "QUALIFIED", label: "Qualified", borderColor: "#312e81" },
  { key: "VIEWING_BOOKED", label: "Viewing Booked", borderColor: "#064e3b" },
  { key: "CONVERTED", label: "Converted", borderColor: "#15803d" },
] as const;

export function DashboardStats({
  total,
  byStatus,
  isLoading,
}: DashboardStatsProps) {
  const getValue = (key: string) => {
    if (key === "total") return total;
    return byStatus[key] ?? 0;
  };

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
      {statConfig.map(({ key, label, borderColor }) => (
        <Card
          key={key}
          className="p-4 bg-card border-border relative overflow-hidden"
          style={{
            borderLeftWidth: "3px",
            borderLeftColor: borderColor,
          }}
        >
          <p className="text-xs text-muted-foreground mb-1">{label}</p>
          <p className="text-2xl font-semibold text-foreground">
            {isLoading ? "—" : getValue(key)}
          </p>
        </Card>
      ))}
    </div>
  );
}
