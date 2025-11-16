/**
 * Dependents Step - Hire Wizard
 *
 * Allows adding dependents (spouse, children) during employee creation
 */

'use client';

import { useState } from 'react';
import { UseFormReturn } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Trash2, Info, Users, CheckCircle, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { DependentForm, type DependentFormData } from '../dependent-form';

interface DependentsStepProps {
  form: UseFormReturn<any>;
}

export function DependentsStep({ form }: DependentsStepProps) {
  const [dependents, setDependents] = useState<DependentFormData[]>(
    form.getValues('dependents') || []
  );
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingDependent, setEditingDependent] = useState<DependentFormData | null>(null);

  const handleSubmit = (data: DependentFormData) => {
    let updatedDependents: DependentFormData[];

    if (data.id) {
      // Update existing
      updatedDependents = dependents.map(d =>
        d.id === data.id ? data : d
      );
    } else {
      // Add new with temporary ID
      const newDependent = {
        ...data,
        id: `temp-${Date.now()}`,
      };
      updatedDependents = [...dependents, newDependent];
    }

    setDependents(updatedDependents);
    form.setValue('dependents', updatedDependents);
    setIsDialogOpen(false);
    setEditingDependent(null);
  };

  const handleEdit = (dependent: DependentFormData) => {
    setEditingDependent(dependent);
    setIsDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    const updatedDependents = dependents.filter(d => d.id !== id);
    setDependents(updatedDependents);
    form.setValue('dependents', updatedDependents);
  };

  const calculateAge = (dateOfBirth: string) => {
    const birthDate = new Date(dateOfBirth);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  const getRelationshipLabel = (rel: string) => {
    const labels: Record<string, string> = {
      child: 'Enfant',
      spouse: 'Conjoint(e)',
      other: 'Autre',
    };
    return labels[rel] || rel;
  };

  const getStatusBadge = (dependent: DependentFormData) => {
    const age = calculateAge(dependent.dateOfBirth);

    // SPOUSE: Always requires document (marriage certificate)
    if (dependent.relationship === 'spouse') {
      if (dependent.documentType) {
        return (
          <Badge variant="default" className="bg-green-500">
            <CheckCircle className="w-3 h-3 mr-1" />
            Document fourni
          </Badge>
        );
      }
      return (
        <Badge variant="secondary">
          <AlertCircle className="w-3 h-3 mr-1" />
          Acte de mariage requis
        </Badge>
      );
    }

    // CHILD: Age-based verification
    if (dependent.relationship === 'child') {
      if (age < 21) {
        return (
          <Badge variant="default" className="bg-green-500">
            <CheckCircle className="w-3 h-3 mr-1" />
            Auto-vérifié (- de 21 ans)
          </Badge>
        );
      }

      if (dependent.documentType) {
        return (
          <Badge variant="default" className="bg-green-500">
            <CheckCircle className="w-3 h-3 mr-1" />
            Document fourni
          </Badge>
        );
      }

      return (
        <Badge variant="secondary">
          <AlertCircle className="w-3 h-3 mr-1" />
          Document requis (≥ 21 ans)
        </Badge>
      );
    }

    // OTHER: Requires document
    if (dependent.documentType) {
      return (
        <Badge variant="default" className="bg-green-500">
          <CheckCircle className="w-3 h-3 mr-1" />
          Document fourni
        </Badge>
      );
    }

    return (
      <Badge variant="secondary">
        <AlertCircle className="w-3 h-3 mr-1" />
        Document requis
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Ajoutez les personnes à charge de l'employé (conjoint, enfants). Ces informations sont utilisées pour calculer les parts fiscales et les déductions familiales.
          <br />
          <strong>Cette étape est optionnelle</strong> - vous pouvez l'ignorer et ajouter les personnes à charge plus tard.
        </AlertDescription>
      </Alert>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          <h3 className="font-semibold text-lg">
            Personnes à charge {dependents.length > 0 && `(${dependents.length})`}
          </h3>
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
              isSubmitting={false}
              employeeId={null}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Dependents List */}
      {dependents.length > 0 ? (
        <div className="grid gap-3">
          {dependents.map((dependent) => {
            const age = calculateAge(dependent.dateOfBirth);
            return (
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
                          {format(new Date(dependent.dateOfBirth), 'PPP', { locale: fr })}
                          {' '}({age} ans)
                        </div>
                        <div>
                          <span className="font-medium">Relation:</span>{' '}
                          {getRelationshipLabel(dependent.relationship)}
                        </div>

                        {dependent.gender && (
                          <div>
                            <span className="font-medium">Genre:</span>{' '}
                            {dependent.gender === 'male' ? 'Homme' : 'Femme'}
                          </div>
                        )}

                        {dependent.cnpsNumber && (
                          <div>
                            <span className="font-medium">N° CNPS:</span>{' '}
                            {dependent.cnpsNumber}
                          </div>
                        )}

                        {dependent.cmuNumber && (
                          <div>
                            <span className="font-medium">N° CMU:</span>{' '}
                            {dependent.cmuNumber}
                          </div>
                        )}

                        {dependent.coveredByOtherEmployer && (
                          <div className="col-span-2">
                            <span className="font-medium">Couverture:</span>{' '}
                            Couvert par un autre employeur
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(dependent)}
                      >
                        Modifier
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(dependent.id!)}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="border-dashed">
          <CardContent className="pt-6">
            <div className="text-center text-muted-foreground py-6">
              <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Aucune personne à charge ajoutée</p>
              <p className="text-sm mt-1">
                Cliquez sur "Ajouter" pour ajouter une personne à charge
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
