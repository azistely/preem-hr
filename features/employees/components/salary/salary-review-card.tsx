/**
 * Salary Review Card
 *
 * Card displaying a pending salary review request
 * Following HCI principles:
 * - Clear visual hierarchy (employee → salary → actions)
 * - Prominent actions (Approve/Reject buttons)
 * - Status indicators with color/icon
 */

'use client';

import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Check,
  X,
  Eye,
  TrendingUp,
  Calendar,
  User,
  AlertCircle,
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { formatCurrency, calculatePercentageChange } from '../../hooks/use-salary-validation';

export interface SalaryReviewCardProps {
  review: {
    id: string;
    employeeId: string;
    employeeName: string;
    employeeNumber?: string;
    currentSalary: number;
    proposedSalary: number;
    effectiveFrom: string;
    reason: string;
    justification?: string;
    requestedBy: string;
    requestedAt: string;
    status: 'pending' | 'approved' | 'rejected';
  };
  onApprove?: (reviewId: string) => void;
  onReject?: (reviewId: string) => void;
  onViewDetails?: (reviewId: string) => void;
}

export function SalaryReviewCard({
  review,
  onApprove,
  onReject,
  onViewDetails,
}: SalaryReviewCardProps) {
  const change = review.proposedSalary - review.currentSalary;
  const percentageChange = calculatePercentageChange(
    review.currentSalary,
    review.proposedSalary
  );
  const isIncrease = change > 0;

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const statusConfig = {
    pending: {
      label: 'En attente',
      variant: 'secondary' as const,
      icon: AlertCircle,
    },
    approved: {
      label: 'Approuvé',
      variant: 'default' as const,
      icon: Check,
    },
    rejected: {
      label: 'Rejeté',
      variant: 'destructive' as const,
      icon: X,
    },
  };

  const status = statusConfig[review.status];

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between">
          {/* Employee Info */}
          <div className="flex items-center gap-3">
            <Avatar className="h-12 w-12">
              <AvatarFallback className="bg-primary text-primary-foreground font-semibold">
                {getInitials(review.employeeName)}
              </AvatarFallback>
            </Avatar>
            <div>
              <h3 className="font-semibold text-lg">{review.employeeName}</h3>
              {review.employeeNumber && (
                <p className="text-sm text-muted-foreground">
                  #{review.employeeNumber}
                </p>
              )}
            </div>
          </div>

          {/* Status Badge */}
          <Badge variant={status.variant} className="min-h-[32px] px-3">
            <status.icon className="mr-2 h-4 w-4" />
            {status.label}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Salary Change */}
        <div className="bg-muted/50 p-4 rounded-lg">
          <div className="grid grid-cols-3 gap-4">
            {/* Current */}
            <div>
              <p className="text-xs text-muted-foreground mb-1">Actuel</p>
              <p className="text-lg font-semibold line-through text-muted-foreground">
                {formatCurrency(review.currentSalary)}
              </p>
            </div>

            {/* Arrow + Change */}
            <div className="flex flex-col items-center justify-center">
              <TrendingUp
                className={`h-5 w-5 mb-1 ${
                  isIncrease ? 'text-green-600' : 'text-red-600'
                }`}
              />
              <Badge
                variant={isIncrease ? 'default' : 'destructive'}
                className="text-xs"
              >
                {isIncrease ? '+' : ''}
                {percentageChange.toFixed(1)}%
              </Badge>
            </div>

            {/* Proposed */}
            <div className="text-right">
              <p className="text-xs text-muted-foreground mb-1">Proposé</p>
              <p className="text-2xl font-bold text-primary">
                {formatCurrency(review.proposedSalary)}
              </p>
            </div>
          </div>
        </div>

        {/* Details */}
        <div className="grid gap-2 text-sm">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Date d'effet:</span>
            <span className="font-medium">
              {format(new Date(review.effectiveFrom), 'd MMMM yyyy', {
                locale: fr,
              })}
            </span>
          </div>

          <div className="flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
            <div>
              <span className="text-muted-foreground">Raison:</span>
              <span className="font-medium ml-1">{review.reason}</span>
            </div>
          </div>

          {review.justification && (
            <div className="mt-2 p-3 bg-muted/30 rounded text-sm">
              <p className="text-muted-foreground italic">
                "{review.justification}"
              </p>
            </div>
          )}

          <div className="flex items-center gap-2 mt-2">
            <User className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">
              Demandé par {review.requestedBy} •{' '}
              {format(new Date(review.requestedAt), 'd MMM yyyy', {
                locale: fr,
              })}
            </span>
          </div>
        </div>
      </CardContent>

      {/* Actions (only for pending reviews) */}
      {review.status === 'pending' && (
        <CardFooter className="flex gap-3 pt-4">
          <Button
            variant="outline"
            className="flex-1 min-h-[44px]"
            onClick={() => onViewDetails?.(review.id)}
          >
            <Eye className="mr-2 h-4 w-4" />
            Voir détails
          </Button>

          <Button
            variant="destructive"
            className="min-h-[44px] min-w-[100px]"
            onClick={() => onReject?.(review.id)}
          >
            <X className="mr-2 h-4 w-4" />
            Rejeter
          </Button>

          <Button
            variant="default"
            className="min-h-[44px] min-w-[120px] bg-green-600 hover:bg-green-700"
            onClick={() => onApprove?.(review.id)}
          >
            <Check className="mr-2 h-4 w-4" />
            Approuver
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}
