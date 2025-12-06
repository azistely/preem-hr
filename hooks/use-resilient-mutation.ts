/**
 * useResilientMutation Hook
 *
 * Wraps tRPC mutations with network resilience features:
 * - Online/offline detection
 * - Automatic retry with exponential backoff
 * - User-friendly error messages in French
 * - Manual retry capability
 *
 * Designed for unreliable 3G connections in West Africa.
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import type { UseTRPCMutationResult } from '@trpc/react-query/shared';

interface UseResilientMutationOptions<TData, TVariables> {
  /** The tRPC mutation to wrap */
  mutation: UseTRPCMutationResult<TData, unknown, TVariables, unknown>;
  /** Maximum number of automatic retries (default: 3) */
  maxRetries?: number;
  /** Base delay in ms for exponential backoff (default: 2000) */
  retryDelayMs?: number;
  /** Callback on successful mutation */
  onSuccess?: (data: TData) => void;
  /** Callback on final error (after all retries exhausted) */
  onError?: (error: unknown) => void;
  /** Toast message on success */
  successMessage?: string;
  /** Fallback error message */
  errorMessage?: string;
}

interface UseResilientMutationResult<TVariables> {
  /** Call this to execute the mutation */
  mutate: (variables: TVariables) => Promise<void>;
  /** Manual retry with last attempted variables */
  retry: () => void;
  /** Current online status */
  isOnline: boolean;
  /** Whether mutation is currently pending */
  isPending: boolean;
  /** Whether currently in retry mode */
  isRetrying: boolean;
  /** Number of retries attempted */
  retryCount: number;
  /** Last error encountered */
  lastError: unknown;
  /** Whether manual retry is available */
  canRetry: boolean;
}

/**
 * Determines if an error is network-related (retryable)
 */
function isNetworkError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return (
      message.includes('fetch') ||
      message.includes('network') ||
      message.includes('failed to fetch') ||
      message.includes('timeout') ||
      message.includes('aborted') ||
      message.includes('connection')
    );
  }
  return false;
}

/**
 * Gets a user-friendly error message in French
 */
function getErrorMessage(error: unknown, fallback?: string): string {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    // Network errors
    if (
      message.includes('fetch') ||
      message.includes('network') ||
      message.includes('failed to fetch')
    ) {
      return 'Connexion interrompue. Vérifiez votre connexion internet.';
    }

    if (message.includes('timeout')) {
      return 'La requête a pris trop de temps. Veuillez réessayer.';
    }

    // Server errors
    if (message.includes('500') || message.includes('internal server')) {
      return 'Erreur serveur. Veuillez réessayer dans quelques instants.';
    }

    // Return tRPC error message if it's user-friendly (from our backend)
    if (error.message && !message.includes('trpc')) {
      return error.message;
    }
  }

  return fallback || 'Une erreur est survenue. Veuillez réessayer.';
}

export function useResilientMutation<TData, TVariables>({
  mutation,
  maxRetries = 3,
  retryDelayMs = 2000,
  onSuccess,
  onError,
  successMessage,
  errorMessage,
}: UseResilientMutationOptions<TData, TVariables>): UseResilientMutationResult<TVariables> {
  const [isOnline, setIsOnline] = useState(true);
  const [retryCount, setRetryCount] = useState(0);
  const [lastError, setLastError] = useState<unknown>(null);
  const [pendingVariables, setPendingVariables] = useState<TVariables | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);

  // Use ref to avoid stale closure in event handlers
  const pendingVariablesRef = useRef<TVariables | null>(null);
  const retryCountRef = useRef(0);

  // Keep refs in sync with state
  useEffect(() => {
    pendingVariablesRef.current = pendingVariables;
  }, [pendingVariables]);

  useEffect(() => {
    retryCountRef.current = retryCount;
  }, [retryCount]);

  // Online/offline detection
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      toast.success('Connexion rétablie');

      // Auto-retry pending mutation when back online
      if (pendingVariablesRef.current && retryCountRef.current < maxRetries) {
        toast.info('Nouvelle tentative automatique...');
        // Small delay to let connection stabilize
        setTimeout(() => {
          if (pendingVariablesRef.current) {
            executeMutation(pendingVariablesRef.current);
          }
        }, 1000);
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      toast.warning('Connexion internet perdue');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Set initial state
    setIsOnline(typeof navigator !== 'undefined' ? navigator.onLine : true);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [maxRetries]);

  const executeMutation = useCallback(
    async (variables: TVariables) => {
      // Check online status first
      if (!navigator.onLine) {
        toast.error('Pas de connexion internet. Réessai automatique dès que possible.');
        setPendingVariables(variables);
        return;
      }

      try {
        const result = await mutation.mutateAsync(variables);

        // Success - reset all state
        setRetryCount(0);
        setPendingVariables(null);
        setLastError(null);
        setIsRetrying(false);

        if (successMessage) {
          toast.success(successMessage);
        }

        onSuccess?.(result);
      } catch (error) {
        setLastError(error);

        // Check if we should retry
        if (retryCount < maxRetries && isNetworkError(error)) {
          const newRetryCount = retryCount + 1;
          setRetryCount(newRetryCount);
          setPendingVariables(variables);
          setIsRetrying(true);

          const delay = retryDelayMs * Math.pow(2, retryCount);
          toast.info(
            `Connexion instable. Nouvelle tentative dans ${Math.round(delay / 1000)}s... (${newRetryCount}/${maxRetries})`
          );

          setTimeout(() => {
            executeMutation(variables);
          }, delay);
        } else {
          // Final failure
          setIsRetrying(false);
          const message = getErrorMessage(error, errorMessage);
          toast.error(message);
          onError?.(error);
        }
      }
    },
    [
      mutation,
      retryCount,
      maxRetries,
      retryDelayMs,
      onSuccess,
      onError,
      successMessage,
      errorMessage,
    ]
  );

  const mutate = useCallback(
    async (variables: TVariables) => {
      // Reset state for new mutation
      setRetryCount(0);
      setLastError(null);
      setIsRetrying(false);
      setPendingVariables(null);

      await executeMutation(variables);
    },
    [executeMutation]
  );

  const retry = useCallback(() => {
    if (pendingVariables) {
      setRetryCount(0);
      setIsRetrying(true);
      toast.info('Nouvelle tentative...');
      executeMutation(pendingVariables);
    }
  }, [pendingVariables, executeMutation]);

  return {
    mutate,
    retry,
    isOnline,
    isPending: mutation.isPending,
    isRetrying,
    retryCount,
    lastError,
    canRetry: !!pendingVariables && !mutation.isPending,
  };
}
