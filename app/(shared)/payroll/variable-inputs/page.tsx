/**
 * Variable Pay Inputs Page - Bulk Monthly Input
 *
 * Purpose: Bulk entry of variable component values (commissions, production bonuses)
 * Features:
 * - Period selector (month picker)
 * - Editable table for all employees × variable components
 * - Bulk actions: Save all, Copy from previous month, Import Excel
 * - Auto-save on cell blur
 * - Mobile-responsive design
 *
 * HCI Principles:
 * - Large touch targets (min-h-[48px])
 * - Clear visual feedback
 * - Smart defaults (current month + 1)
 * - Error prevention (validate on blur)
 */

'use client';

import { useState, useEffect } from 'react';
import { trpc } from '@/lib/trpc/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Save,
  Copy,
  Download,
  Upload,
  Calendar,
  Award,
  AlertCircle,
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { VariablePayEmployeesTable } from '@/features/payroll/components/variable-pay-employees-table';

export default function VariableInputsPage() {
  const { toast } = useToast();
  const [selectedPeriod, setSelectedPeriod] = useState<string>('');

  // Generate period options (current month + next month + past 3 months)
  const periodOptions = Array.from({ length: 5 }, (_, i) => {
    const date = new Date();
    date.setMonth(date.getMonth() - i + 1); // Start from next month
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return {
      value: `${year}-${month}-01`,
      label: date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }),
    };
  });

  // Default to next month (typical use case: prepare variable pay for upcoming payroll)
  useEffect(() => {
    if (!selectedPeriod && periodOptions.length > 0) {
      setSelectedPeriod(periodOptions[0].value);
    }
  }, [selectedPeriod, periodOptions]);

  // Fetch all employees with their variable pay inputs for selected period
  const { data, isLoading, refetch } = trpc.variablePayInputs.getAllEmployeesWithInputs.useQuery(
    { period: selectedPeriod },
    { enabled: !!selectedPeriod }
  );

  // Copy from previous period mutation
  const copyMutation = trpc.variablePayInputs.copyFromPreviousPeriod.useMutation({
    onSuccess: (result) => {
      toast({
        title: 'Copie réussie',
        description: `${result.count} primes copiées de ${result.fromPeriod} vers ${result.toPeriod}`,
      });
      refetch();
    },
    onError: (error) => {
      toast({
        title: 'Erreur',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Handle copy from previous period
  const handleCopyFromPrevious = () => {
    if (!selectedPeriod) return;

    // Calculate previous period
    const date = new Date(selectedPeriod);
    date.setMonth(date.getMonth() - 1);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const previousPeriod = `${year}-${month}-01`;

    copyMutation.mutate({
      fromPeriod: previousPeriod,
      toPeriod: selectedPeriod,
    });
  };

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      {/* Header */}
      <div className="flex flex-col gap-4 mb-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
              <Award className="h-8 w-8 text-primary" />
              Primes et Variables
            </h1>
            <p className="text-muted-foreground">
              Saisissez les montants variables mensuels (commissions, primes de production, etc.)
            </p>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="min-h-[44px]"
              onClick={() => {
                toast({
                  title: 'Exportation',
                  description: 'Fonctionnalité bientôt disponible',
                });
              }}
            >
              <Download className="mr-2 h-4 w-4" />
              Exporter Excel
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="min-h-[44px]"
              onClick={() => {
                toast({
                  title: 'Importation',
                  description: 'Fonctionnalité bientôt disponible',
                });
              }}
            >
              <Upload className="mr-2 h-4 w-4" />
              Importer Excel
            </Button>
          </div>
        </div>

        {/* Info Banner */}
        <Card className="p-4 bg-blue-50 border-blue-200">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-blue-900">
              <p className="font-medium mb-1">Comment ça marche ?</p>
              <ul className="list-disc list-inside space-y-1 text-blue-800">
                <li>Les composants variables changent chaque mois (contrairement aux composants fixes)</li>
                <li>Saisissez les montants pour le mois sélectionné</li>
                <li>Les valeurs sont automatiquement incluses dans le calcul de paie</li>
                <li>Utilisez "Copier du mois précédent" pour les primes récurrentes</li>
              </ul>
            </div>
          </div>
        </Card>
      </div>

      {/* Period Selection & Actions */}
      <Card className="p-4 mb-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4 flex-1">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Calendar className="h-4 w-4" />
              Période:
            </div>

            <div className="flex-1 max-w-xs">
              <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                <SelectTrigger className="min-h-[48px] text-base">
                  <SelectValue placeholder="Sélectionner une période" />
                </SelectTrigger>
                <SelectContent>
                  {periodOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value} className="text-base">
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {data && (
              <Badge variant="secondary" className="text-sm">
                {data.count} {data.count === 1 ? 'employé' : 'employés'}
              </Badge>
            )}
          </div>

          <Button
            variant="outline"
            onClick={handleCopyFromPrevious}
            disabled={copyMutation.isPending}
            className="min-h-[44px]"
          >
            <Copy className="mr-2 h-4 w-4" />
            {copyMutation.isPending ? 'Copie en cours...' : 'Copier du mois précédent'}
          </Button>
        </div>
      </Card>

      {/* Variable Pay Employees Table */}
      {selectedPeriod && (
        <VariablePayEmployeesTable
          period={selectedPeriod}
          data={data?.employees ?? []}
          isLoading={isLoading}
          onDataChange={refetch}
        />
      )}
    </div>
  );
}
