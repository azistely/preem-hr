/**
 * Preview Step - Bulk Salary Adjustment Wizard
 */

import { trpc } from '@/lib/trpc/client';
import { Loader2 } from 'lucide-react';
import { formatCurrency } from '@/features/employees/hooks/use-salary-validation';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface PreviewStepProps {
  adjustmentId: string;
}

export function PreviewStep({ adjustmentId }: PreviewStepProps) {
  const { data: preview, isLoading } = trpc.bulkAdjustments.preview.useQuery({
    adjustmentId,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!preview || !preview.items || preview.items.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">
          Aucun employé ne correspond aux critères sélectionnés
        </p>
      </div>
    );
  }

  const items = preview.items;
  const totalCurrentSalary = items.reduce((sum: number, emp: typeof items[number]) => sum + emp.currentSalary, 0);
  const totalNewSalary = items.reduce((sum: number, emp: typeof items[number]) => sum + emp.newSalary, 0);
  const totalIncrease = totalNewSalary - totalCurrentSalary;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-600 font-medium">Employés affectés</p>
          <p className="text-3xl font-bold text-blue-700 mt-2">{items.length}</p>
        </div>

        <div className="bg-gray-50 border rounded-lg p-4">
          <p className="text-sm text-gray-600 font-medium">Masse salariale actuelle</p>
          <p className="text-2xl font-bold text-gray-700 mt-2">
            {formatCurrency(totalCurrentSalary)}
          </p>
        </div>

        <div className={`border rounded-lg p-4 ${
          totalIncrease >= 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
        }`}>
          <p className={`text-sm font-medium ${
            totalIncrease >= 0 ? 'text-green-600' : 'text-red-600'
          }`}>
            {totalIncrease >= 0 ? 'Augmentation totale' : 'Réduction totale'}
          </p>
          <p className={`text-2xl font-bold mt-2 ${
            totalIncrease >= 0 ? 'text-green-700' : 'text-red-700'
          }`}>
            {totalIncrease >= 0 ? '+' : ''}{formatCurrency(totalIncrease)}
          </p>
        </div>
      </div>

      {/* Employee List */}
      <div className="border rounded-lg overflow-hidden">
        <div className="max-h-[400px] overflow-y-auto">
          <Table>
            <TableHeader className="bg-gray-50 sticky top-0">
              <TableRow>
                <TableHead>Employé</TableHead>
                <TableHead>Poste</TableHead>
                <TableHead className="text-right">Salaire actuel</TableHead>
                <TableHead className="text-right">Nouveau salaire</TableHead>
                <TableHead className="text-right">Changement</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((employee: typeof items[number]) => {
                const change = employee.newSalary - employee.currentSalary;
                const changePercent = (change / employee.currentSalary) * 100;

                return (
                  <TableRow key={employee.employeeId}>
                    <TableCell className="font-medium">
                      {employee.employeeName}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {(employee as any).positionTitle || '-'}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrency(employee.currentSalary)}
                    </TableCell>
                    <TableCell className="text-right font-mono font-medium">
                      {formatCurrency(employee.newSalary)}
                    </TableCell>
                    <TableCell className={`text-right font-mono ${
                      change >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {change >= 0 ? '+' : ''}{formatCurrency(change)}
                      <span className="text-xs ml-1">
                        ({changePercent >= 0 ? '+' : ''}{changePercent.toFixed(1)}%)
                      </span>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <p className="text-sm text-yellow-800">
          ⚠️ <strong>Attention:</strong> Vérifiez attentivement les changements avant de confirmer.
          Cette action modifiera les salaires de {items.length} employé(s).
        </p>
      </div>
    </div>
  );
}
