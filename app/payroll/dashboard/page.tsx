/**
 * Payroll Reports Dashboard (P1-7)
 *
 * Comprehensive payroll reporting dashboard for HR/Admin roles.
 * Displays monthly payroll summary with key metrics and trends.
 *
 * Following HCI principles:
 * - Zero learning curve (big numbers in cards)
 * - Smart defaults (current month pre-selected)
 * - Progressive disclosure (summary first, details on demand)
 * - Mobile-first (responsive grid, touch targets >= 44px)
 * - French language for all UI text
 */

'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, TrendingUp, Users, DollarSign, Building, Download } from 'lucide-react';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { fr } from 'date-fns/locale';

export default function PayrollDashboardPage() {
  // Default to current month
  const now = new Date();
  const [startDate] = useState(startOfMonth(now));
  const [endDate] = useState(endOfMonth(now));

  // Fetch dashboard summary
  const { data: summary, isLoading, error } = trpc.payroll.getDashboardSummary.useQuery({
    startDate,
    endDate,
  });

  // Format currency (French formatting)
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR').format(Math.round(amount)) + ' FCFA';
  };

  if (isLoading) {
    return (
      <div className="container mx-auto max-w-6xl py-8 px-4">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto max-w-6xl py-8 px-4">
        <Card className="border-destructive">
          <CardContent className="p-6">
            <p className="text-sm text-destructive">
              Erreur: {error.message || 'Impossible de charger les données'}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const periodLabel = format(startDate, 'MMMM yyyy', { locale: fr });

  return (
    <div className="container mx-auto max-w-6xl py-8 px-4">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-3xl font-bold">Tableau de bord paie</h1>
          <Button variant="outline" className="min-h-[44px]" disabled>
            <Download className="mr-2 h-4 w-4" />
            Exporter (bientôt)
          </Button>
        </div>
        <p className="text-muted-foreground">
          Période: {periodLabel.charAt(0).toUpperCase() + periodLabel.slice(1)}
        </p>
      </div>

      {/* Metrics Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mb-8">
        {/* Employee Count */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
              <Users className="h-4 w-4" />
              Nombre d'employés
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary">
              {summary?.employeeCount || 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              employés payés ce mois
            </p>
          </CardContent>
        </Card>

        {/* Total Gross Salary */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
              <DollarSign className="h-4 w-4" />
              Salaire brut total
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary">
              {formatCurrency(summary?.totalGross || 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              avant déductions
            </p>
          </CardContent>
        </Card>

        {/* Total Net Salary */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
              <TrendingUp className="h-4 w-4" />
              Salaire net total
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">
              {formatCurrency(summary?.totalNet || 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              versé aux employés
            </p>
          </CardContent>
        </Card>

        {/* Employer Contributions */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
              <Building className="h-4 w-4" />
              Charges patronales
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-orange-600">
              {formatCurrency(summary?.totalEmployerContributions || 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              CNPS + CMU employeur
            </p>
          </CardContent>
        </Card>

        {/* Average Cost per Employee */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
              <Users className="h-4 w-4" />
              Coût moyen par employé
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary">
              {formatCurrency(summary?.avgCostPerEmployee || 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              salaire brut + charges
            </p>
          </CardContent>
        </Card>

        {/* Total Cost */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
              <DollarSign className="h-4 w-4" />
              Coût total
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600">
              {formatCurrency(
                (summary?.totalGross || 0) + (summary?.totalEmployerContributions || 0)
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              coût complet de la paie
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Summary Card */}
      <Card>
        <CardHeader>
          <CardTitle>Résumé</CardTitle>
          <CardDescription>
            Vue d'ensemble des coûts de paie pour {periodLabel}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between py-3 border-b">
              <span className="text-sm font-medium">Salaire brut total</span>
              <span className="text-sm font-bold">{formatCurrency(summary?.totalGross || 0)}</span>
            </div>
            <div className="flex items-center justify-between py-3 border-b">
              <span className="text-sm font-medium">Charges patronales (CNPS + CMU)</span>
              <span className="text-sm font-bold text-orange-600">
                + {formatCurrency(summary?.totalEmployerContributions || 0)}
              </span>
            </div>
            <div className="flex items-center justify-between py-3 border-t-2">
              <span className="text-lg font-bold">Coût total entreprise</span>
              <span className="text-lg font-bold text-primary">
                {formatCurrency(
                  (summary?.totalGross || 0) + (summary?.totalEmployerContributions || 0)
                )}
              </span>
            </div>
            <div className="flex items-center justify-between py-3 border-t">
              <span className="text-lg font-bold">Montant versé aux employés</span>
              <span className="text-lg font-bold text-green-600">
                {formatCurrency(summary?.totalNet || 0)}
              </span>
            </div>
          </div>

          <div className="mt-6 p-4 bg-muted rounded-lg">
            <p className="text-sm text-muted-foreground">
              <strong>Note:</strong> Ces chiffres incluent uniquement les bulletins de paie
              finalisés ou payés pour la période sélectionnée.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
