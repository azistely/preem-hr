/**
 * ConnectionStatus Component
 *
 * Shows a visual indicator when the user is offline.
 * Designed to be unobtrusive but clearly visible.
 */

'use client';

import { WifiOff, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ConnectionStatusProps {
  /** Current online status */
  isOnline: boolean;
  /** Whether currently retrying */
  isRetrying?: boolean;
  /** Current retry count */
  retryCount?: number;
  /** Max retries allowed */
  maxRetries?: number;
  /** Optional className */
  className?: string;
}

export function ConnectionStatus({
  isOnline,
  isRetrying = false,
  retryCount = 0,
  maxRetries = 3,
  className,
}: ConnectionStatusProps) {
  // Show nothing if online and not retrying
  if (isOnline && !isRetrying) {
    return null;
  }

  // Offline state
  if (!isOnline) {
    return (
      <div
        className={cn(
          'flex items-center gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 px-3 py-2 rounded-md',
          className
        )}
        role="alert"
        aria-live="polite"
      >
        <WifiOff className="h-4 w-4 flex-shrink-0" />
        <span>Pas de connexion internet</span>
      </div>
    );
  }

  // Retrying state (online but had error)
  if (isRetrying) {
    return (
      <div
        className={cn(
          'flex items-center gap-2 text-sm text-blue-700 bg-blue-50 border border-blue-200 px-3 py-2 rounded-md',
          className
        )}
        role="status"
        aria-live="polite"
      >
        <RefreshCw className="h-4 w-4 flex-shrink-0 animate-spin" />
        <span>
          Nouvelle tentative en cours... ({retryCount}/{maxRetries})
        </span>
      </div>
    );
  }

  return null;
}
