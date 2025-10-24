/**
 * Payroll Run Export Menu Component
 *
 * One-click export menu for payroll runs:
 * - GL Journal (SYSCOHADA CSV, Sage TXT, Ciel IIF)
 * - CMU Export (1% contribution)
 * - ETAT 301 (monthly ITS declaration)
 */

'use client';

import { useState } from 'react';
import { Download, FileSpreadsheet, FileText, Building, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { trpc } from '@/lib/trpc/client';
import { useToast } from '@/hooks/use-toast';

interface PayrollRunExportMenuProps {
  payrollRunId: string;
  payrollPeriod?: string; // 'YYYY-MM' format
}

export function PayrollRunExportMenu({ payrollRunId, payrollPeriod }: PayrollRunExportMenuProps) {
  const { toast } = useToast();
  const [isExporting, setIsExporting] = useState(false);

  const exportGL = trpc.accounting.exportPayrollToGL.useMutation({
    onSuccess: (result) => {
      // Create download link
      const blob = new Blob([result.fileContent], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = result.fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: 'Export réussi',
        description: `Journal comptable exporté (${result.entryCount} écritures, ${result.balanced ? 'équilibré' : 'déséquilibré'})`,
      });
      setIsExporting(false);
    },
    onError: (error) => {
      toast({
        title: 'Erreur d\'export',
        description: error.message,
        variant: 'destructive',
      });
      setIsExporting(false);
    },
  });

  const exportCMU = trpc.accounting.exportCMU.useMutation({
    onSuccess: (result) => {
      // Create download link
      const blob = new Blob([result.fileContent], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = result.fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: 'Export CMU réussi',
        description: `${result.employeeCount} employés, Total: ${result.totalAmount.toFixed(2)} FCFA`,
      });
      setIsExporting(false);
    },
    onError: (error) => {
      toast({
        title: 'Erreur d\'export CMU',
        description: error.message,
        variant: 'destructive',
      });
      setIsExporting(false);
    },
  });

  const exportEtat301 = trpc.accounting.generateEtat301.useMutation({
    onSuccess: (result) => {
      // Create download link
      const blob = new Blob([result.fileContent], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = result.fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: 'Export ETAT 301 réussi',
        description: `${result.employeeCount} employés, Total ITS: ${result.totalITS.toFixed(2)} FCFA`,
      });
      setIsExporting(false);
    },
    onError: (error) => {
      toast({
        title: 'Erreur d\'export ETAT 301',
        description: error.message,
        variant: 'destructive',
      });
      setIsExporting(false);
    },
  });

  const handleExportGL = (format: 'SYSCOHADA_CSV' | 'SAGE_TXT' | 'CIEL_IIF' | 'EXCEL') => {
    setIsExporting(true);
    exportGL.mutate({ payrollRunId, format });
  };

  const handleExportCMU = () => {
    setIsExporting(true);
    exportCMU.mutate({ payrollRunId });
  };

  const handleExportEtat301 = () => {
    if (!payrollPeriod) {
      toast({
        title: 'Erreur',
        description: 'Période de paie non définie',
        variant: 'destructive',
      });
      return;
    }

    setIsExporting(true);
    exportEtat301.mutate({ month: payrollPeriod });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="min-h-[44px]" disabled={isExporting}>
          {isExporting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Export en cours...
            </>
          ) : (
            <>
              <Download className="mr-2 h-4 w-4" />
              Exporter vers Comptabilité
            </>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel>Export Comptable</DropdownMenuLabel>
        <DropdownMenuSeparator />

        <DropdownMenuItem onClick={() => handleExportGL('SYSCOHADA_CSV')}>
          <FileSpreadsheet className="mr-2 h-4 w-4" />
          <div>
            <p className="font-medium">Journal Comptable (SYSCOHADA CSV)</p>
            <p className="text-xs text-muted-foreground">Format standard OHADA</p>
          </div>
        </DropdownMenuItem>

        <DropdownMenuItem onClick={() => handleExportGL('SAGE_TXT')}>
          <FileText className="mr-2 h-4 w-4" />
          <div>
            <p className="font-medium">Export Sage (TXT)</p>
            <p className="text-xs text-muted-foreground">Compatible Sage Comptabilité</p>
          </div>
        </DropdownMenuItem>

        <DropdownMenuItem onClick={() => handleExportGL('CIEL_IIF')}>
          <FileText className="mr-2 h-4 w-4" />
          <div>
            <p className="font-medium">Export Ciel (IIF)</p>
            <p className="text-xs text-muted-foreground">Compatible Ciel Compta</p>
          </div>
        </DropdownMenuItem>

        <DropdownMenuSeparator />
        <DropdownMenuLabel>Déclarations Sociales et Fiscales</DropdownMenuLabel>

        <DropdownMenuItem onClick={handleExportCMU}>
          <Building className="mr-2 h-4 w-4" />
          <div>
            <p className="font-medium">CMU 1% (CNPS)</p>
            <p className="text-xs text-muted-foreground">Couverture Maladie Universelle</p>
          </div>
        </DropdownMenuItem>

        <DropdownMenuItem onClick={handleExportEtat301}>
          <FileText className="mr-2 h-4 w-4" />
          <div>
            <p className="font-medium">ETAT 301 (DGI)</p>
            <p className="text-xs text-muted-foreground">Déclaration mensuelle ITS</p>
          </div>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
