/**
 * Reusable Dependent Form Component
 *
 * Used in:
 * - Employee detail page (via DependentsManager)
 * - Hire wizard (Step 4 - Dependents)
 *
 * Features:
 * - Complete CNPS/CMU tracking fields
 * - Document verification requirements
 * - Age-based validation
 */

'use client';

import { useState, useEffect } from 'react';
import { DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { UploadDocumentDialog } from '@/components/documents/upload-document-dialog';
import { TempFileUpload } from '@/components/documents/temp-file-upload';
import { Upload, FileText, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

export interface DependentFormData {
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
  coverageCertificateFileName?: string;
  coverageCertificateExpiryDate?: string;
}

interface DependentFormProps {
  data: DependentFormData | null;
  onSubmit: (data: DependentFormData) => void;
  onCancel: () => void;
  isSubmitting: boolean;
  employeeId?: string | null;
}

export function DependentForm({ data, onSubmit, onCancel, isSubmitting, employeeId }: DependentFormProps) {
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

  const [showUploadDialog, setShowUploadDialog] = useState(false);

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

    // Validate required fields
    if (!formData.firstName.trim()) {
      toast.error('Le prénom est requis');
      return;
    }

    if (!formData.lastName.trim()) {
      toast.error('Le nom est requis');
      return;
    }

    if (!formData.dateOfBirth) {
      toast.error('La date de naissance est requise');
      return;
    }

    if (!formData.gender) {
      toast.error('Le genre est requis');
      return;
    }

    // Validate coverage certificate if applicable
    if (formData.coveredByOtherEmployer && !formData.coverageCertificateType?.trim()) {
      toast.error('Le type de certificat de couverture est requis lorsque le dépendant est couvert par un autre employeur');
      return;
    }

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
                  <Label>Certificat de couverture</Label>

                  {employeeId ? (
                    <>
                      {formData.coverageCertificateUrl ? (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                            <FileText className="h-4 w-4 text-green-600" />
                            <span className="text-sm text-green-900 flex-1">
                              Document uploadé
                            </span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => window.open(formData.coverageCertificateUrl, '_blank')}
                            >
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setShowUploadDialog(true)}
                            className="w-full"
                          >
                            <Upload className="mr-2 h-4 w-4" />
                            Remplacer le document
                          </Button>
                        </div>
                      ) : (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setShowUploadDialog(true)}
                          className="w-full min-h-[48px]"
                        >
                          <Upload className="mr-2 h-4 w-4" />
                          Uploader le certificat
                        </Button>
                      )}

                      <UploadDocumentDialog
                        open={showUploadDialog}
                        onOpenChange={setShowUploadDialog}
                        employeeId={employeeId}
                        onUploadSuccess={(result) => {
                          if (result?.fileUrl) {
                            setFormData(prev => ({
                              ...prev,
                              coverageCertificateUrl: result.fileUrl,
                            }));
                          }
                          setShowUploadDialog(false);
                        }}
                      />
                    </>
                  ) : (
                    <TempFileUpload
                      onUploadSuccess={(fileUrl, fileName) => {
                        setFormData(prev => ({
                          ...prev,
                          coverageCertificateUrl: fileUrl,
                          coverageCertificateFileName: fileName,
                        }));
                      }}
                    />
                  )}

                  <p className="text-xs text-muted-foreground">
                    Optionnel - Attestation de couverture par un autre employeur
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

// Helper function
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
