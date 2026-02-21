import { useState } from "react";
import { useListLeads } from "@/hooks/api/useListLeads";
import { LeadsList } from "./LeadsList.presenter";

const PAGE_SIZE = 20;

export function LeadsListContainer() {
  const [page, setPage] = useState(1);
  const [selectedStatus, setSelectedStatus] = useState("");

  const { data, isLoading } = useListLeads({
    page,
    limit: PAGE_SIZE,
    status: selectedStatus || undefined,
  });

  const handleStatusFilter = (status: string) => {
    setSelectedStatus(status);
    setPage(1);
  };

  return (
    <LeadsList
      leads={data?.leads ?? []}
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
