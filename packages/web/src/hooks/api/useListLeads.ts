import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/eden";

export interface ListLeadsParams {
  status?: string;
  propertyRef?: string;
  page?: number;
  limit?: number;
}

export const useListLeads = (params: ListLeadsParams = {}) => {
  return useQuery({
    queryKey: ["leads", params],
    queryFn: async () => {
      const { data, error } = await api.lettings.leads.get({ query: params });
      if (error) throw new Error(String(error));
      return data;
    },
  });
};
