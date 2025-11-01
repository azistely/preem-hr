/**
 * Contract Info Card Component
 *
 * Displays current contract information with edit capability
 * Used in employee edit form to show and edit contract details
 */

'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FileText, Calendar, Clock, ArrowRight, Pencil } from 'lucide-react';
import { format, parseISO, differenceInDays } from 'date-fns';
import { fr } from 'date-fns/locale';
import Link from 'next/link';
import { EditContractDialog } from './edit-contract-dialog';

// ============================================================================
// Types
// ============================================================================

interface ContractInfoCardProps {
  employeeId: string;
  contract: {
    id: string;
    contractType: string;
    contractNumber?: string | null;
    startDate: string | Date;
    endDate?: string | Date | null;
    renewalCount?: number | null;
    cddReason?: string | null;
    isActive: boolean;
  } | null;
}

// ============================================================================
// Helper Functions
// ============================================================================

const getContractTypeLabel = (type: string) => {
  const labels: Record<string, string> = {
    CDI: 'CDI (Contrat à Durée Indéterminée)',
    CDD: 'CDD (Contrat à Durée Déterminée)',
    CDDTI: 'CDDTI (Contrat Journalier)',
    STAGE: 'Stage',
    INTERIM: 'Intérim',
  };
  return labels[type] || type;
};

const getContractTypeBadgeVariant = (type: string): "default" | "secondary" | "outline" => {
  if (type === 'CDI') return 'default';
  if (type === 'CDD') return 'secondary';
  return 'outline';
};

const getCDDReasonLabel = (reason: string | null | undefined) => {
  if (!reason) return null;
  const labels: Record<string, string> = {
    REMPLACEMENT: 'Remplacement',
    SURCROIT_ACTIVITE: 'Surcroît d\'activité',
    SAISONNIER: 'Travail saisonnier',
    PROJET: 'Projet spécifique',
    AUTRE: 'Autre',
  };
  return labels[reason] || reason;
};

const formatDate = (date: string | Date | null | undefined) => {
  if (!date) return null;
  try {
    const dateObj = typeof date === 'string' ? parseISO(date) : date;
    return format(dateObj, 'dd MMM yyyy', { locale: fr });
  } catch {
    return null;
  }
};

// ============================================================================
// Component
// ============================================================================

export function ContractInfoCard({ employeeId, contract }: ContractInfoCardProps) {
  const [showEditDialog, setShowEditDialog] = useState(false);

  if (!contract) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="h-5 w-5" />
            Contrat de travail
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-muted p-4 space-y-3">
            <p className="text-sm text-muted-foreground">
              Aucun contrat actif pour cet employé.
            </p>
            <Link href={`/employees/${employeeId}/contracts`}>
              <Button variant="outline" className="w-full min-h-[44px]">
                <FileText className="h-4 w-4 mr-2" />
                Gérer les contrats
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Calculate days until end date (for CDD)
  let daysRemaining: number | null = null;
  if (contract.endDate && contract.contractType === 'CDD') {
    try {
      const endDate = typeof contract.endDate === 'string' ? parseISO(contract.endDate) : contract.endDate;
      daysRemaining = differenceInDays(endDate, new Date());
    } catch {
      daysRemaining = null;
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <FileText className="h-5 w-5" />
          Contrat de travail
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Contract Type */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Type de contrat</span>
            <Badge variant={getContractTypeBadgeVariant(contract.contractType)}>
              {contract.contractType}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {getContractTypeLabel(contract.contractType)}
          </p>
        </div>

        {/* Contract Number */}
        {contract.contractNumber && (
          <div className="space-y-1">
            <span className="text-sm font-medium">Numéro de contrat</span>
            <p className="text-sm text-muted-foreground">{contract.contractNumber}</p>
          </div>
        )}

        {/* Contract Dates */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Calendar className="h-4 w-4" />
              Date de début
            </div>
            <p className="text-sm text-muted-foreground">
              {formatDate(contract.startDate) || 'Non spécifiée'}
            </p>
          </div>

          {contract.endDate && (
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Clock className="h-4 w-4" />
                Date de fin
              </div>
              <p className="text-sm text-muted-foreground">
                {formatDate(contract.endDate) || 'Non spécifiée'}
              </p>
              {daysRemaining !== null && (
                <p className={`text-xs ${daysRemaining < 30 ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
                  {daysRemaining > 0
                    ? `${daysRemaining} jour${daysRemaining > 1 ? 's' : ''} restant${daysRemaining > 1 ? 's' : ''}`
                    : daysRemaining === 0
                    ? 'Expire aujourd\'hui'
                    : 'Expiré'}
                </p>
              )}
            </div>
          )}
        </div>

        {/* CDD Specific Info */}
        {contract.contractType === 'CDD' && (
          <div className="pt-3 border-t space-y-3">
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
                  {getCDDReasonLabel(contract.cddReason)}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Status Badge */}
        <div className="flex items-center justify-between pt-3 border-t">
          <span className="text-sm text-muted-foreground">Statut</span>
          <Badge variant={contract.isActive ? 'default' : 'secondary'}>
            {contract.isActive ? 'Actif' : 'Inactif'}
          </Badge>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => setShowEditDialog(true)}
            className="min-h-[44px]"
          >
            <Pencil className="h-4 w-4 mr-2" />
            Modifier
          </Button>
          <Link href={`/employees/${employeeId}/contracts`}>
            <Button variant="outline" className="w-full min-h-[44px]">
              Gérer
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </Link>
        </div>

        {/* Info Message */}
        <p className="text-xs text-muted-foreground">
          Vous pouvez modifier les détails du contrat ou accéder à la page de gestion complète.
        </p>
      </CardContent>

      {/* Edit Dialog */}
      {showEditDialog && (
        <EditContractDialog
          open={showEditDialog}
          onOpenChange={setShowEditDialog}
          contract={contract}
        />
      )}
    </Card>
  );
}
