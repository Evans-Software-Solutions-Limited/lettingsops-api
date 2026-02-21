import { LeadsListContainer } from "@/components/dashboard/LeadsList.container";

export default function LeadsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Leads</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          All leads in your pipeline
        </p>
      </div>
      <LeadsListContainer />
    </div>
  );
}
