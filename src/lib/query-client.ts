import { QueryClient } from "@tanstack/react-query";

function isUnauthorized(error: unknown): boolean {
  return error instanceof Error && error.message === "Unauthorized";
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 12_000,
      retry: (count, error) => (isUnauthorized(error) ? false : count < 1),
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: false,
    },
  },
});
