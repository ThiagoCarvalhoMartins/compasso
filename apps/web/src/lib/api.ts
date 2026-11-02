import { QueryClient } from "@tanstack/react-query";
import { createApiClient } from "@compasso/ui";

export const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000/api/v1";

export const api = createApiClient({
  baseUrl: API_URL,
  refreshPath: "/auth/refresh",
  onUnauthorized: () => window.dispatchEvent(new Event("compasso:logout")),
});

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false },
  },
});
