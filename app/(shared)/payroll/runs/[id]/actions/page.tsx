/**
 * Payroll Run Actions Page
 *
 * Bulk document generation and distribution for payroll runs:
 * - Generate all bulletins de paie (PDF)
 * - Email bulletins to all employees
 * - Download archive (ZIP)
 * - Progress tracking for bulk operations
 *
 * Following HCI principles:
 * - Task-oriented design ("Generate all documents")
 * - Clear progress feedback
 * - Error prevention (disable during processing)
 */

'use client';

import { use, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import {
  FileText,
  Mail,
  Download,
  Loader2,
  CheckCircle,
  XCircle,
  ArrowLeft,
  AlertCircle,
} from 'lucide-react';
import { trpc } from '@/lib/trpc/client';
import { toast } from 'sonner';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function PayrollRunActionsPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const router = useRouter();

  // Fetch payroll run details
  const { data: payrollRun, isLoading: runLoading } = trpc.payroll.getRun.useQuery({
    runId: resolvedParams.id,
  });

  // Generate bulk bulletins mutation
  const generateBulk = trpc.documents.generateBulkBulletins.useMutation({
    onSuccess: (data) => {
      toast.success(`Génération lancée pour ${data.totalDocuments} bulletins`);
      // Start polling for job status
      startPolling(data.jobId);
    },
    onError: (error) => {
      toast.error(error.message || 'Erreur lors du lancement de la génération');
    },
  });

  // Poll for job status
  const { data: jobStatus, refetch: refetchJobStatus } = trpc.documents.getBulkJobStatus.useQuery(
    {
      jobId: generateBulk.data?.jobId || '',
    },
    {
      enabled: !!generateBulk.data?.jobId,
      refetchInterval: (query) => {
        // Stop polling when job is complete
        // query.state.data contains the actual job status data
        const data = query.state.data;
        if (data?.jobStatus === 'completed' || data?.jobStatus === 'completed_with_errors' || data?.jobStatus === 'failed') {
          return false;
        }
        return 2000; // Poll every 2 seconds while processing
      },
    }
  );

  // Start polling for job status
  const startPolling = (jobId: string) => {
    // Polling is handled by refetchInterval above
  };

  // Calculate progress percentage
  const getProgressPercentage = () => {
    if (!jobStatus) return 0;
    if (jobStatus.totalDocuments === 0) return 0;
    return Math.round((jobStatus.generatedDocuments / jobStatus.totalDocuments) * 100);
  };

  // Get status badge
  const getStatusBadge = () => {
    if (!jobStatus) return null;

    switch (jobStatus.jobStatus) {
      case 'completed':
        return (
          <Badge className="bg-green-600">
            <CheckCircle className="mr-1 h-3 w-3" />
            Terminé
          </Badge>
        );
      case 'completed_with_errors':
        return (
          <Badge className="bg-yellow-600">
            <AlertCircle className="mr-1 h-3 w-3" />
            Terminé avec erreurs
          </Badge>
        );
      case 'failed':
        return (
          <Badge variant="destructive">
            <XCircle className="mr-1 h-3 w-3" />
            Échoué
          </Badge>
        );
      case 'processing':
        return (
          <Badge>
            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
            En cours
          </Badge>
        );
      default:
        return <Badge variant="secondary">En attente</Badge>;
    }
  };

  const isGenerating = generateBulk.isPending || (jobStatus && jobStatus.jobStatus === 'processing');

  return (
    <div className="container mx-auto max-w-4xl py-8 px-4">
      {/* Header */}
      <div className="mb-8">
        <Button
          variant="ghost"
          size="sm"
          className="mb-4"
          onClick={() => router.push(`/payroll/runs/${resolvedParams.id}`)}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Retour à la paie
        </Button>

        <h1 className="text-3xl font-bold">Actions sur la Paie</h1>
        <p className="text-muted-foreground mt-2">
          Génération et distribution des bulletins de paie
        </p>

        {payrollRun && (
          <div className="flex items-center gap-4 mt-4">
            <Badge variant="outline" className="text-base py-1 px-3">
              {payrollRun.name || 'Paie sans nom'}
            </Badge>
            <span className="text-sm text-muted-foreground">
              {payrollRun.employeeCount || 0} employé(s)
            </span>
          </div>
        )}
      </div>

      {/* Loading State */}
      {runLoading ? (
        <Card>
          <CardContent className="py-12">
            <div className="flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <span className="ml-3 text-muted-foreground">Chargement...</span>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Main Actions Card */}
          <Card>
            <CardHeader>
              <CardTitle>Génération en Masse</CardTitle>
              <CardDescription>
                Générer les bulletins de paie pour tous les employés de cette période
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button
                onClick={() => generateBulk.mutate({ payrollRunId: resolvedParams.id })}
                size="lg"
                className="w-full min-h-[56px]"
                disabled={isGenerating || !payrollRun}
              >
                {generateBulk.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Lancement...
                  </>
                ) : (
                  <>
                    <FileText className="mr-2 h-5 w-5" />
                    Générer Tous les Bulletins (PDF)
                  </>
                )}
              </Button>

              <Button
                size="lg"
                variant="outline"
                className="w-full min-h-[56px]"
                disabled
              >
                <Mail className="mr-2 h-5 w-5" />
                Envoyer par Email à Tous (Bientôt disponible)
              </Button>

              <Button
                size="lg"
                variant="outline"
                className="w-full min-h-[56px]"
                disabled
              >
                <Download className="mr-2 h-5 w-5" />
                Télécharger Archive ZIP (Bientôt disponible)
              </Button>
            </CardContent>
          </Card>

          {/* Progress Tracker */}
          {jobStatus && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Progression</CardTitle>
                  {getStatusBadge()}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>
                      {jobStatus.jobStatus === 'processing' ? 'Génération en cours...' : 'Génération terminée'}
                    </span>
                    <span className="font-semibold">
                      {jobStatus.generatedDocuments} / {jobStatus.totalDocuments} bulletins
                    </span>
                  </div>
                  <Progress value={getProgressPercentage()} className="h-2" />
                </div>

                {jobStatus.failedDocuments > 0 && (
                  <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold text-yellow-900">
                          {jobStatus.failedDocuments} erreur(s) détectée(s)
                        </p>
                        <p className="text-sm text-yellow-800 mt-1">
                          Certains bulletins n'ont pas pu être générés. Vérifiez les logs pour plus de détails.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {jobStatus.jobStatus === 'completed' && jobStatus.failedDocuments === 0 && (
                  <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-start gap-3">
                      <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold text-green-900">
                          Génération réussie !
                        </p>
                        <p className="text-sm text-green-800 mt-1">
                          Tous les bulletins ont été générés avec succès. Les employés peuvent maintenant les consulter.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Error Log (if any) */}
                {jobStatus.errorLog && Array.isArray(jobStatus.errorLog) && jobStatus.errorLog.length > 0 ? (
                  <div className="space-y-2">
                    <p className="text-sm font-semibold text-destructive">Erreurs détaillées :</p>
                    <div className="max-h-40 overflow-y-auto space-y-2 p-3 bg-muted rounded-md">
                      {(jobStatus.errorLog as Array<{ employeeNumber: string; error: string }>).map((error, idx) => (
                        <div key={idx} className="text-sm">
                          <span className="font-semibold">{error.employeeNumber}:</span>{' '}
                          <span className="text-muted-foreground">{error.error}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          )}

          {/* Information Card */}
          <Card>
            <CardHeader>
              <CardTitle>À propos de la génération en masse</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>
                <strong>Bulletins de Paie (PDF):</strong> Génère un bulletin PDF pour chaque employé.
                Les employés peuvent les consulter dans leur portail.
              </p>
              <p>
                <strong>Envoi par Email:</strong> Envoie automatiquement les bulletins par email à tous
                les employés avec leur adresse email configurée.
              </p>
              <p>
                <strong>Archive ZIP:</strong> Télécharge tous les bulletins dans un fichier ZIP pour
                archivage ou distribution manuelle.
              </p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
