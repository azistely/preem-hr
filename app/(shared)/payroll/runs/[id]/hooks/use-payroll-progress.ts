/**
 * Payroll Progress Hook
 *
 * Tracks progress of long-running payroll calculations.
 * Polls the server for updates and provides real-time status to the UI.
 *
 * Features:
 * - Automatic polling when calculation is in progress
 * - Adaptive poll interval (faster when online, slower when offline)
 * - Estimated completion time calculation
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
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
  /** Initial polling interval in ms (default: 2000ms) */
  pollInterval?: number;
  /** Polling interval when offline in ms (default: 10000ms) */
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
    offlinePollInterval = 10000,
    enabled = true,
  } = options;

  const [isOnline, setIsOnline] = useState(true);

  // Track online/offline status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    setIsOnline(navigator.onLine);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Determine current poll interval
  const currentPollInterval = isOnline ? pollInterval : offlinePollInterval;

  // Query for progress
  const {
    data: progress,
    isLoading,
    error,
    refetch,
  } = api.payroll.getProgress.useQuery(
    { runId: runId! },
    {
      enabled: enabled && !!runId,
      // Only poll when processing
      refetchInterval: (query) => {
        const data = query.state.data;
        if (data?.status === 'processing') {
          return currentPollInterval;
        }
        return false; // Stop polling when not processing
      },
      // Refetch when window regains focus (user returns after disconnect)
      refetchOnWindowFocus: true,
    }
  );

  // Calculate derived state
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

    // Actions
    refetch,

    // Error state
    error,
  };
}
