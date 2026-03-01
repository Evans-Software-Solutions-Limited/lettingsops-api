import { useState, useEffect } from "react";
import { useListLeads } from "@/hooks/api/useListLeads";
import { LeadsList, type Lead } from "./LeadsList.presenter";

const PAGE_SIZE = 20;
const REFRESH_INTERVAL = 30000; // 30 seconds

interface LeadResponse {
  id: string;
  name: string;
  email: string;
  source: string;
  status: string;
  score?: number;
  scoreCategory?: string;
  createdAt: string;
}

export function LeadsListContainer() {
  const [page, setPage] = useState(1);
  const [selectedStatus, setSelectedStatus] = useState("");

  const { data, isLoading, refetch } = useListLeads({
    page,
    limit: PAGE_SIZE,
    status: selectedStatus || undefined,
  });

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      refetch();
    }, REFRESH_INTERVAL);

    return () => clearInterval(interval);
  }, [refetch]);

  const handleStatusFilter = (status: string) => {
    setSelectedStatus(status);
    setPage(1);
  };

  const normalizedLeads: Lead[] = (data?.leads ?? []).map(
    (lead: LeadResponse) => ({
      ...lead,
      source:
        (lead.source as "email" | "phone" | "portal" | "manual") || "manual",
    }),
  );

  return (
    <LeadsList
      leads={normalizedLeads}
      total={data?.total ?? 0}
      page={page}
      limit={PAGE_SIZE}
      isLoading={isLoading}
      selectedStatus={selectedStatus}
      onPageChange={setPage}
      onStatusFilter={handleStatusFilter}
    />
  );
}
