/**
 * tRPC React Client (v11)
 *
 * Client-side hooks for use in Client Components
 */

'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { httpBatchLink, loggerLink } from '@trpc/client';
import { createTRPCReact } from '@trpc/react-query';
import { useState } from 'react';
import superjson from 'superjson';
import { type AppRouter } from '@/server/routers/_app';

export const api = createTRPCReact<AppRouter>();

export function TRPCReactProvider(props: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // ✅ OPTIMIZATION: Aggressive caching to avoid redundant auth.me calls
            // BEFORE: staleTime 60s meant auth.me called every minute
            // AFTER: staleTime 5min for most queries, auth data changes rarely
            staleTime: 5 * 60 * 1000, // Consider fresh for 5 minutes (auth data changes infrequently)
            gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes (formerly cacheTime)
            retry: 1, // Only retry failed requests once (avoid cascading failures)
            refetchOnWindowFocus: false, // Don't refetch on every tab focus (too aggressive for slow 3G)
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
      <api.Provider client={trpcClient} queryClient={queryClient}>
        {props.children}
      </api.Provider>
    </QueryClientProvider>
  );
}

function getBaseUrl() {
  if (typeof window !== 'undefined') return window.location.origin;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return `http://localhost:${process.env.PORT ?? 3000}`;
}
