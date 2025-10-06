/**
 * Salary Comparison Card
 *
 * Visual comparison of old vs new salary with change indicator
 * Following HCI principle: Show clear outcomes, visual hierarchy
 */

'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowRight, TrendingUp, TrendingDown } from 'lucide-react';
import { calculatePercentageChange, formatCurrency } from '../../hooks/use-salary-validation';

interface SalaryComparisonCardProps {
  oldSalary: number;
  newSalary: number;
  label?: string;
}

export function SalaryComparisonCard({
  oldSalary,
  newSalary,
  label = 'Salaire de base',
}: SalaryComparisonCardProps) {
  const change = newSalary - oldSalary;
  const percentageChange = calculatePercentageChange(oldSalary, newSalary);
  const isIncrease = change > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Visual Comparison */}
        <div className="flex items-center justify-between gap-4">
          {/* Old Salary */}
          <div className="flex-1">
            <p className="text-sm text-muted-foreground">Actuel</p>
            <p className="text-2xl font-bold line-through text-muted-foreground">
              {formatCurrency(oldSalary)}
            </p>
          </div>

          {/* Arrow */}
          <ArrowRight className="h-6 w-6 text-muted-foreground flex-shrink-0" />

          {/* New Salary */}
          <div className="flex-1 text-right">
            <p className="text-sm text-muted-foreground">Nouveau</p>
            <p className="text-3xl font-bold text-primary">
              {formatCurrency(newSalary)}
            </p>
          </div>
        </div>

        {/* Change Indicator */}
        <div className="mt-4 flex items-center justify-center gap-2">
          <Badge
            variant={isIncrease ? 'default' : 'destructive'}
            className="min-h-[32px] px-4"
          >
            {isIncrease ? (
              <TrendingUp className="mr-2 h-4 w-4" />
            ) : (
              <TrendingDown className="mr-2 h-4 w-4" />
            )}
            <span className="text-base font-semibold">
              {isIncrease ? '+' : ''}
              {formatCurrency(change)}
              {' '}
              ({percentageChange.toFixed(1)}%)
            </span>
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}
