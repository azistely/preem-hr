/**
 * Termination Progress Hook
 *
 * Tracks progress of background termination processing (STC + documents).
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

export interface TerminationProgressState {
  status: 'idle' | 'pending' | 'processing' | 'completed' | 'failed';
  progress: number; // 0-100
  currentStep: string | null;
  startedAt: string | null;
  completedAt: string | null;
  error: string | null;
  inngestRunId: string | null;
  stcResults: {
    calculatedAt: string;
    severancePay: number;
    vacationPayout: number;
    gratification: number;
    proratedSalary: number;
    noticePayment: number;
    grossTotal: number;
    netTotal: number;
    yearsOfService: number;
    averageSalary12M: number;
  } | null;
  documents: {
    workCertificateId: string | null;
    finalPayslipId: string | null;
    cnpsAttestationId: string | null;
  };
}

interface UseTerminationProgressOptions {
  /** Initial polling interval in ms (default: 2000ms for good connection) */
  pollInterval?: number;
  /** Polling interval when offline/slow in ms (default: 5000ms) */
  offlinePollInterval?: number;
  /** Whether to enable polling (default: true) */
  enabled?: boolean;
}

export function useTerminationProgress(
  terminationId: string | null,
  options: UseTerminationProgressOptions = {}
) {
  const {
    pollInterval = 2000,
    offlinePollInterval = 5000,
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
      if (enabled && terminationId) {
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
  }, [enabled, terminationId]);

  // Determine current poll interval
  const currentPollInterval = isOnline ? pollInterval : offlinePollInterval;

  // Query for progress with retry logic for unreliable connections
  const {
    data: progress,
    isLoading,
    error,
    refetch,
    isFetching,
  } = api.terminations.getTerminationProgress.useQuery(
    { terminationId: terminationId! },
    {
      enabled: enabled && !!terminationId,
      // Poll during pending, processing, and idle states
      // Note: 'idle' is included because there's a race condition where the query
      // can return before the mutation sets processingStatus to 'pending'
      refetchInterval: (query) => {
        const data = query.state.data;
        // Stop polling only when completed or failed
        if (data?.status === 'completed' || data?.status === 'failed') {
          console.log('[useTerminationProgress] Stopping polling - status:', data.status);
          return false;
        }
        // Keep polling for idle, pending, processing, no data, or error
        console.log('[useTerminationProgress] Continuing to poll - status:', data?.status);
        return currentPollInterval;
      },
      // Refetch when window regains focus
      refetchOnWindowFocus: true,
      // Keep showing last data while refetching
      placeholderData: (previousData) => previousData,
      // Retry configuration for unreliable 3G
      retry: 3,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
      // Don't throw errors - we handle them gracefully
      throwOnError: false,
      // Stale time
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
  const isIdle = progress?.status === 'idle';
  const isPending = progress?.status === 'pending';
  const isProcessing = progress?.status === 'processing';
  const isCompleted = progress?.status === 'completed';
  const isFailed = progress?.status === 'failed';

  // Debug logging
  useEffect(() => {
    if (terminationId) {
      console.log('[useTerminationProgress] State update:', {
        terminationId,
        status: progress?.status,
        isCompleted,
        isProcessing,
        isPending,
        progress: progress?.progress,
        currentStep: progress?.currentStep,
        isFetching,
        isLoading,
      });
    }
  }, [terminationId, progress, isCompleted, isProcessing, isPending, isFetching, isLoading]);

  // Calculate estimated time remaining
  const estimatedTimeRemaining = useCallback(() => {
    if (!progress?.startedAt || !isProcessing || progress.progress === 0) {
      return null;
    }

    const elapsed = Date.now() - new Date(progress.startedAt).getTime();
    const rate = progress.progress / elapsed; // percent per ms
    const remaining = 100 - progress.progress;
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
    progress: progress as TerminationProgressState | undefined,

    // Convenience booleans
    isLoading,
    isFetching,
    isIdle,
    isPending,
    isProcessing,
    isCompleted,
    isFailed,
    isOnline,

    // Progress metrics
    percentComplete: progress?.progress ?? 0,
    currentStep: progress?.currentStep ?? null,

    // STC results (available after calculation)
    stcResults: progress?.stcResults ?? null,

    // Document IDs and URLs (available after generation)
    documents: progress?.documents ?? {
      workCertificateId: null,
      workCertificateUrl: null,
      finalPayslipId: null,
      finalPayslipUrl: null,
      cnpsAttestationId: null,
      cnpsAttestationUrl: null,
    },

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
