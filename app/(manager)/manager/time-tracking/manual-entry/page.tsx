/**
 * Manual Time Entry Page
 *
 * Dedicated page for manually entering time entries for employees.
 * Allows managers and admins to add/edit/delete manual time entries
 * for any employee in the selected period.
 *
 * Features:
 * - Period selector (month picker)
 * - Employee list with manual entry table
 * - Add/edit/delete time entries
 * - Automatic overtime detection
 *
 * HCI Principles:
 * - Simple month-based filtering (smart default to current month)
 * - Progressive disclosure (one period at a time)
 * - Large touch targets for mobile use
 */

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { startOfMonth, endOfMonth, format, addMonths, subMonths } from 'date-fns';
import { fr } from 'date-fns/locale';
import { api } from '@/trpc/react';
import { ManualTimeEntriesTable } from '@/features/time-tracking/components/manual-time-entries-table';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  Clock,
  ArrowLeft,
  Upload,
  Info,
} from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export default function ManualTimeEntryPage() {
  // State for selected month (defaults to current month)
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  // Calculate period (start and end of month)
  const period = {
    startDate: startOfMonth(selectedDate),
    endDate: endOfMonth(selectedDate),
  };

  // Fetch active employees
  const { data: employeesData, isLoading: isLoadingEmployees } = api.employees.list.useQuery({
    status: 'active',
  });

  const employees = employeesData?.employees || [];

  // Month navigation
  const goToPreviousMonth = () => {
    setSelectedDate((prev) => subMonths(prev, 1));
  };

  const goToNextMonth = () => {
    setSelectedDate((prev) => addMonths(prev, 1));
  };

  const goToCurrentMonth = () => {
    setSelectedDate(new Date());
  };

  const isCurrentMonth = format(selectedDate, 'yyyy-MM') === format(new Date(), 'yyyy-MM');

  return (
    <div className="container mx-auto py-6 px-4 space-y-6">
      {/* Header with breadcrumb */}
      <div className="flex items-center gap-4 mb-6">
        <Link href="/manager/time-tracking">
          <Button variant="ghost" size="sm" className="min-h-[44px]">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Retour
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Gestion des heures de travail</h1>
          <p className="text-muted-foreground mt-1">
            Consultez et modifiez les heures de travail de vos employés
          </p>
        </div>
      </div>

      {/* Period Selector Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Période de saisie
          </CardTitle>
          <CardDescription>
            Sélectionnez le mois pour lequel vous souhaitez saisir les heures
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            {/* Previous month button */}
            <Button
              variant="outline"
              onClick={goToPreviousMonth}
              className="min-h-[44px] min-w-[44px]"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>

            {/* Current period display */}
            <div className="flex-1 text-center">
              <div className="text-2xl font-bold">
                {format(selectedDate, 'MMMM yyyy', { locale: fr })}
              </div>
              <div className="text-sm text-muted-foreground mt-1">
                Du {format(period.startDate, 'd MMM', { locale: fr })} au{' '}
                {format(period.endDate, 'd MMM yyyy', { locale: fr })}
              </div>
            </div>

            {/* Next month button */}
            <Button
              variant="outline"
              onClick={goToNextMonth}
              className="min-h-[44px] min-w-[44px]"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Quick action: Go to current month */}
          {!isCurrentMonth && (
            <div className="mt-4 flex justify-center">
              <Button
                variant="secondary"
                onClick={goToCurrentMonth}
                className="min-h-[44px]"
              >
                <Clock className="h-4 w-4 mr-2" />
                Mois actuel
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Import Alternative Alert */}
      <Alert className="border-blue-200 bg-blue-50">
        <Info className="h-5 w-5 text-blue-600" />
        <AlertTitle className="text-blue-900 font-semibold">
          Vous avez un appareil de pointage biométrique ?
        </AlertTitle>
        <AlertDescription className="text-blue-800 mt-2">
          <p className="mb-3">
            Gagnez du temps en important automatiquement les données depuis votre appareil
            ZKTeco, Anviz ou autre système de pointage.
          </p>
          <Link href="/admin/time-tracking/import">
            <Button className="min-h-[44px] bg-blue-600 hover:bg-blue-700">
              <Upload className="h-4 w-4 mr-2" />
              Importer depuis un appareil
            </Button>
          </Link>
        </AlertDescription>
      </Alert>

      {/* Entry Types Info */}
      <Alert>
        <Info className="h-5 w-5" />
        <AlertTitle className="font-semibold">
          Vue complète des heures de travail
        </AlertTitle>
        <AlertDescription className="mt-2">
          <p className="mb-2">
            Cette page affiche <strong>toutes les heures</strong> enregistrées pour vos employés :
          </p>
          <div className="space-y-1 text-sm">
            <div className="flex items-center gap-2">
              <div className="bg-blue-50 border border-blue-200 rounded px-2 py-1">
                <span className="text-blue-600 text-xs">✏️ Saisie manuelle</span>
              </div>
              <span>— Vous pouvez modifier ou supprimer</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="bg-green-50 border border-green-200 rounded px-2 py-1">
                <span className="text-green-600 text-xs">🔒 Appareil</span>
              </div>
              <span>— Enregistré automatiquement (non modifiable)</span>
            </div>
          </div>
        </AlertDescription>
      </Alert>

      {/* Time Entries Table */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-xl font-semibold">
            Heures de travail ({employees.length} employé{employees.length !== 1 ? 's' : ''})
          </h2>
        </div>

        <ManualTimeEntriesTable
          period={period}
          employees={employees}
          isLoadingEmployees={isLoadingEmployees}
        />
      </div>
    </div>
  );
}
