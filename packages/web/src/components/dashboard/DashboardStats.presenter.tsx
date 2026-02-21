import { Card } from "@/components/ui/card";

interface DashboardStatsProps {
  total: number;
  byStatus: Record<string, number>;
  isLoading: boolean;
}

const statConfig = [
  { key: "total", label: "Total Leads", color: "text-foreground" },
  { key: "NEW", label: "New", color: "text-zinc-400" },
  { key: "CONTACTED", label: "Contacted", color: "text-blue-400" },
  { key: "QUALIFYING", label: "Qualifying", color: "text-amber-400" },
  { key: "QUALIFIED", label: "Qualified", color: "text-primary" },
  { key: "VIEWING_BOOKED", label: "Viewing Booked", color: "text-emerald-400" },
  { key: "CONVERTED", label: "Converted", color: "text-green-400" },
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
      {statConfig.map(({ key, label, color }) => (
        <Card key={key} className="p-4 bg-card border-border">
          <p className="text-xs text-muted-foreground mb-1">{label}</p>
          <p className={`text-2xl font-semibold ${color}`}>
            {isLoading ? "—" : getValue(key)}
          </p>
        </Card>
      ))}
    </div>
  );
}
