'use client';

/**
 * Enhanced Summary Card Component
 *
 * Shows summary statistics with verification counts and variance breakdown
 */

import { Users, TrendingUp, TrendingDown } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface EnhancedSummaryCardProps {
  totalEmployees: number;
  verifiedCount?: number;
  flaggedCount?: number;
  unverifiedCount?: number;
  totalNet?: number;
  previousNet?: number;
  varianceBreakdown?: {
    overtime: number;
    newEmployees: number;
    absences: number;
    other: number;
  };
}

export function EnhancedSummaryCard({
  totalEmployees,
  verifiedCount = 0,
  flaggedCount = 0,
  unverifiedCount = 0,
  totalNet,
  previousNet,
  varianceBreakdown,
}: EnhancedSummaryCardProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR').format(Math.round(amount));
  };

  const variance = totalNet && previousNet ? totalNet - previousNet : 0;
  const variancePercent = totalNet && previousNet ? (variance / previousNet) * 100 : 0;

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* Employee Count with Verification Status */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Employés Traités</CardTitle>
          <Users className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{totalEmployees}</div>
          {(verifiedCount > 0 || flaggedCount > 0 || unverifiedCount > 0) && (
            <div className="mt-3 space-y-1 text-xs text-muted-foreground">
              <div className="flex justify-between">
                <span>• Vérifiés</span>
                <span className="font-medium text-green-600">{verifiedCount}</span>
              </div>
              {flaggedCount > 0 && (
                <div className="flex justify-between">
                  <span>• À vérifier</span>
                  <span className="font-medium text-orange-600">{flaggedCount}</span>
                </div>
              )}
              {unverifiedCount > 0 && (
                <div className="flex justify-between">
                  <span>• Non vérifiés</span>
                  <span className="font-medium text-gray-600">{unverifiedCount}</span>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Total Net with Variance */}
      {totalNet !== undefined && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Net</CardTitle>
            {variancePercent !== 0 && (
              variancePercent > 0 ? (
                <TrendingUp className="h-4 w-4 text-green-600" />
              ) : (
                <TrendingDown className="h-4 w-4 text-red-600" />
              )
            )}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              {formatCurrency(totalNet)} FCFA
            </div>
            {previousNet && variance !== 0 && (
              <div className="mt-3 space-y-2">
                <div className="text-sm">
                  <span className="text-muted-foreground">vs Mois Dernier:</span>
                  <div className={`font-semibold ${variancePercent > 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {variancePercent > 0 && '+'}
                    {formatCurrency(variance)} FCFA ({variancePercent > 0 && '+'}
                    {variancePercent.toFixed(1)}%)
                  </div>
                </div>

                {varianceBreakdown && (
                  <div className="space-y-1 text-xs text-muted-foreground pt-2 border-t">
                    <div className="font-medium mb-1">Raisons:</div>
                    {varianceBreakdown.overtime !== 0 && (
                      <div className="flex justify-between">
                        <span>• Heures sup</span>
                        <span className="font-medium">
                          {varianceBreakdown.overtime > 0 && '+'}
                          {formatCurrency(varianceBreakdown.overtime)}
                        </span>
                      </div>
                    )}
                    {varianceBreakdown.newEmployees !== 0 && (
                      <div className="flex justify-between">
                        <span>• Nouveaux employés</span>
                        <span className="font-medium">
                          {varianceBreakdown.newEmployees > 0 && '+'}
                          {formatCurrency(varianceBreakdown.newEmployees)}
                        </span>
                      </div>
                    )}
                    {varianceBreakdown.absences !== 0 && (
                      <div className="flex justify-between">
                        <span>• Absences</span>
                        <span className="font-medium">
                          {varianceBreakdown.absences > 0 && '+'}
                          {formatCurrency(varianceBreakdown.absences)}
                        </span>
                      </div>
                    )}
                    {varianceBreakdown.other !== 0 && (
                      <div className="flex justify-between">
                        <span>• Autre</span>
                        <span className="font-medium">
                          {varianceBreakdown.other > 0 && '+'}
                          {formatCurrency(varianceBreakdown.other)}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
