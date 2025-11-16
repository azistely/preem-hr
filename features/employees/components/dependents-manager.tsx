/**
 * Dependents Manager Component
 *
 * Manages employee dependents with document verification for fiscal parts and CMU.
 *
 * Features:
 * - List all dependents with verification status
 * - Add/edit/remove dependents
 * - Upload documents for dependents over 21
 * - Visual indicators for verification status
 * - Expiry warnings
 */

'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Trash2, CheckCircle, AlertCircle, Clock, XCircle } from 'lucide-react';
import { api } from '@/trpc/react';
import { toast } from 'sonner';
import { formatDate } from '@/lib/utils';
import { DependentForm, type DependentFormData } from './dependent-form';

interface DependentsManagerProps {
  employeeId: string;
  onDependentsChange?: () => void;
}

export function DependentsManager({
  employeeId,
  onDependentsChange,
}: DependentsManagerProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingDependent, setEditingDependent] = useState<DependentFormData | null>(null);

  // Query dependents
  const { data: dependents, refetch } = api.dependents.list.useQuery(
    { employeeId },
    { enabled: !!employeeId }
  );

  // Mutations
  const createMutation = api.dependents.create.useMutation({
    onSuccess: () => {
      toast.success('Personne à charge ajoutée');
      refetch();
      onDependentsChange?.();
      setIsDialogOpen(false);
      setEditingDependent(null);
    },
    onError: (error) => {
      toast.error(error.message || 'Erreur lors de l\'ajout');
    },
  });

  const updateMutation = api.dependents.update.useMutation({
    onSuccess: () => {
      toast.success('Personne à charge mise à jour');
      refetch();
      onDependentsChange?.();
      setIsDialogOpen(false);
      setEditingDependent(null);
    },
    onError: (error) => {
      toast.error(error.message || 'Erreur lors de la mise à jour');
    },
  });

  const deleteMutation = api.dependents.delete.useMutation({
    onSuccess: () => {
      toast.success('Personne à charge supprimée');
      refetch();
      onDependentsChange?.();
    },
    onError: (error) => {
      toast.error(error.message || 'Erreur lors de la suppression');
    },
  });

  const handleSubmit = (data: DependentFormData) => {
    // Validate gender is provided (required for CMU tracking)
    if (!data.gender) {
      alert('Le genre est requis pour tous les dépendants.');
      return;
    }

    if (data.id) {
      updateMutation.mutate({
        id: data.id,
        ...data,
        gender: data.gender, // Explicitly pass to satisfy TypeScript
      });
    } else {
      // tenantId automatically injected from backend context
      createMutation.mutate({
        employeeId,
        ...data,
        gender: data.gender, // Explicitly pass to satisfy TypeScript
      });
    }
  };

  const handleDelete = (id: string) => {
    if (confirm('Êtes-vous sûr de vouloir supprimer cette personne à charge ?')) {
      deleteMutation.mutate({ id });
    }
  };

  const getStatusBadge = (dependent: any) => {
    const age = calculateAge(new Date(dependent.dateOfBirth));

    // SPOUSE: Always requires document (marriage certificate)
    if (dependent.relationship === 'spouse') {
      if (dependent.isVerified && dependent.documentType) {
        // Spouse verified with marriage certificate
        return (
          <Badge variant="default" className="bg-green-500">
            <CheckCircle className="w-3 h-3 mr-1" />
            Vérifié (marié/e)
          </Badge>
        );
      }
      // Spouse not verified
      return (
        <Badge variant="destructive">
          <AlertCircle className="w-3 h-3 mr-1" />
          Acte de mariage requis
        </Badge>
      );
    }

    // CHILD: Age-based verification
    if (dependent.relationship === 'child') {
      // Under 21: Auto-verified
      if (age < 21) {
        return (
          <Badge variant="default" className="bg-green-500">
            <CheckCircle className="w-3 h-3 mr-1" />
            Vérifié (- de 21 ans)
          </Badge>
        );
      }

      // Over 21: Check document
      if (dependent.isVerified && dependent.documentExpiryDate) {
        const daysUntilExpiry = getDaysUntilExpiry(new Date(dependent.documentExpiryDate));

        if (daysUntilExpiry < 0) {
          return (
            <Badge variant="destructive">
              <XCircle className="w-3 h-3 mr-1" />
              Document expiré
            </Badge>
          );
        } else if (daysUntilExpiry <= 30) {
          return (
            <Badge variant="secondary" className="bg-orange-500 text-white">
              <Clock className="w-3 h-3 mr-1" />
              Expire dans {daysUntilExpiry}j
            </Badge>
          );
        } else {
          return (
            <Badge variant="default" className="bg-green-500">
              <CheckCircle className="w-3 h-3 mr-1" />
              Vérifié
            </Badge>
          );
        }
      }

      // Over 21, not verified
      return (
        <Badge variant="destructive">
          <AlertCircle className="w-3 h-3 mr-1" />
          Document requis
        </Badge>
      );
    }

    // OTHER: Requires document
    if (dependent.isVerified && dependent.documentType) {
      return (
        <Badge variant="default" className="bg-green-500">
          <CheckCircle className="w-3 h-3 mr-1" />
          Vérifié
        </Badge>
      );
    }

    return (
      <Badge variant="destructive">
        <AlertCircle className="w-3 h-3 mr-1" />
        Document requis
      </Badge>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Personnes à charge</h3>
          <p className="text-sm text-muted-foreground">
            Pour calcul fiscal (parts) et CMU
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setEditingDependent(null)}>
              <Plus className="w-4 h-4 mr-2" />
              Ajouter
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DependentForm
              data={editingDependent}
              onSubmit={handleSubmit}
              onCancel={() => {
                setIsDialogOpen(false);
                setEditingDependent(null);
              }}
              isSubmitting={createMutation.isPending || updateMutation.isPending}
              employeeId={employeeId}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Dependents List */}
      {dependents && dependents.length > 0 ? (
        <div className="grid gap-3">
          {dependents.map((dependent) => (
            <Card key={dependent.id}>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-3">
                      <h4 className="font-semibold">
                        {dependent.firstName} {dependent.lastName}
                      </h4>
                      {getStatusBadge(dependent)}
                    </div>

                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-muted-foreground">
                      <div>
                        <span className="font-medium">Date de naissance:</span>{' '}
                        {formatDate(new Date(dependent.dateOfBirth))}
                        {' '}({calculateAge(new Date(dependent.dateOfBirth))} ans)
                      </div>
                      <div>
                        <span className="font-medium">Relation:</span>{' '}
                        {getRelationshipLabel(dependent.relationship)}
                      </div>

                      {dependent.documentType && (
                        <>
                          <div>
                            <span className="font-medium">Document:</span>{' '}
                            {getDocumentTypeLabel(dependent.documentType)}
                          </div>
                          {dependent.documentNumber && (
                            <div>
                              <span className="font-medium">N° document:</span>{' '}
                              {dependent.documentNumber}
                            </div>
                          )}
                          {dependent.documentExpiryDate && (
                            <div>
                              <span className="font-medium">Expire le:</span>{' '}
                              {formatDate(new Date(dependent.documentExpiryDate))}
                            </div>
                          )}
                        </>
                      )}

                      <div>
                        <span className="font-medium">Fiscal:</span>{' '}
                        {dependent.eligibleForFiscalParts ? '✓ Oui' : '✗ Non'}
                      </div>
                      <div>
                        <span className="font-medium">CMU:</span>{' '}
                        {dependent.eligibleForCmu ? '✓ Oui' : '✗ Non'}
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEditingDependent({
                          id: dependent.id,
                          firstName: dependent.firstName,
                          lastName: dependent.lastName,
                          dateOfBirth: dependent.dateOfBirth,
                          relationship: dependent.relationship,
                          gender: dependent.gender || undefined,
                          documentType: dependent.documentType || '',
                          documentNumber: dependent.documentNumber || '',
                          documentExpiryDate: dependent.documentExpiryDate || '',
                          notes: dependent.notes || '',
                          // CMU tracking fields
                          cnpsNumber: dependent.cnpsNumber || '',
                          cmuNumber: dependent.cmuNumber || '',
                          coveredByOtherEmployer: dependent.coveredByOtherEmployer || false,
                          coverageCertificateType: dependent.coverageCertificateType || '',
                          coverageCertificateNumber: dependent.coverageCertificateNumber || '',
                          coverageCertificateUrl: dependent.coverageCertificateUrl || '',
                          coverageCertificateExpiryDate: dependent.coverageCertificateExpiryDate || '',
                        });
                        setIsDialogOpen(true);
                      }}
                    >
                      Modifier
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(dependent.id)}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground text-center">
              Aucune personne à charge enregistrée
            </p>
          </CardContent>
        </Card>
      )}

      {/* Info Box */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="pt-6">
          <p className="text-sm text-blue-900">
            <strong>💡 À savoir:</strong>
          </p>
          <ul className="text-sm text-blue-800 mt-2 space-y-1 list-disc list-inside">
            <li><strong>Conjoint(e):</strong> Acte de mariage requis</li>
            <li><strong>Enfants &lt; 21 ans:</strong> Vérifiés automatiquement</li>
            <li><strong>Enfants ≥ 21 ans:</strong> Certificat de fréquentation requis</li>
            <li>Utilisé pour parts fiscales (ITS) et CMU</li>
            <li>Maximum 4 enfants comptés pour le calcul fiscal</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================================
// Helper Functions
// ============================================================================

function calculateAge(dateOfBirth: Date): number {
  const today = new Date();
  let age = today.getFullYear() - dateOfBirth.getFullYear();
  const monthDiff = today.getMonth() - dateOfBirth.getMonth();

  if (
    monthDiff < 0 ||
    (monthDiff === 0 && today.getDate() < dateOfBirth.getDate())
  ) {
    age--;
  }

  return age;
}

function getDaysUntilExpiry(expiryDate: Date): number {
  const today = new Date();
  const diffTime = expiryDate.getTime() - today.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

function getRelationshipLabel(relationship: string): string {
  const labels: Record<string, string> = {
    child: 'Enfant',
    spouse: 'Conjoint(e)',
    other: 'Autre',
  };
  return labels[relationship] || relationship;
}

function getDocumentTypeLabel(documentType: string): string {
  const labels: Record<string, string> = {
    // Spouse documents
    acte_mariage: 'Acte de mariage',
    livret_famille: 'Livret de famille',
    // Child documents
    certificat_frequentation: 'Certificat de fréquentation',
    attestation_scolarite: 'Attestation de scolarité',
    carte_etudiant: 'Carte d\'étudiant',
    // Other documents
    acte_naissance: 'Acte de naissance',
    autre: 'Autre document',
  };
  return labels[documentType] || documentType;
}
