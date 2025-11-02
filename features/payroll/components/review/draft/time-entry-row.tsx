'use client';

/**
 * Time Entry Row Component
 *
 * Displays a single day's time entry with status and quick actions
 * - Touch-friendly with swipe gestures
 * - Status badges (approved, pending, missing)
 * - Click to view details
 *
 * Design: Mobile-first, 44px min height, clear visual feedback
 */

import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Clock, Check, AlertCircle, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type TimeEntryStatus = 'approved' | 'pending' | 'rejected' | 'missing';

interface TimeEntry {
  id: string;
  clockIn: string; // ISO date string
  clockOut: string | null; // ISO date string
  totalHours: number | null;
  status: TimeEntryStatus;
  notes: string | null;
}

interface TimeEntryRowProps {
  date: string; // ISO date string
  entry: TimeEntry | null;
  onEntryClick: () => void;
  onQuickApprove?: () => void;
  onQuickReject?: () => void;
  showActions?: boolean;
}

export function TimeEntryRow({
  date,
  entry,
  onEntryClick,
  onQuickApprove,
  onQuickReject,
  showActions = true,
}: TimeEntryRowProps) {
  const dateObj = parseISO(date);
  const dayLabel = format(dateObj, 'EEE dd MMM', { locale: fr });

  // Status configuration
  const getStatusConfig = (status: TimeEntryStatus) => {
    const configs = {
      approved: {
        icon: Check,
        label: 'Approuvé',
        variant: 'default' as const,
        colorClass: 'bg-green-100 text-green-700 border-green-300',
      },
      pending: {
        icon: Clock,
        label: 'En attente',
        variant: 'secondary' as const,
        colorClass: 'bg-orange-100 text-orange-700 border-orange-300',
      },
      rejected: {
        icon: XCircle,
        label: 'Rejeté',
        variant: 'destructive' as const,
        colorClass: 'bg-red-100 text-red-700 border-red-300',
      },
      missing: {
        icon: AlertCircle,
        label: 'Manquant',
        variant: 'destructive' as const,
        colorClass: 'bg-red-100 text-red-700 border-red-300',
      },
    };
    return configs[status];
  };

  const status: TimeEntryStatus = entry
    ? (entry.status as TimeEntryStatus)
    : 'missing';
  const config = getStatusConfig(status);
  const StatusIcon = config.icon;

  const formatTime = (isoDate: string | null) => {
    if (!isoDate) return '--:--';
    return format(parseISO(isoDate), 'HH:mm');
  };

  return (
    <div
      className={cn(
        'flex items-center gap-3 p-3 rounded-lg border min-h-[60px] transition-colors',
        entry ? 'bg-white hover:bg-muted/30 cursor-pointer' : 'bg-muted/20'
      )}
      onClick={entry ? onEntryClick : undefined}
    >
      {/* Date Label */}
      <div className="flex-shrink-0 w-24">
        <div className="text-sm font-medium">{dayLabel}</div>
      </div>

      {/* Time Range or Missing Message */}
      <div className="flex-1 min-w-0">
        {entry ? (
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <span className="font-mono">
                {formatTime(entry.clockIn)} - {formatTime(entry.clockOut)}
              </span>
              {entry.totalHours !== null && (
                <Badge variant="outline" className="ml-2">
                  {entry.totalHours.toFixed(1)}h
                </Badge>
              )}
            </div>
            {entry.notes && (
              <div className="text-xs text-muted-foreground truncate">
                {entry.notes}
              </div>
            )}
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">
            Pas de saisie
          </div>
        )}
      </div>

      {/* Status Badge */}
      <div className="flex-shrink-0">
        <Badge
          variant={config.variant}
          className={cn(
            'inline-flex items-center gap-1 border',
            config.colorClass
          )}
        >
          <StatusIcon className="h-3 w-3" />
          <span className="hidden sm:inline">{config.label}</span>
        </Badge>
      </div>

      {/* Quick Actions (for pending entries) */}
      {showActions && entry && status === 'pending' && (
        <div className="flex-shrink-0 flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={(e) => {
              e.stopPropagation();
              onQuickApprove?.();
            }}
            className="h-9 w-9 p-0 border-green-300 hover:bg-green-50"
            title="Approuver"
          >
            <Check className="h-4 w-4 text-green-600" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={(e) => {
              e.stopPropagation();
              onQuickReject?.();
            }}
            className="h-9 w-9 p-0 border-red-300 hover:bg-red-50"
            title="Rejeter"
          >
            <XCircle className="h-4 w-4 text-red-600" />
          </Button>
        </div>
      )}
    </div>
  );
}
