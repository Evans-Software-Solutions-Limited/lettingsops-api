import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/eden";

interface CommunicationLog {
  id: string;
  source: string;
  subject?: string;
  body?: string;
  receivedAt: string;
  direction?: string;
  transcript?: Array<{ role: string; message: string; timestamp: string }>;
}

interface CommunicationResponse {
  leadId: string;
  communications: CommunicationLog[];
}

interface ApiLeadsType {
  [leadId: string]: {
    communication: {
      get: () => Promise<{ data: CommunicationResponse; error: null }>;
    };
  };
}

export const useGetLeadCommunication = (leadId: string) => {
  return useQuery({
    queryKey: ["lead-communication", leadId],
    queryFn: async (): Promise<CommunicationResponse | null> => {
      if (!leadId) return null;
      const leads = api.lettings.leads as unknown as ApiLeadsType;
      const leadApi = leads[leadId];
      const { data } = await leadApi.communication.get();
      return data as CommunicationResponse;
    },
    enabled: !!leadId,
  });
};
