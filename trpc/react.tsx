/**
 * tRPC React Client (v11)
 *
 * Client-side hooks for use in Client Components
 *
 * Performance Optimizations (based on TanStack Query best practices):
 * 1. Short staleTime (1min) - show cached data instantly, refetch in background on mount
 * 2. refetchOnMount: true - ensures stale data refetches when navigating between pages
 * 3. refetchOnWindowFocus: false - avoid aggressive refetching on slow 3G networks
 * 4. Exported queryClient for prefetching in navigation components
 *
 * Per-query overrides: Auth/tenant queries use staleTime: 5min inline.
 * Country config queries use staleTime: 30min inline.
 *
 * @see https://tanstack.com/query/latest/docs/framework/react/guides/prefetching
 */

'use client';

import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { httpBatchLink, loggerLink } from '@trpc/client';
import { createTRPCReact } from '@trpc/react-query';
import { useState, createContext, useContext } from 'react';
import superjson from 'superjson';
import { type AppRouter } from '@/server/routers/_app';

export const api = createTRPCReact<AppRouter>();

// Export QueryClient context for prefetching utilities
const QueryClientContext = createContext<QueryClient | null>(null);

/**
 * Hook to access QueryClient for prefetching
 *
 * Usage in navigation components:
 * ```tsx
 * const queryClient = usePrefetchClient();
 * const prefetch = () => {
 *   queryClient.prefetchQuery({
 *     queryKey: ['dashboard', 'getHRDashboard'],
 *     queryFn: () => trpcClient.dashboard.getHRDashboard.query(),
 *     staleTime: 60000,
 *   });
 * };
 * ```
 */
export function usePrefetchClient() {
  return useQueryClient();
}

export function TRPCReactProvider(props: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // ✅ OPTIMIZATION: Short staleTime so navigating between pages triggers background refetch
            // Cached data shows instantly (no spinner), fresh data replaces it seconds later
            staleTime: 60 * 1000, // Consider fresh for 1 minute (balances navigation freshness vs network cost)
            gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes (formerly cacheTime)
            retry: 1, // Only retry failed requests once (avoid cascading failures)
            refetchOnWindowFocus: false, // Don't refetch on every tab focus (too aggressive for slow 3G)
            refetchOnMount: true, // Refetch stale data when component mounts (critical for page navigation)
            networkMode: 'online', // Only run queries when online
            structuralSharing: true, // Enable structural sharing for better performance
          },
        },
      })
  );

  const [trpcClient] = useState(() =>
    api.createClient({
      links: [
        loggerLink({
          enabled: (op) =>
            process.env.NODE_ENV === 'development' ||
            (op.direction === 'down' && op.result instanceof Error),
        }),
        httpBatchLink({
          transformer: superjson,
          url: getBaseUrl() + '/api/trpc',
          headers() {
            const headers = new Headers();
            headers.set('x-trpc-source', 'nextjs-react');
            return headers;
          },
        }),
      ],
    })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <QueryClientContext.Provider value={queryClient}>
        <api.Provider client={trpcClient} queryClient={queryClient}>
          {props.children}
        </api.Provider>
      </QueryClientContext.Provider>
    </QueryClientProvider>
  );
}

function getBaseUrl() {
  if (typeof window !== 'undefined') return window.location.origin;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return `http://localhost:${process.env.PORT ?? 3000}`;
}
