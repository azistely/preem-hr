/**
 * Payroll Progress Hook
 *
 * Tracks progress of long-running payroll calculations.
 * Polls the server for updates and provides real-time status to the UI.
 *
 * DESIGNED FOR WEST AFRICA 3G CONNECTIONS:
 * - Automatic polling with adaptive intervals
 * - Aggressive retry on network errors (3 retries with backoff)
 * - Keeps polling even when temporarily offline
 * - Refetches when connection restored
 * - Shows last known state during disconnection
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '@/trpc/react';

export interface PayrollProgressState {
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'paused';
  totalEmployees: number;
  processedCount: number;
  successCount: number;
  errorCount: number;
  percentComplete: number;
  currentChunk: number;
  totalChunks: number | null;
  errors: Array<{ employeeId: string; message: string }>;
  lastError?: string | null;
  startedAt: Date | null;
  completedAt?: Date | null;
  estimatedCompletionAt: Date | null;
}

interface UsePayrollProgressOptions {
  /** Initial polling interval in ms (default: 2000ms for good connection) */
  pollInterval?: number;
  /** Polling interval when offline/slow in ms (default: 5000ms - more aggressive than before) */
  offlinePollInterval?: number;
  /** Whether to enable polling (default: true) */
  enabled?: boolean;
}

export function usePayrollProgress(
  runId: string | null,
  options: UsePayrollProgressOptions = {}
) {
  const {
    pollInterval = 2000,
    offlinePollInterval = 5000, // More aggressive polling when offline (was 10000)
    enabled = true,
  } = options;

  const [isOnline, setIsOnline] = useState(true);
  const lastSuccessfulFetch = useRef<Date | null>(null);
  const refetchRef = useRef<() => void>(() => {});

  // Track online/offline status
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      // Immediately refetch when connection restored
      if (enabled && runId) {
        refetchRef.current();
      }
    };
    const handleOffline = () => setIsOnline(false);

    setIsOnline(navigator.onLine);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [enabled, runId]);

  // Determine current poll interval - use faster polling always for better UX
  const currentPollInterval = isOnline ? pollInterval : offlinePollInterval;

  // Query for progress with retry logic for unreliable connections
  const {
    data: progress,
    isLoading,
    error,
    refetch,
    isFetching,
  } = api.payroll.getProgress.useQuery(
    { runId: runId! },
    {
      enabled: enabled && !!runId,
      // Poll during pending and processing states
      // Stops when completed, failed, or paused
      refetchInterval: (query) => {
        const data = query.state.data;
        // Keep polling during pending (waiting for Inngest) and processing
        if (data?.status === 'pending' || data?.status === 'processing') {
          return currentPollInterval;
        }
        // Also keep polling if no data yet (initial load) or if there was an error
        if (!data || query.state.error) {
          return currentPollInterval;
        }
        return false; // Stop polling when completed, failed, or paused
      },
      // Refetch when window regains focus (user returns after disconnect)
      refetchOnWindowFocus: true,
      // Keep showing last data while refetching (important for slow connections)
      placeholderData: (previousData) => previousData,
      // Retry configuration for unreliable 3G
      retry: 3,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
      // Don't throw errors - we handle them gracefully
      throwOnError: false,
      // Stale time - consider data stale after 1 second for fresh polling
      staleTime: 1000,
    }
  );

  // Keep refetchRef updated for use in online handler
  useEffect(() => {
    refetchRef.current = refetch;
  }, [refetch]);

  // Track successful fetches
  useEffect(() => {
    if (progress && !isFetching) {
      lastSuccessfulFetch.current = new Date();
    }
  }, [progress, isFetching]);

  // Calculate derived state
  const isPending = progress?.status === 'pending';
  const isProcessing = progress?.status === 'processing';
  const isCompleted = progress?.status === 'completed';
  const isFailed = progress?.status === 'failed';
  const isPaused = progress?.status === 'paused';

  // Calculate estimated time remaining
  const estimatedTimeRemaining = useCallback(() => {
    if (!progress?.startedAt || !isProcessing || progress.processedCount === 0) {
      return null;
    }

    const elapsed = Date.now() - new Date(progress.startedAt).getTime();
    const rate = progress.processedCount / elapsed; // employees per ms
    const remaining = progress.totalEmployees - progress.processedCount;
    const estimatedMs = remaining / rate;

    return Math.round(estimatedMs / 1000); // Return seconds
  }, [progress, isProcessing]);

  // Format time remaining for display
  const formatTimeRemaining = useCallback((seconds: number | null): string => {
    if (seconds === null) return '';
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return secs > 0 ? `${minutes}min ${secs}s` : `${minutes}min`;
  }, []);

  return {
    // Core progress data
    progress: progress as PayrollProgressState | undefined,

    // Convenience booleans
    isLoading,
    isFetching, // True when actively fetching (useful for showing "syncing" indicator)
    isPending,
    isProcessing,
    isCompleted,
    isFailed,
    isPaused,
    isOnline,

    // Progress metrics
    percentComplete: progress?.percentComplete ?? 0,
    processedCount: progress?.processedCount ?? 0,
    totalEmployees: progress?.totalEmployees ?? 0,
    errorCount: progress?.errorCount ?? 0,

    // Time estimates
    estimatedTimeRemaining: estimatedTimeRemaining(),
    formatTimeRemaining,

    // Connection info
    lastSuccessfulFetch: lastSuccessfulFetch.current,

    // Actions
    refetch,

    // Error state
    error,
  };
}
