import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/eden";

export const useGetLead = (id: string) => {
  return useQuery({
    queryKey: ["leads", id],
    queryFn: async () => {
      const { data, error } = await api.lettings.leads({ id }).get();
      if (error) throw new Error(String(error));
      return data;
    },
    enabled: !!id,
  });
};
