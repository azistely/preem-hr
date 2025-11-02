'use client';

/**
 * Dashboard Summary Card - Draft Mode
 *
 * Shows overall review status with:
 * - Counts by status (Critical/Warning/Ready)
 * - Progress bar showing completion percentage
 * - Estimated time remaining
 * - Quick stats (total employees, reviewed count)
 *
 * Design: Visual hierarchy, color-coded sections, mobile-first
 */

import { AlertCircle, AlertTriangle, CheckCircle2, Users, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { api } from '@/trpc/react';

interface DashboardSummaryCardProps {
  runId: string;
}

export function DashboardSummaryCard({ runId }: DashboardSummaryCardProps) {
  // Get grouped employees data
  const { data: employees = [], isLoading } = api.payroll.getDraftEmployeesGrouped.useQuery({
    runId,
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-muted rounded" />
            <div className="h-24 bg-muted rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  // Calculate counts by status
  const criticalCount = employees.filter((e) => e.status === 'critical').length;
  const warningCount = employees.filter((e) => e.status === 'warning').length;
  const readyCount = employees.filter((e) => e.status === 'ready').length;
  const totalCount = employees.length;

  // Calculate completion percentage
  // "Ready" employees are considered reviewed and ready
  const completionPercentage = totalCount > 0 ? Math.round((readyCount / totalCount) * 100) : 0;

  // Estimate time remaining (assume 2 min per critical, 1 min per warning)
  const estimatedMinutes = criticalCount * 2 + warningCount * 1;
  const estimatedTimeText =
    estimatedMinutes === 0
      ? 'Prêt à calculer'
      : estimatedMinutes < 60
        ? `~${estimatedMinutes} min restantes`
        : `~${Math.round(estimatedMinutes / 60)}h ${estimatedMinutes % 60}min restantes`;

  return (
    <Card className="border-2">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Users className="h-5 w-5" />
          Résumé de la Révision
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Overall Progress */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Progression</span>
            <span className="text-2xl font-bold text-primary">
              {completionPercentage}%
            </span>
          </div>
          <Progress value={completionPercentage} className="h-3" />
          <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
            <span>
              {readyCount} / {totalCount} employés prêts
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {estimatedTimeText}
            </span>
          </div>
        </div>

        {/* Status Breakdown */}
        <div className="grid grid-cols-3 gap-3">
          {/* Critical */}
          <div
            className={`p-3 rounded-lg border-2 ${
              criticalCount > 0
                ? 'bg-red-50 border-red-200'
                : 'bg-muted/50 border-muted'
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <AlertCircle
                className={`h-4 w-4 ${
                  criticalCount > 0 ? 'text-red-600' : 'text-muted-foreground'
                }`}
              />
              <span className="text-xs text-muted-foreground">Nécessite attention</span>
            </div>
            <div
              className={`text-2xl font-bold ${
                criticalCount > 0 ? 'text-red-700' : 'text-muted-foreground'
              }`}
            >
              {criticalCount}
            </div>
          </div>

          {/* Warning */}
          <div
            className={`p-3 rounded-lg border-2 ${
              warningCount > 0
                ? 'bg-orange-50 border-orange-200'
                : 'bg-muted/50 border-muted'
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle
                className={`h-4 w-4 ${
                  warningCount > 0 ? 'text-orange-600' : 'text-muted-foreground'
                }`}
              />
              <span className="text-xs text-muted-foreground">À vérifier</span>
            </div>
            <div
              className={`text-2xl font-bold ${
                warningCount > 0 ? 'text-orange-700' : 'text-muted-foreground'
              }`}
            >
              {warningCount}
            </div>
          </div>

          {/* Ready */}
          <div
            className={`p-3 rounded-lg border-2 ${
              readyCount > 0
                ? 'bg-green-50 border-green-200'
                : 'bg-muted/50 border-muted'
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle2
                className={`h-4 w-4 ${
                  readyCount > 0 ? 'text-green-600' : 'text-muted-foreground'
                }`}
              />
              <span className="text-xs text-muted-foreground">Prêts</span>
            </div>
            <div
              className={`text-2xl font-bold ${
                readyCount > 0 ? 'text-green-700' : 'text-muted-foreground'
              }`}
            >
              {readyCount}
            </div>
          </div>
        </div>

        {/* Status Message */}
        {completionPercentage === 100 ? (
          <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-sm font-medium text-green-900 text-center">
              ✓ Tous les employés sont prêts pour le calcul
            </p>
          </div>
        ) : criticalCount > 0 ? (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm font-medium text-red-900">
              <AlertCircle className="h-4 w-4 inline mr-1" />
              {criticalCount} employé{criticalCount > 1 ? 's nécessitent' : ' nécessite'} une
              attention immédiate
            </p>
          </div>
        ) : warningCount > 0 ? (
          <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
            <p className="text-sm font-medium text-orange-900">
              <AlertTriangle className="h-4 w-4 inline mr-1" />
              {warningCount} employé{warningCount > 1 ? 's à vérifier' : ' à vérifier'}
            </p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
