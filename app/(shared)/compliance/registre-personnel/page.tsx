/**
 * Digital Registre du Personnel Page
 * Week 16: CONSOLIDATED-IMPLEMENTATION-PLAN-v3.0-EXTENDED.md
 *
 * Legally compliant digital employee register for West African labor inspection.
 * Features:
 * - View all register entries (hires & exits)
 * - Search and filter by name, department, type
 * - Export to PDF in legal format (landscape A4)
 * - Statistics dashboard
 * - Automatic sync with employee hires/exits
 *
 * Design: Mobile-first, zero learning curve, French language
 */

'use client';

import { useState } from 'react';
import { api } from '@/trpc/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Search,
  Download,
  FileText,
  Users,
  TrendingUp,
  TrendingDown,
  Loader2,
  CheckCircle2,
  XCircle,
  Calendar,
} from 'lucide-react';
import { format, startOfYear, endOfYear } from 'date-fns';
import { fr } from 'date-fns/locale';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';

type EntryType = 'hire' | 'exit' | 'modification';

export default function RegistreDuPersonnelPage() {
  const utils = api.useUtils();

  // Search and filters
  const [searchTerm, setSearchTerm] = useState('');
  const [entryType, setEntryType] = useState<EntryType | 'all'>('all');

  // Fetch statistics
  const { data: stats, isLoading: statsLoading } = api.registre.getStats.useQuery();

  // Fetch entries with search
  const { data: entries, isLoading: entriesLoading } = api.registre.searchEntries.useQuery({
    employeeName: searchTerm || undefined,
    entryType: entryType === 'all' ? undefined : entryType,
  });

  // Export mutations
  const exportFullPDF = api.registre.exportToPDF.useMutation({
    onSuccess: (data) => {
      toast.success(data.message || 'PDF généré avec succès');
      // Open PDF in new tab
      if (data.data?.fileUrl) {
        window.open(data.data.fileUrl, '_blank');
      }
    },
    onError: (error) => {
      toast.error(error.message || 'Erreur lors de la génération du PDF');
    },
  });

  const exportActivePDF = api.registre.exportToPDF.useMutation({
    onSuccess: (data) => {
      toast.success(data.message || 'PDF généré avec succès');
      if (data.data?.fileUrl) {
        window.open(data.data.fileUrl, '_blank');
      }
    },
    onError: (error) => {
      toast.error(error.message || 'Erreur lors de la génération du PDF');
    },
  });

  const exportYearPDF = api.registre.exportToPDF.useMutation({
    onSuccess: (data) => {
      toast.success(data.message || 'PDF généré avec succès');
      if (data.data?.fileUrl) {
        window.open(data.data.fileUrl, '_blank');
      }
    },
    onError: (error) => {
      toast.error(error.message || 'Erreur lors de la génération du PDF');
    },
  });

  const handleExportFull = () => {
    exportFullPDF.mutate({ activeOnly: false });
  };

  const handleExportActive = () => {
    exportActivePDF.mutate({ activeOnly: true });
  };

  const handleExportYear = () => {
    exportYearPDF.mutate({
      dateFrom: startOfYear(new Date()),
      dateTo: endOfYear(new Date()),
      activeOnly: false,
    });
  };

  const isExporting =
    exportFullPDF.isPending || exportActivePDF.isPending || exportYearPDF.isPending;

  return (
    <div className="container mx-auto max-w-6xl py-6 px-4 pb-24 md:pb-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-2">
          <div className="flex items-center gap-3">
            <FileText className="h-8 w-8 text-muted-foreground" />
            <h1 className="text-2xl md:text-3xl font-bold">Registre du Personnel</h1>
          </div>

          <Button
            onClick={handleExportFull}
            disabled={isExporting}
            className="min-h-[56px] w-full md:w-auto"
          >
            {isExporting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-2 h-4 w-4" />
            )}
            Exporter PDF (Inspection)
          </Button>
        </div>

        <p className="text-muted-foreground">
          Registre électronique conforme au Code du Travail - Prêt pour l'inspection
        </p>
      </div>

      {/* Statistics */}
      <div className="grid gap-4 md:grid-cols-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Entrées
            </CardTitle>
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-10 w-20" />
            ) : (
              <div className="text-3xl font-bold">{stats?.data?.totalEntries || 0}</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Embauches
            </CardTitle>
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-10 w-20" />
            ) : (
              <div className="flex items-center gap-2">
                <TrendingUp className="h-6 w-6 text-green-600" />
                <div className="text-3xl font-bold text-green-600">
                  {stats?.data?.hires || 0}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Sorties</CardTitle>
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-10 w-20" />
            ) : (
              <div className="flex items-center gap-2">
                <TrendingDown className="h-6 w-6 text-red-600" />
                <div className="text-3xl font-bold text-red-600">
                  {stats?.data?.exits || 0}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Employés Actifs
            </CardTitle>
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-10 w-20" />
            ) : (
              <div className="flex items-center gap-2">
                <Users className="h-6 w-6 text-primary" />
                <div className="text-3xl font-bold">{stats?.data?.active || 0}</div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Search & Filters */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher par nom d'employé..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 min-h-[48px]"
              />
            </div>

            <Select
              value={entryType}
              onValueChange={(v) => setEntryType(v as EntryType | 'all')}
            >
              <SelectTrigger className="w-full md:w-[200px] min-h-[48px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les types</SelectItem>
                <SelectItem value="hire">Embauches</SelectItem>
                <SelectItem value="exit">Sorties</SelectItem>
                <SelectItem value="modification">Modifications</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Entries List */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Entrées du Registre</CardTitle>
        </CardHeader>
        <CardContent>
          {entriesLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          ) : entries?.data && entries.data.length > 0 ? (
            <div className="space-y-3">
              {entries.data.map((entry: any) => (
                <div
                  key={entry.id}
                  className="flex flex-col md:flex-row md:items-center md:justify-between p-4 border rounded-lg hover:bg-accent transition-colors gap-4"
                >
                  <div className="flex items-start md:items-center gap-4">
                    <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">
                      {entry.entryNumber}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-lg truncate">{entry.fullName}</p>
                      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground mt-1">
                        <span className="truncate">{entry.position || 'N/A'}</span>
                        {entry.department && (
                          <>
                            <span>•</span>
                            <span className="truncate">{entry.department}</span>
                          </>
                        )}
                        <span>•</span>
                        <span>{entry.employeeNumber}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 flex-shrink-0">
                    <div className="text-right">
                      <div className="flex items-center gap-2 mb-1">
                        {entry.entryType === 'hire' ? (
                          <>
                            <TrendingUp className="h-4 w-4 text-green-600" />
                            <span className="text-sm font-medium text-green-600">Embauche</span>
                          </>
                        ) : entry.entryType === 'exit' ? (
                          <>
                            <TrendingDown className="h-4 w-4 text-red-600" />
                            <span className="text-sm font-medium text-red-600">Sortie</span>
                          </>
                        ) : (
                          <>
                            <Calendar className="h-4 w-4 text-blue-600" />
                            <span className="text-sm font-medium text-blue-600">
                              Modification
                            </span>
                          </>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {entry.entryDate
                          ? format(new Date(entry.entryDate), 'dd/MM/yyyy', { locale: fr })
                          : 'N/A'}
                      </p>
                    </div>

                    <Badge variant={entry.contractType === 'CDI' ? 'default' : 'secondary'}>
                      {entry.contractType || 'N/A'}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <CheckCircle2 className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">Aucune entrée trouvée</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Actions Rapides</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <Button
            variant="outline"
            onClick={handleExportActive}
            disabled={isExporting}
            className="min-h-[56px]"
          >
            <FileText className="mr-2 h-4 w-4" />
            Exporter Actifs Uniquement
          </Button>

          <Button
            variant="outline"
            onClick={handleExportYear}
            disabled={isExporting}
            className="min-h-[56px]"
          >
            <FileText className="mr-2 h-4 w-4" />
            Exporter Année en Cours
          </Button>

          <Button variant="outline" disabled className="min-h-[56px]">
            <FileText className="mr-2 h-4 w-4" />
            Exporter Excel (Bientôt)
          </Button>
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card className="mt-6 border-blue-200 bg-blue-50">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <FileText className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-900">
              <p className="font-medium mb-1">Document conforme au Code du Travail</p>
              <p className="text-blue-700">
                Le registre du personnel est automatiquement mis à jour lors des embauches et
                sorties. Les exports PDF sont au format paysage A4, prêts pour l'inspection du
                travail.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Loading overlay for exports */}
      {isExporting && (
        <div className="fixed inset-0 bg-background/50 flex items-center justify-center z-50">
          <div className="bg-background p-6 rounded-lg shadow-lg flex items-center gap-3">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span>Génération du PDF en cours...</span>
          </div>
        </div>
      )}
    </div>
  );
}
