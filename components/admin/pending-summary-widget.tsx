/**
 * Pending Summary Widget
 *
 * Shows key metrics for pending approvals:
 * - Count of pending items
 * - Total overtime hours (for time tracking)
 * - Quick action buttons
 */

'use client';

import { Bell, Clock, CheckCheck } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface PendingSummaryWidgetProps {
  pendingCount: number;
  totalOvertimeHours?: number;
  onBulkApprove?: () => void;
  isLoading?: boolean;
  type: 'time-tracking' | 'time-off';
}

export function PendingSummaryWidget({
  pendingCount,
  totalOvertimeHours,
  onBulkApprove,
  isLoading = false,
  type,
}: PendingSummaryWidgetProps) {
  return (
    <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-10 w-10 rounded-full bg-blue-500 flex items-center justify-center">
              <Bell className="h-5 w-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-2xl font-bold text-blue-900">
                {pendingCount}
              </CardTitle>
              <CardDescription className="text-blue-700">
                {type === 'time-tracking'
                  ? 'entrées en attente'
                  : 'demandes en attente'}
              </CardDescription>
            </div>
          </div>

          {totalOvertimeHours !== undefined && totalOvertimeHours > 0 && (
            <div className="text-right">
              <div className="flex items-center gap-1 text-amber-700">
                <Clock className="h-4 w-4" />
                <p className="text-lg font-bold">{totalOvertimeHours.toFixed(1)}h</p>
              </div>
              <p className="text-xs text-amber-600">Heures sup. totales</p>
            </div>
          )}
        </div>
      </CardHeader>

      {pendingCount > 0 && onBulkApprove && (
        <CardContent>
          <Button
            className="w-full min-h-[56px] text-lg"
            variant="default"
            onClick={onBulkApprove}
            disabled={isLoading}
          >
            <CheckCheck className="mr-2 h-6 w-6" />
            Tout approuver ({pendingCount})
          </Button>
        </CardContent>
      )}
    </Card>
  );
}
