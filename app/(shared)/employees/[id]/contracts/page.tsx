/**
 * Contract Management Page
 *
 * Dedicated page for managing employee contracts:
 * - View contract timeline and history
 * - Renew CDD contracts
 * - Convert CDD to CDI
 * - View compliance alerts
 *
 * Mobile-first design with progressive disclosure
 */

'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import {
  ArrowLeft,
  FileText,
  Calendar,
  AlertCircle,
  Clock,
  RefreshCw,
  CheckCircle,
  Loader2,
} from 'lucide-react';
import { trpc } from '@/lib/trpc/client';
import { ContractTimeline } from '@/components/contracts/contract-timeline';
import { RenewContractDialog } from '@/components/contracts/renew-contract-dialog';
import { ConvertToCDIDialog } from '@/components/contracts/convert-to-cdi-dialog';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';

// ============================================================================
// Types
// ============================================================================

interface ContractPageProps {
  params: Promise<{
    id: string;
  }>;
}

// ============================================================================
// Component
// ============================================================================

export default function ContractManagementPage({ params }: ContractPageProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [showRenewDialog, setShowRenewDialog] = useState(false);
  const [showConvertDialog, setShowConvertDialog] = useState(false);

  // Unwrap async params (Next.js 15)
  const resolvedParams = React.use(params);
  const employeeId = resolvedParams.id;

  // Fetch employee data
  const { data: employee, isLoading: isLoadingEmployee } = trpc.employees.getById.useQuery({
    id: employeeId,
  });

  // Fetch compliance status
  const { data: compliance, isLoading: isLoadingCompliance } = trpc.compliance.checkCDDCompliance.useQuery(
    { employeeId },
    { enabled: !!employee && (employee as any)?.contract?.contractType === 'CDD' }
  );

  if (isLoadingEmployee) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="container mx-auto py-8">
        <Alert variant="destructive">
          <AlertDescription>Employé non trouvé</AlertDescription>
        </Alert>
      </div>
    );
  }

  const emp = employee as any;
  const contract = emp.contract;

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-background border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-3 mb-3">
            <Link href={`/employees/${employeeId}/edit`}>
              <Button variant="ghost" size="sm" className="min-h-[44px]">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Retour
              </Button>
            </Link>
          </div>

          {/* Employee Info */}
          <Card>
            <CardContent className="py-3">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <FileText className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h1 className="text-lg font-semibold">
                    {emp.firstName} {emp.lastName}
                  </h1>
                  <p className="text-sm text-muted-foreground">
                    Gestion des contrats
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-6 space-y-6">
        {/* No Contract */}
        {!contract && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Aucun contrat actif</AlertTitle>
            <AlertDescription>
              Cet employé n'a pas de contrat actif. Créez un nouveau contrat pour commencer.
            </AlertDescription>
          </Alert>
        )}

        {/* Current Contract Card */}
        {contract && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Contrat actuel
              </CardTitle>
              <CardDescription>
                Informations sur le contrat en cours
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Contract Type */}
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Type de contrat</span>
                <Badge variant={contract.contractType === 'CDI' ? 'default' : 'secondary'}>
                  {contract.contractType}
                </Badge>
              </div>

              {/* Contract Number */}
              {contract.contractNumber && (
                <div className="space-y-1">
                  <span className="text-sm font-medium">Numéro de contrat</span>
                  <p className="text-sm text-muted-foreground">{contract.contractNumber}</p>
                </div>
              )}

              <Separator />

              {/* Contract Dates */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Calendar className="h-4 w-4" />
                    Date de début
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {contract.startDate
                      ? format(parseISO(contract.startDate), 'dd MMMM yyyy', { locale: fr })
                      : 'Non spécifiée'}
                  </p>
                </div>

                {contract.endDate && (
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Clock className="h-4 w-4" />
                      Date de fin
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {format(parseISO(contract.endDate), 'dd MMMM yyyy', { locale: fr })}
                    </p>
                  </div>
                )}
              </div>

              {/* CDD Specific Info */}
              {contract.contractType === 'CDD' && (
                <>
                  <Separator />
                  <div className="space-y-3">
                    {/* Renewal Count */}
                    {contract.renewalCount !== null && contract.renewalCount !== undefined && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Renouvellements</span>
                        <Badge variant="secondary">
                          {contract.renewalCount} / 2
                        </Badge>
                      </div>
                    )}

                    {/* CDD Reason */}
                    {contract.cddReason && (
                      <div className="space-y-1">
                        <span className="text-sm font-medium">Motif du CDD</span>
                        <p className="text-sm text-muted-foreground">
                          {contract.cddReason}
                        </p>
                      </div>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        )}

        {/* Contract HTML Content */}
        {contract && contract.contractHtmlContent && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Contenu du contrat
              </CardTitle>
              <CardDescription>
                Contrat généré depuis l'éditeur
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div
                className="prose prose-sm max-w-none p-4 bg-muted/30 rounded-lg border"
                dangerouslySetInnerHTML={{ __html: contract.contractHtmlContent }}
              />
            </CardContent>
          </Card>
        )}

        {/* Navigation to all contracts */}
        <Card>
          <CardContent className="py-4">
            <Link href="/contracts">
              <Button variant="outline" className="w-full min-h-[44px]">
                <FileText className="mr-2 h-4 w-4" />
                Tous les contrats
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* Contract Timeline (CDD only) */}
        {contract && contract.contractType === 'CDD' && compliance && (
          <ContractTimeline employeeId={employeeId} compliance={compliance} />
        )}

        {/* CDI Status */}
        {contract && contract.contractType === 'CDI' && (
          <Card>
            <CardContent className="py-6">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-success/10 flex items-center justify-center">
                  <CheckCircle className="h-6 w-6 text-success" />
                </div>
                <div>
                  <h3 className="font-semibold">Contrat à Durée Indéterminée</h3>
                  <p className="text-sm text-muted-foreground">
                    Aucune action de conformité requise pour les contrats CDI
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Renew Contract Dialog */}
        {contract && contract.endDate && (
          <RenewContractDialog
            open={showRenewDialog}
            onOpenChange={setShowRenewDialog}
            contractId={contract.id}
            currentEndDate={parseISO(contract.endDate)}
            renewalCount={contract.renewalCount || 0}
            onSuccess={() => {
              toast({
                title: 'Succès',
                description: 'Le contrat a été renouvelé avec succès',
              });
            }}
          />
        )}

        {/* Convert to CDI Dialog */}
        {contract && (
          <ConvertToCDIDialog
            open={showConvertDialog}
            onOpenChange={setShowConvertDialog}
            contractId={contract.id}
            employeeName={`${emp.firstName} ${emp.lastName}`}
            currentEndDate={contract.endDate ? parseISO(contract.endDate) : undefined}
            onSuccess={() => {
              toast({
                title: 'Succès',
                description: 'Le contrat a été converti en CDI avec succès',
              });
            }}
          />
        )}
      </div>
    </div>
  );
}
