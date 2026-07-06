import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { QUERY_STALE_TIME_MS } from "@/lib/constants";
import { useAuthStore } from "./stores/authStore";
import { useEffect } from "react";
import { RouterProvider } from "react-router-dom";
import { router } from "./router";
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: QUERY_STALE_TIME_MS,
      refetchOnWindowFocus: true,
    },
  },
});

function App() {
  const checkAuth = useAuthStore((s) => s.checkAuth);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
}

export default App;
