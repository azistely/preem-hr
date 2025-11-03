/**
 * Employee Terminations List Page
 *
 * Shows all employee terminations with document generation status
 * Allows HR to generate work certificates and track compliance
 */

'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  FileText,
  Download,
  CheckCircle,
  Clock,
  AlertCircle,
  Loader2,
  ExternalLink,
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useToast } from '@/components/ui/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { JobSearchCalendar } from '@/features/employees/components/job-search-calendar';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { ChevronDown } from 'lucide-react';

export default function TerminationsPage() {
  const { toast } = useToast();
  const [selectedTermination, setSelectedTermination] = useState<string | null>(null);
  const [issuedBy, setIssuedBy] = useState('');
  const [payDate, setPayDate] = useState('');
  const [showGenerateDialog, setShowGenerateDialog] = useState(false);

  // Fetch terminations list
  const { data: terminations, isLoading, refetch } = trpc.terminations.list.useQuery({
    limit: 50,
    offset: 0,
  });

  const [documentType, setDocumentType] = useState<'work_certificate' | 'cnps' | 'final_payslip'>('work_certificate');

  // Generate work certificate mutation
  const generateCertificate = trpc.documents.generateWorkCertificate.useMutation({
    onSuccess: (data) => {
      toast({
        title: 'Certificat généré',
        description: 'Le certificat de travail a été généré avec succès.',
      });
      refetch();
      setShowGenerateDialog(false);
      setSelectedTermination(null);
      setIssuedBy('');
    },
    onError: (error) => {
      toast({
        title: 'Erreur',
        description: error.message || 'Impossible de générer le certificat.',
        variant: 'destructive',
      });
    },
  });

  // Generate CNPS attestation mutation
  const generateCNPS = trpc.documents.generateCNPSAttestation.useMutation({
    onSuccess: (data) => {
      toast({
        title: 'Attestation générée',
        description: `Attestation CNPS générée avec succès (${data.contributionsCount} périodes).`,
      });
      refetch();
      setShowGenerateDialog(false);
      setSelectedTermination(null);
      setIssuedBy('');
    },
    onError: (error) => {
      toast({
        title: 'Erreur',
        description: error.message || 'Impossible de générer l\'attestation CNPS.',
        variant: 'destructive',
      });
    },
  });

  // Generate final payslip mutation
  const generatePayslip = trpc.documents.generateFinalPayslip.useMutation({
    onSuccess: (data) => {
      toast({
        title: 'Bulletin généré',
        description: `Bulletin de paie final généré avec succès (${data.netAmount.toLocaleString()} FCFA net).`,
      });
      refetch();
      setShowGenerateDialog(false);
      setSelectedTermination(null);
      setPayDate('');
    },
    onError: (error) => {
      toast({
        title: 'Erreur',
        description: error.message || 'Impossible de générer le bulletin de paie final.',
        variant: 'destructive',
      });
    },
  });

  const handleGenerateCertificate = (terminationId: string) => {
    setSelectedTermination(terminationId);
    setDocumentType('work_certificate');
    setShowGenerateDialog(true);
  };

  const handleGenerateCNPS = (terminationId: string) => {
    setSelectedTermination(terminationId);
    setDocumentType('cnps');
    setShowGenerateDialog(true);
  };

  const handleGeneratePayslip = (terminationId: string) => {
    setSelectedTermination(terminationId);
    setDocumentType('final_payslip');
    // Set default pay date to today
    setPayDate(new Date().toISOString().split('T')[0]);
    setShowGenerateDialog(true);
  };

  const confirmGenerate = () => {
    if (!selectedTermination) {
      return;
    }

    if (documentType === 'final_payslip') {
      if (!payDate.trim()) {
        toast({
          title: 'Champ requis',
          description: 'Veuillez entrer la date de paiement.',
          variant: 'destructive',
        });
        return;
      }

      generatePayslip.mutate({
        terminationId: selectedTermination,
        payDate: payDate.trim(),
      });
    } else {
      if (!issuedBy.trim()) {
        toast({
          title: 'Champ requis',
          description: 'Veuillez entrer le nom du signataire.',
          variant: 'destructive',
        });
        return;
      }

      if (documentType === 'work_certificate') {
        generateCertificate.mutate({
          terminationId: selectedTermination,
          issuedBy: issuedBy.trim(),
        });
      } else {
        generateCNPS.mutate({
          terminationId: selectedTermination,
          issuedBy: issuedBy.trim(),
        });
      }
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
      pending: { variant: 'secondary', label: 'En attente' },
      notice_period: { variant: 'default', label: 'Préavis en cours' },
      documents_pending: { variant: 'outline', label: 'Documents à générer' },
      completed: { variant: 'default', label: 'Complété' },
    };
    const config = variants[status] || variants.pending;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getDocumentStatus = (url: string | null, generatedAt: string | null) => {
    if (url && generatedAt) {
      return (
        <div className="flex items-center gap-2 text-sm text-green-600">
          <CheckCircle className="h-4 w-4" />
          <span>Généré le {format(new Date(generatedAt), 'dd/MM/yyyy', { locale: fr })}</span>
        </div>
      );
    }
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Clock className="h-4 w-4" />
        <span>Non généré</span>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Cessations de contrat</h1>
        <p className="text-muted-foreground">
          Gérer les cessations d'employés et générer les documents requis
        </p>
      </div>

      {!terminations || terminations.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-lg font-medium mb-2">Aucune cessation</p>
            <p className="text-sm text-muted-foreground">
              Les cessations de contrat apparaîtront ici
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {terminations.map((termination) => (
            <Card key={termination.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-xl mb-2">
                      Cessation - {termination.employeeId}
                    </CardTitle>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span>Date: {format(new Date(termination.terminationDate), 'dd MMMM yyyy', { locale: fr })}</span>
                      <span>Raison: {termination.terminationReason}</span>
                    </div>
                  </div>
                  {getStatusBadge(termination.status)}
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Work Certificate */}
                  <div className="border rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <FileText className="h-5 w-5" />
                      <h3 className="font-medium">Certificat de travail</h3>
                    </div>
                    {getDocumentStatus(termination.workCertificateUrl, termination.workCertificateGeneratedAt)}
                    <div className="mt-3 flex gap-2">
                      {termination.workCertificateUrl ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => window.open(termination.workCertificateUrl!, '_blank')}
                        >
                          <ExternalLink className="h-4 w-4 mr-2" />
                          Ouvrir
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          onClick={() => handleGenerateCertificate(termination.id)}
                          disabled={generateCertificate.isPending}
                        >
                          {generateCertificate.isPending ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <FileText className="h-4 w-4 mr-2" />
                          )}
                          Générer
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Final Payslip */}
                  <div className="border rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <FileText className="h-5 w-5" />
                      <h3 className="font-medium">Bulletin final</h3>
                    </div>
                    {getDocumentStatus(termination.finalPayslipUrl, termination.finalPayslipGeneratedAt)}
                    <div className="mt-3 flex gap-2">
                      {termination.finalPayslipUrl ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => window.open(termination.finalPayslipUrl!, '_blank')}
                        >
                          <ExternalLink className="h-4 w-4 mr-2" />
                          Ouvrir
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          onClick={() => handleGeneratePayslip(termination.id)}
                          disabled={generatePayslip.isPending}
                        >
                          {generatePayslip.isPending ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <FileText className="h-4 w-4 mr-2" />
                          )}
                          Générer
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* CNPS Attestation */}
                  <div className="border rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <FileText className="h-5 w-5" />
                      <h3 className="font-medium">Attestation CNPS</h3>
                    </div>
                    {getDocumentStatus(termination.cnpsAttestationUrl, termination.cnpsAttestationGeneratedAt)}
                    <div className="mt-3 flex gap-2">
                      {termination.cnpsAttestationUrl ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => window.open(termination.cnpsAttestationUrl!, '_blank')}
                        >
                          <ExternalLink className="h-4 w-4 mr-2" />
                          Ouvrir
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          onClick={() => handleGenerateCNPS(termination.id)}
                          disabled={generateCNPS.isPending}
                        >
                          {generateCNPS.isPending ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <FileText className="h-4 w-4 mr-2" />
                          )}
                          Générer
                        </Button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Financial Summary */}
                <div className="mt-6 pt-6 border-t">
                  <h3 className="font-medium mb-3">Résumé financier</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Préavis</p>
                      <p className="font-medium">{termination.noticePeriodDays} jours</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Indemnité</p>
                      <p className="font-medium">{termination.severanceAmount ? parseFloat(termination.severanceAmount).toLocaleString() : '0'} FCFA</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Ancienneté</p>
                      <p className="font-medium">{termination.yearsOfService ? parseFloat(termination.yearsOfService).toFixed(1) : '0'} ans</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Taux indemnité</p>
                      <p className="font-medium">{termination.severanceRate}%</p>
                    </div>
                  </div>
                </div>

                {/* Job Search Calendar */}
                {termination.status === 'notice_period' && (
                  <div className="mt-6 pt-6 border-t">
                    <Collapsible defaultOpen={true}>
                      <CollapsibleTrigger className="flex items-center justify-between w-full">
                        <h3 className="font-medium">Jours de recherche d'emploi</h3>
                        <ChevronDown className="h-4 w-4" />
                      </CollapsibleTrigger>
                      <CollapsibleContent className="mt-4">
                        <JobSearchCalendar
                          terminationId={termination.id}
                          employeeId={termination.employeeId}
                          noticeStartDate={new Date(new Date(termination.terminationDate).getTime() - termination.noticePeriodDays * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}
                          terminationDate={termination.terminationDate}
                          isHR={true}
                        />
                      </CollapsibleContent>
                    </Collapsible>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Generate Document Dialog */}
      <Dialog open={showGenerateDialog} onOpenChange={setShowGenerateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {documentType === 'work_certificate'
                ? 'Générer le certificat de travail'
                : documentType === 'cnps'
                ? 'Générer l\'attestation CNPS'
                : 'Générer le bulletin de paie final'}
            </DialogTitle>
            <DialogDescription>
              {documentType === 'work_certificate'
                ? 'Le certificat doit être délivré dans les 48 heures selon la Convention Collective Article 40.'
                : documentType === 'cnps'
                ? 'L\'attestation doit être délivrée dans les 15 jours selon la Convention Collective Article 40.'
                : 'Le bulletin de paie final inclut le salaire proratisé, l\'indemnité de licenciement et le solde de congés.'}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {documentType === 'final_payslip' ? (
              <>
                <Label htmlFor="payDate">Date de paiement *</Label>
                <Input
                  id="payDate"
                  type="date"
                  value={payDate}
                  onChange={(e) => setPayDate(e.target.value)}
                  className="mt-2"
                />
                <p className="text-sm text-muted-foreground mt-2">
                  Date à laquelle le paiement sera effectué.
                </p>
              </>
            ) : (
              <>
                <Label htmlFor="issuedBy">Nom du signataire *</Label>
                <Input
                  id="issuedBy"
                  placeholder="Ex: Jean Dupont, Directeur RH"
                  value={issuedBy}
                  onChange={(e) => setIssuedBy(e.target.value)}
                  className="mt-2"
                />
                <p className="text-sm text-muted-foreground mt-2">
                  {documentType === 'work_certificate'
                    ? 'Ce nom apparaîtra sur le certificat de travail.'
                    : 'Ce nom apparaîtra sur l\'attestation CNPS.'}
                </p>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowGenerateDialog(false)}>
              Annuler
            </Button>
            <Button
              onClick={confirmGenerate}
              disabled={
                (generateCertificate.isPending || generateCNPS.isPending || generatePayslip.isPending) ||
                (documentType === 'final_payslip' ? !payDate.trim() : !issuedBy.trim())
              }
            >
              {(generateCertificate.isPending || generateCNPS.isPending || generatePayslip.isPending) ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Génération...
                </>
              ) : (
                documentType === 'work_certificate'
                  ? 'Générer le certificat'
                  : documentType === 'cnps'
                  ? 'Générer l\'attestation'
                  : 'Générer le bulletin'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
