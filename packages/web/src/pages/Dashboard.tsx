import { DashboardStatsContainer } from "@/components/dashboard/DashboardStats.container";
import { LeadsListContainer } from "@/components/dashboard/LeadsList.container";

export default function Dashboard() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Overview of your lettings pipeline
        </p>
      </div>
      <DashboardStatsContainer />
      <LeadsListContainer />
    </div>
  );
}
