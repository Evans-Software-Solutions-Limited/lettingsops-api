import { useParams } from "react-router";
import { useGetLead } from "@/hooks/api/useGetLead";
import { LeadDetail } from "./LeadDetail.presenter";

export function LeadDetailContainer() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading } = useGetLead(id ?? "");

  return <LeadDetail lead={data} isLoading={isLoading} />;
}
