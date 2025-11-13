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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Trash2, Upload, CheckCircle, AlertCircle, Clock, XCircle } from 'lucide-react';
import { api } from '@/trpc/react';
import { toast } from 'sonner';
import { formatDate } from '@/lib/utils';

interface DependentsManagerProps {
  employeeId: string;
  onDependentsChange?: () => void;
}

interface DependentFormData {
  id?: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  relationship: 'child' | 'spouse' | 'other';
  gender?: 'male' | 'female';
  documentType?: string;
  documentNumber?: string;
  documentExpiryDate?: string;
  notes?: string;
  // CMU tracking fields
  cnpsNumber?: string;
  cmuNumber?: string;
  coveredByOtherEmployer?: boolean;
  coverageCertificateType?: string;
  coverageCertificateNumber?: string;
  coverageCertificateUrl?: string;
  coverageCertificateExpiryDate?: string;
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
// Dependent Form Dialog
// ============================================================================

interface DependentFormProps {
  data: DependentFormData | null;
  onSubmit: (data: DependentFormData) => void;
  onCancel: () => void;
  isSubmitting: boolean;
}

function DependentForm({ data, onSubmit, onCancel, isSubmitting }: DependentFormProps) {
  const [formData, setFormData] = useState<DependentFormData>({
    firstName: data?.firstName || '',
    lastName: data?.lastName || '',
    dateOfBirth: data?.dateOfBirth || '',
    relationship: data?.relationship || 'child',
    gender: data?.gender,
    documentType: data?.documentType || '',
    documentNumber: data?.documentNumber || '',
    documentExpiryDate: data?.documentExpiryDate || '',
    notes: data?.notes || '',
    // CMU tracking fields
    cnpsNumber: data?.cnpsNumber || '',
    cmuNumber: data?.cmuNumber || '',
    coveredByOtherEmployer: data?.coveredByOtherEmployer || false,
    coverageCertificateType: data?.coverageCertificateType || '',
    coverageCertificateNumber: data?.coverageCertificateNumber || '',
    coverageCertificateUrl: data?.coverageCertificateUrl || '',
    coverageCertificateExpiryDate: data?.coverageCertificateExpiryDate || '',
    ...(data?.id && { id: data.id }),
  });

  // Update form data when data prop changes (when editing different dependents)
  useEffect(() => {
    if (data) {
      setFormData({
        firstName: data.firstName || '',
        lastName: data.lastName || '',
        dateOfBirth: data.dateOfBirth || '',
        relationship: data.relationship || 'child',
        gender: data.gender,
        documentType: data.documentType || '',
        documentNumber: data.documentNumber || '',
        documentExpiryDate: data.documentExpiryDate || '',
        notes: data.notes || '',
        // CMU tracking fields
        cnpsNumber: data.cnpsNumber || '',
        cmuNumber: data.cmuNumber || '',
        coveredByOtherEmployer: data.coveredByOtherEmployer || false,
        coverageCertificateType: data.coverageCertificateType || '',
        coverageCertificateNumber: data.coverageCertificateNumber || '',
        coverageCertificateUrl: data.coverageCertificateUrl || '',
        coverageCertificateExpiryDate: data.coverageCertificateExpiryDate || '',
        ...(data.id && { id: data.id }),
      });
    }
  }, [data]);

  const age = formData.dateOfBirth
    ? calculateAge(new Date(formData.dateOfBirth))
    : null;

  // Spouse always requires document (marriage certificate)
  // Children >= 21 require document (school certificate)
  const requiresDocument =
    formData.relationship === 'spouse' ||
    (formData.relationship === 'child' && age !== null && age >= 21) ||
    formData.relationship === 'other';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit}>
      <DialogHeader>
        <DialogTitle>
          {data?.id ? 'Modifier' : 'Ajouter'} une personne à charge
        </DialogTitle>
        <DialogDescription>
          Informations pour calcul fiscal et CMU
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4 py-4">
        {/* Name Fields */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="firstName">Prénom *</Label>
            <Input
              id="firstName"
              value={formData.firstName}
              onChange={(e) =>
                setFormData({ ...formData, firstName: e.target.value })
              }
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="lastName">Nom *</Label>
            <Input
              id="lastName"
              value={formData.lastName}
              onChange={(e) =>
                setFormData({ ...formData, lastName: e.target.value })
              }
              required
            />
          </div>
        </div>

        {/* Date of Birth and Relationship */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="dateOfBirth">Date de naissance *</Label>
            <Input
              id="dateOfBirth"
              type="date"
              value={formData.dateOfBirth}
              onChange={(e) =>
                setFormData({ ...formData, dateOfBirth: e.target.value })
              }
              required
            />
            {age !== null && (
              <p className="text-xs text-muted-foreground">Âge: {age} ans</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="relationship">Relation *</Label>
            <Select
              value={formData.relationship}
              onValueChange={(value) =>
                setFormData({
                  ...formData,
                  relationship: value as 'child' | 'spouse' | 'other',
                })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="child">Enfant</SelectItem>
                <SelectItem value="spouse">Conjoint(e)</SelectItem>
                <SelectItem value="other">Autre</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Gender (Required) */}
        <div className="space-y-2">
          <Label htmlFor="gender">Genre *</Label>
          <Select
            value={formData.gender}
            onValueChange={(value) =>
              setFormData({
                ...formData,
                gender: value as 'male' | 'female',
              })
            }
            required
          >
            <SelectTrigger>
              <SelectValue placeholder="Sélectionner..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="male">Masculin</SelectItem>
              <SelectItem value="female">Féminin</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Requis pour tous les dépendants
          </p>
        </div>

        {/* CMU Tracking Fields */}
        <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
          <h4 className="font-medium text-sm">Informations CMU (optionnel)</h4>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="cnpsNumber">Numéro CNPS</Label>
              <Input
                id="cnpsNumber"
                value={formData.cnpsNumber}
                onChange={(e) =>
                  setFormData({ ...formData, cnpsNumber: e.target.value })
                }
                placeholder="Si le dépendant a son propre numéro"
              />
              <p className="text-xs text-muted-foreground">
                Pour les travailleurs avec propre CNPS
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="cmuNumber">Numéro CMU</Label>
              <Input
                id="cmuNumber"
                value={formData.cmuNumber}
                onChange={(e) =>
                  setFormData({ ...formData, cmuNumber: e.target.value })
                }
                placeholder="Si le dépendant a son propre numéro"
              />
              <p className="text-xs text-muted-foreground">
                Pour les personnes avec propre CMU
              </p>
            </div>
          </div>

          {/* Covered by Other Employer */}
          <div className="flex items-start space-x-2">
            <input
              type="checkbox"
              id="coveredByOtherEmployer"
              checked={formData.coveredByOtherEmployer}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  coveredByOtherEmployer: e.target.checked,
                })
              }
              className="mt-1"
            />
            <div className="flex-1">
              <Label htmlFor="coveredByOtherEmployer" className="cursor-pointer">
                Ce dépendant est couvert par la CMU d'un autre employeur
              </Label>
              <p className="text-xs text-muted-foreground mt-1">
                Ex: conjoint(e) ayant son propre employeur, enfant couvert par l'ex-conjoint(e)
              </p>
            </div>
          </div>

          {/* Coverage Certificate Section (Conditional) */}
          {formData.coveredByOtherEmployer && (
            <div className="space-y-4 p-3 bg-orange-50 border border-orange-200 rounded-lg">
              <p className="text-sm text-orange-900 font-medium">
                ⚠️ Ce dépendant ne sera PAS compté dans le calcul CMU
              </p>
              <p className="text-xs text-orange-800">
                Type d'attestation requis (Il/Elle est déjà couvert(e) par un autre employeur)
              </p>

              <div className="space-y-4 mt-3">
                <div className="space-y-2">
                  <Label htmlFor="coverageCertificateType">
                    Type de certificat *
                  </Label>
                  <Input
                    id="coverageCertificateType"
                    value={formData.coverageCertificateType}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        coverageCertificateType: e.target.value,
                      })
                    }
                    placeholder="Attestation de couverture CMU"
                    required={formData.coveredByOtherEmployer}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="coverageCertificateNumber">
                    Numéro du certificat
                  </Label>
                  <Input
                    id="coverageCertificateNumber"
                    value={formData.coverageCertificateNumber}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        coverageCertificateNumber: e.target.value,
                      })
                    }
                    placeholder="Optionnel"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="coverageCertificateExpiryDate">
                    Date d'expiration
                  </Label>
                  <Input
                    id="coverageCertificateExpiryDate"
                    type="date"
                    value={formData.coverageCertificateExpiryDate}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        coverageCertificateExpiryDate: e.target.value,
                      })
                    }
                    min={new Date().toISOString().split('T')[0]}
                  />
                  <p className="text-xs text-muted-foreground">
                    Optionnel - La date doit être dans le futur si renseignée
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="coverageCertificateUrl">
                    Upload du certificat
                  </Label>
                  <Input
                    id="coverageCertificateUrl"
                    type="url"
                    value={formData.coverageCertificateUrl}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        coverageCertificateUrl: e.target.value,
                      })
                    }
                    placeholder="URL du document uploadé (optionnel)"
                  />
                  <p className="text-xs text-muted-foreground">
                    Optionnel - TODO: Intégrer file upload component
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Document Required Warning */}
        {requiresDocument && (
          <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
            {formData.relationship === 'spouse' ? (
              <>
                <p className="text-sm text-orange-900 font-medium">
                  ⚠️ Document requis (conjoint/conjointe)
                </p>
                <p className="text-xs text-orange-800 mt-1">
                  Acte de mariage ou livret de famille obligatoire
                </p>
              </>
            ) : formData.relationship === 'child' ? (
              <>
                <p className="text-sm text-orange-900 font-medium">
                  ⚠️ Document requis (plus de 21 ans)
                </p>
                <p className="text-xs text-orange-800 mt-1">
                  Certificat de fréquentation ou attestation de scolarité obligatoire
                </p>
              </>
            ) : (
              <>
                <p className="text-sm text-orange-900 font-medium">
                  ⚠️ Document requis
                </p>
                <p className="text-xs text-orange-800 mt-1">
                  Document justificatif obligatoire
                </p>
              </>
            )}
          </div>
        )}

        {/* Document Information */}
        {requiresDocument && (
          <>
            <div className="space-y-2">
              <Label htmlFor="documentType">Type de document</Label>
              <Select
                value={formData.documentType}
                onValueChange={(value) =>
                  setFormData({ ...formData, documentType: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner..." />
                </SelectTrigger>
                <SelectContent>
                  {formData.relationship === 'spouse' ? (
                    <>
                      <SelectItem value="acte_mariage">
                        Acte de mariage
                      </SelectItem>
                      <SelectItem value="livret_famille">
                        Livret de famille
                      </SelectItem>
                    </>
                  ) : formData.relationship === 'child' ? (
                    <>
                      <SelectItem value="certificat_frequentation">
                        Certificat de fréquentation
                      </SelectItem>
                      <SelectItem value="attestation_scolarite">
                        Attestation de scolarité
                      </SelectItem>
                      <SelectItem value="carte_etudiant">
                        Carte d'étudiant
                      </SelectItem>
                    </>
                  ) : (
                    <>
                      <SelectItem value="acte_naissance">
                        Acte de naissance
                      </SelectItem>
                      <SelectItem value="autre">
                        Autre document
                      </SelectItem>
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="documentNumber">Numéro de document</Label>
                <Input
                  id="documentNumber"
                  value={formData.documentNumber}
                  onChange={(e) =>
                    setFormData({ ...formData, documentNumber: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="documentExpiryDate">Date d'expiration</Label>
                <Input
                  id="documentExpiryDate"
                  type="date"
                  value={formData.documentExpiryDate}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      documentExpiryDate: e.target.value,
                    })
                  }
                />
              </div>
            </div>
          </>
        )}

        {/* Notes */}
        <div className="space-y-2">
          <Label htmlFor="notes">Notes (optionnel)</Label>
          <Textarea
            id="notes"
            value={formData.notes}
            onChange={(e) =>
              setFormData({ ...formData, notes: e.target.value })
            }
            rows={3}
          />
        </div>
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Annuler
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Enregistrement...' : 'Enregistrer'}
        </Button>
      </DialogFooter>
    </form>
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
