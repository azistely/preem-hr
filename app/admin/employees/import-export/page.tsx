/**
 * Employee Import/Export Page (P1-8)
 *
 * Bulk operations for employee management
 * Following HCI principles:
 * - Zero learning curve (clear tabs, step-by-step flow)
 * - Error prevention (validation before import)
 * - Immediate feedback (progress indicator, error display)
 * - Task-oriented design (Import/Export workflows)
 */

'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { trpc } from '@/lib/trpc/client';
import {
  Download,
  Upload,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle,
  Loader2,
  FileDown,
  Users,
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export default function EmployeeImportExportPage() {
  const { toast } = useToast();
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<any[]>([]);
  const [importResults, setImportResults] = useState<{
    success: string[];
    errors: { row: number; email: string; error: string }[];
  } | null>(null);

  const exportEmployeesMutation = trpc.employees.exportEmployees.useQuery(
    { status: undefined },
    { enabled: false }
  );

  const importEmployeesMutation = trpc.employees.importEmployees.useMutation({
    onSuccess: (results) => {
      setImportResults(results);
      setIsImporting(false);
      toast({
        title: 'Import terminé',
        description: `${results.success.length} employés importés avec succès. ${results.errors.length} erreurs.`,
        variant: results.errors.length > 0 ? 'default' : 'default',
      });
    },
    onError: (error) => {
      setIsImporting(false);
      toast({
        title: 'Erreur d\'import',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const { data } = await exportEmployeesMutation.refetch();

      if (!data) {
        throw new Error('Aucune donnée à exporter');
      }

      // Convert to CSV
      const headers = [
        'firstName',
        'lastName',
        'email',
        'phone',
        'hireDate',
        'coefficient',
        'status',
        'city',
        'bankName',
        'bankAccount',
        'cnpsNumber',
        'taxNumber',
        'taxDependents',
      ];

      const csvContent = [
        headers.join(','),
        ...data.map((emp: any) =>
          headers
            .map((h) => {
              const value = emp[h];
              if (value === null || value === undefined) return '';
              if (h === 'hireDate') return format(new Date(value), 'yyyy-MM-dd');
              if (typeof value === 'string' && value.includes(',')) return `"${value}"`;
              return value;
            })
            .join(',')
        ),
      ].join('\n');

      // Download file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `employes_${format(new Date(), 'yyyy-MM-dd')}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast({
        title: 'Export réussi',
        description: `${data.length} employés exportés.`,
      });
    } catch (error: any) {
      toast({
        title: 'Erreur d\'export',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCsvFile(file);
    setImportResults(null);

    // Parse CSV
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.split('\n');
      const headers = lines[0].split(',').map((h) => h.trim());

      const data = lines
        .slice(1)
        .filter((line) => line.trim())
        .map((line, index) => {
          const values = line.split(',').map((v) => v.trim().replace(/^"|"$/g, ''));
          const obj: any = { row: index + 2 };
          headers.forEach((header, i) => {
            obj[header] = values[i] || '';
          });
          return obj;
        });

      setParsedData(data);
    };
    reader.readAsText(file);
  };

  const handleImport = () => {
    if (parsedData.length === 0) {
      toast({
        title: 'Aucune donnée',
        description: 'Veuillez sélectionner un fichier CSV avec des données.',
        variant: 'destructive',
      });
      return;
    }

    setIsImporting(true);

    // Transform parsed data to match schema
    const employees = parsedData.map((row) => ({
      firstName: row.firstName,
      lastName: row.lastName,
      email: row.email,
      phone: row.phone || undefined,
      hireDate: row.hireDate,
      positionTitle: row.positionTitle,
      baseSalary: parseFloat(row.baseSalary),
      coefficient: parseInt(row.coefficient) || 100,
    }));

    importEmployeesMutation.mutate({ employees });
  };

  return (
    <div className="container mx-auto max-w-5xl py-8 px-4">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Import/Export des employés</h1>
        <p className="text-muted-foreground mt-2">
          Gérer vos employés en masse via fichier CSV
        </p>
      </div>

      <Tabs defaultValue="export" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="export" className="min-h-[44px]">
            <Download className="mr-2 h-4 w-4" />
            Exporter
          </TabsTrigger>
          <TabsTrigger value="import" className="min-h-[44px]">
            <Upload className="mr-2 h-4 w-4" />
            Importer
          </TabsTrigger>
        </TabsList>

        {/* Export Tab */}
        <TabsContent value="export" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileDown className="h-5 w-5" />
                Exporter les employés
              </CardTitle>
              <CardDescription>
                Télécharger la liste de tous vos employés au format CSV
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                <div className="flex items-start gap-3">
                  <FileSpreadsheet className="h-5 w-5 text-blue-600 mt-0.5" />
                  <div>
                    <p className="font-semibold text-blue-900">Format du fichier</p>
                    <p className="text-sm text-blue-700 mt-1">
                      Le fichier CSV contiendra toutes les informations des employés : nom, prénom,
                      email, téléphone, date d'embauche, coefficient, statut, et coordonnées
                      bancaires.
                    </p>
                  </div>
                </div>
              </div>

              <Button
                onClick={handleExport}
                disabled={isExporting}
                className="min-h-[56px] min-w-[200px] text-lg"
              >
                {isExporting ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Export en cours...
                  </>
                ) : (
                  <>
                    <Download className="mr-2 h-5 w-5" />
                    Télécharger CSV
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Import Tab */}
        <TabsContent value="import" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Importer des employés
              </CardTitle>
              <CardDescription>
                Ajouter plusieurs employés en une seule fois via fichier CSV
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Instructions */}
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5" />
                  <div>
                    <p className="font-semibold text-amber-900">Format requis</p>
                    <p className="text-sm text-amber-700 mt-1">
                      Colonnes requises : firstName, lastName, email, hireDate (YYYY-MM-DD),
                      positionTitle, baseSalary, coefficient
                    </p>
                    <p className="text-sm text-amber-700 mt-2">
                      Colonnes optionnelles : phone
                    </p>
                  </div>
                </div>
              </div>

              {/* File Upload */}
              <div>
                <label className="block mb-2 text-sm font-medium">
                  Sélectionner un fichier CSV
                </label>
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileSelect}
                  className="block w-full text-sm text-muted-foreground
                    file:mr-4 file:py-3 file:px-4
                    file:rounded-md file:border-0
                    file:text-sm file:font-semibold
                    file:bg-primary file:text-primary-foreground
                    hover:file:bg-primary/90
                    file:min-h-[48px]"
                />
              </div>

              {/* Preview */}
              {parsedData.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Aperçu ({parsedData.length} employés)
                  </h3>
                  <div className="border rounded-lg overflow-auto max-h-[300px]">
                    <table className="w-full text-sm">
                      <thead className="bg-muted sticky top-0">
                        <tr>
                          <th className="p-2 text-left">Ligne</th>
                          <th className="p-2 text-left">Prénom</th>
                          <th className="p-2 text-left">Nom</th>
                          <th className="p-2 text-left">Email</th>
                          <th className="p-2 text-left">Poste</th>
                        </tr>
                      </thead>
                      <tbody>
                        {parsedData.slice(0, 10).map((row, idx) => (
                          <tr key={idx} className="border-t">
                            <td className="p-2">{row.row}</td>
                            <td className="p-2">{row.firstName}</td>
                            <td className="p-2">{row.lastName}</td>
                            <td className="p-2">{row.email}</td>
                            <td className="p-2">{row.positionTitle}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {parsedData.length > 10 && (
                    <p className="text-sm text-muted-foreground mt-2">
                      ... et {parsedData.length - 10} autres employés
                    </p>
                  )}
                </div>
              )}

              {/* Import Button */}
              <Button
                onClick={handleImport}
                disabled={isImporting || parsedData.length === 0}
                className="min-h-[56px] min-w-[200px] text-lg"
              >
                {isImporting ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Import en cours ({parsedData.length} employés)...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-5 w-5" />
                    Importer {parsedData.length > 0 ? `${parsedData.length} employés` : ''}
                  </>
                )}
              </Button>

              {/* Results */}
              {importResults && (
                <div className="space-y-4">
                  {importResults.success.length > 0 && (
                    <div className="rounded-lg border border-green-200 bg-green-50 p-4">
                      <div className="flex items-start gap-3">
                        <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                        <div>
                          <p className="font-semibold text-green-900">
                            {importResults.success.length} employés importés avec succès
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {importResults.errors.length > 0 && (
                    <div className="rounded-lg border border-red-200 bg-red-50 p-4">
                      <div className="flex items-start gap-3">
                        <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
                        <div className="flex-1">
                          <p className="font-semibold text-red-900 mb-3">
                            {importResults.errors.length} erreurs détectées
                          </p>
                          <div className="space-y-2 max-h-[200px] overflow-auto">
                            {importResults.errors.map((err, idx) => (
                              <div key={idx} className="text-sm text-red-700">
                                <span className="font-medium">Ligne {err.row}</span> ({err.email}):{' '}
                                {err.error}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
