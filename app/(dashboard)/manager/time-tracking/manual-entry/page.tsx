/**
 * Manual Time Entry Page
 *
 * Allows managers/HR to manually enter hours for employees.
 * Integrates with existing time tracking and overtime calculation.
 *
 * Features:
 * - Month/period selector
 * - Employee list with manual time entries
 * - Add/edit/delete manual time entries
 * - Automatic overtime calculation
 * - Approval workflow integration
 *
 * HCI Principles:
 * - Zero Learning Curve - Instant understanding
 * - Task-Oriented - "Enter employee hours" not "Manage time entries"
 * - Smart Defaults - Current month pre-selected
 * - Clear Visual Hierarchy - Focus on the task
 */

'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar, Info, ArrowLeft, Home } from 'lucide-react';
import { MonthPicker } from '@/components/ui/month-picker';
import { ManualTimeEntriesTable } from '@/features/time-tracking/components/manual-time-entries-table';
import { trpc } from '@/lib/trpc/client';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function ManualTimeEntryPage() {
  // Smart default: Current month
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  });

  // Calculate period start and end dates
  const period = useMemo(() => {
    // Parse the date string manually to avoid timezone issues
    const [year, month] = selectedMonth.split('-').map(Number);

    // month is 1-indexed in the string (01 = January), but Date() expects 0-indexed (0 = January)
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    return { startDate, endDate };
  }, [selectedMonth]);

  // Fetch active employees
  const { data: employeesData, isLoading: loadingEmployees } =
    trpc.employees.list.useQuery({
      status: 'active',
      limit: 100,
    });

  // Parse date manually to avoid timezone issues
  const displayPeriod = useMemo(() => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const date = new Date(year, month - 1, 1); // Use local date constructor
    return date.toLocaleDateString('fr-FR', {
      month: 'long',
      year: 'numeric',
    });
  }, [selectedMonth]);

  // Debug logging
  console.log('[ManualTimeEntryPage] Current state:', {
    selectedMonth,
    displayPeriod,
    period,
    monthPickerValue: selectedMonth.substring(0, 7),
  });

  // Map employees to the format expected by the table component
  const employees = (employeesData?.employees || []).map((emp: any) => ({
    id: emp.id,
    firstName: emp.firstName,
    lastName: emp.lastName,
    employeeNumber: emp.employeeNumber,
  }));

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      {/* Breadcrumb Navigation */}
      <div className="flex items-center gap-2 mb-4 text-sm text-muted-foreground">
        <Link href="/manager/dashboard" className="hover:text-foreground transition-colors">
          <Home className="h-4 w-4" />
        </Link>
        <span>/</span>
        <Link href="/manager/time-tracking" className="hover:text-foreground transition-colors">
          Pointages
        </Link>
        <span>/</span>
        <span className="text-foreground">Saisie manuelle</span>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link href="/manager/time-tracking">
            <Button variant="ghost" size="icon" className="min-h-[44px] min-w-[44px]">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">Saisie manuelle des heures</h1>
            <p className="text-muted-foreground mt-1">
              Enregistrez les heures de travail pour vos employés
            </p>
          </div>
        </div>
      </div>

      {/* Info Alert */}
      <Alert className="mb-6">
        <Info className="h-4 w-4" />
        <AlertDescription>
          Les heures supplémentaires sont calculées automatiquement selon la réglementation en vigueur.
          Les entrées créées ici seront intégrées au calcul de paie.
        </AlertDescription>
      </Alert>

      {/* Period Selection */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Période</CardTitle>
          <CardDescription>Sélectionnez le mois pour saisir les heures</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-muted-foreground" />
              <MonthPicker
                value={selectedMonth}
                onChange={setSelectedMonth}
                className="min-h-[48px]"
              />
            </div>

            <div className="flex-1" />

            <div className="flex items-center gap-2">
              <div className="text-lg font-semibold">{displayPeriod}</div>
              {employees.length > 0 && (
                <div className="text-sm text-muted-foreground">
                  • {employees.length} {employees.length === 1 ? 'employé' : 'employés'}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Employees Table */}
      <ManualTimeEntriesTable
        period={period}
        employees={employees}
        isLoadingEmployees={loadingEmployees}
      />
    </div>
  );
}
