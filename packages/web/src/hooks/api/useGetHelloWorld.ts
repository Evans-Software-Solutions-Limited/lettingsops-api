import { useQuery } from "@tanstack/react-query";

// TODO: Replace with a real LettingsOps API endpoint once a public health/hello route is added.
// The `api.core` namespace was renamed to `api.lettings` during the package rename (see feat/rename-packages).

export const useGetHelloWorld = () => {
  return useQuery({
    queryKey: ["hello-world"],
    queryFn: (): Promise<{ message: string } | null> => Promise.resolve(null),
  });
};
