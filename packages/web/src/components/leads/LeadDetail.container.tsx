import { useParams } from "react-router";
import { useGetLead } from "@/hooks/api/useGetLead";
import { useGetLeadCommunication } from "@/hooks/api/useGetLeadCommunication";
import { LeadDetail } from "./LeadDetail.presenter";

export function LeadDetailContainer() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading } = useGetLead(id ?? "");
  const { data: communicationData, isLoading: isLoadingCommunication } =
    useGetLeadCommunication(id ?? "");

  return (
    <LeadDetail
      lead={data}
      communications={communicationData?.communications ?? []}
      isLoading={isLoading}
      isLoadingCommunication={isLoadingCommunication}
    />
  );
}
