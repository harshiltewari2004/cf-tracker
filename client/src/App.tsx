import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { QUERY_STALE_TIME_MS } from '@/lib/constants';
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: QUERY_STALE_TIME_MS,
      refetchOnWindowFocus: true,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white">
        <div className="p-8 rounded-lg bg-slate-800">
          <h1 className="text-2xl font-bold mb-4">CF Tracker</h1>
          <p className="text-sm text-slate-400">React Query mounted.</p>
        </div>
      </div>
    </QueryClientProvider>
  );
}

export default App;