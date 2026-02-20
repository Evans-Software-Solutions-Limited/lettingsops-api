import { useListLeads } from "@/hooks/api/useListLeads";
import { DashboardStats } from "./DashboardStats.presenter";

export function DashboardStatsContainer() {
  const { data, isLoading } = useListLeads({ limit: 200 });

  const byStatus: Record<string, number> = {};
  if (data?.leads) {
    for (const lead of data.leads) {
      byStatus[lead.status] = (byStatus[lead.status] ?? 0) + 1;
    }
  }

  return (
    <DashboardStats
      total={data?.total ?? 0}
      byStatus={byStatus}
      isLoading={isLoading}
    />
  );
}
