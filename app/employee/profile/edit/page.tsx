/**
 * Employee Profile Edit Page (P1-1)
 *
 * Self-service profile editing for employees
 * Following HCI principles:
 * - Zero learning curve (clear form fields)
 * - Smart defaults (pre-filled with current data)
 * - Error prevention (validation on submit)
 * - Immediate feedback (success/error toasts)
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useCurrentEmployee } from '@/hooks/use-current-employee';
import { trpc } from '@/lib/trpc/client';
import { Loader2, Save, X, Phone, MapPin, Building, CreditCard } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

// Validation schema (matching backend)
const profileEditSchema = z.object({
  phone: z.string().optional(),
  addressLine1: z.string().optional(),
  addressLine2: z.string().optional(),
  city: z.string().optional(),
  postalCode: z.string().optional(),
  bankName: z.string().optional(),
  bankAccount: z.string().optional(),
});

type ProfileEditForm = z.infer<typeof profileEditSchema>;

export default function EmployeeProfileEditPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { employee, isLoading: employeeLoading } = useCurrentEmployee();
  const [isSaving, setIsSaving] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<ProfileEditForm>({
    resolver: zodResolver(profileEditSchema),
    defaultValues: {
      phone: employee?.phone || '',
      addressLine1: employee?.addressLine1 || '',
      addressLine2: employee?.addressLine2 || '',
      city: employee?.city || '',
      postalCode: employee?.postalCode || '',
      bankName: employee?.bankName || '',
      bankAccount: employee?.bankAccount || '',
    },
  });

  const updateProfileMutation = trpc.employees.updateOwnProfile.useMutation({
    onSuccess: () => {
      toast({
        title: 'Profil mis à jour',
        description: 'Vos informations ont été enregistrées avec succès.',
        variant: 'default',
      });
      router.push('/employee/profile');
    },
    onError: (error) => {
      toast({
        title: 'Erreur',
        description: error.message || 'Impossible de mettre à jour votre profil.',
        variant: 'destructive',
      });
      setIsSaving(false);
    },
  });

  const onSubmit = async (data: ProfileEditForm) => {
    setIsSaving(true);
    updateProfileMutation.mutate(data);
  };

  const handleCancel = () => {
    router.push('/employee/profile');
  };

  if (employeeLoading) {
    return (
      <div className="container mx-auto max-w-3xl py-8 px-4">
        <Card>
          <CardContent className="py-12">
            <div className="flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <span className="ml-3 text-muted-foreground">Chargement du profil...</span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="container mx-auto max-w-3xl py-8 px-4">
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <p className="text-lg font-semibold">Profil introuvable</p>
              <p className="text-sm text-muted-foreground mt-2">
                Aucun profil employé associé à votre compte
              </p>
              <Button onClick={() => router.push('/employee')} className="mt-4">
                Retour
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-3xl py-8 px-4">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Modifier mon profil</h1>
        <p className="text-muted-foreground mt-2">
          Mettez à jour vos informations personnelles et bancaires
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Contact Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Phone className="h-5 w-5" />
              Informations de contact
            </CardTitle>
            <CardDescription>
              Votre numéro de téléphone pour être contacté
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <Label htmlFor="phone">Téléphone</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="+225 XX XX XX XX XX"
                  className="min-h-[48px]"
                  {...register('phone')}
                />
                {errors.phone && (
                  <p className="text-sm text-destructive mt-1">{errors.phone.message}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Address Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Adresse
            </CardTitle>
            <CardDescription>
              Votre adresse de résidence
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <Label htmlFor="addressLine1">Adresse ligne 1</Label>
                <Input
                  id="addressLine1"
                  placeholder="Rue, numéro, quartier"
                  className="min-h-[48px]"
                  {...register('addressLine1')}
                />
                {errors.addressLine1 && (
                  <p className="text-sm text-destructive mt-1">{errors.addressLine1.message}</p>
                )}
              </div>

              <div>
                <Label htmlFor="addressLine2">Adresse ligne 2 (optionnel)</Label>
                <Input
                  id="addressLine2"
                  placeholder="Complément d'adresse"
                  className="min-h-[48px]"
                  {...register('addressLine2')}
                />
                {errors.addressLine2 && (
                  <p className="text-sm text-destructive mt-1">{errors.addressLine2.message}</p>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="city">Ville</Label>
                  <Input
                    id="city"
                    placeholder="Abidjan"
                    className="min-h-[48px]"
                    {...register('city')}
                  />
                  {errors.city && (
                    <p className="text-sm text-destructive mt-1">{errors.city.message}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="postalCode">Code postal</Label>
                  <Input
                    id="postalCode"
                    placeholder="01 BP 1234"
                    className="min-h-[48px]"
                    {...register('postalCode')}
                  />
                  {errors.postalCode && (
                    <p className="text-sm text-destructive mt-1">{errors.postalCode.message}</p>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Banking Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Informations bancaires
            </CardTitle>
            <CardDescription>
              Votre compte bancaire pour le versement de votre salaire
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <Label htmlFor="bankName">Nom de la banque</Label>
                <Input
                  id="bankName"
                  placeholder="Ecobank, SGCI, UBA..."
                  className="min-h-[48px]"
                  {...register('bankName')}
                />
                {errors.bankName && (
                  <p className="text-sm text-destructive mt-1">{errors.bankName.message}</p>
                )}
              </div>

              <div>
                <Label htmlFor="bankAccount">Numéro de compte</Label>
                <Input
                  id="bankAccount"
                  placeholder="CI0123456789012345678901"
                  className="min-h-[48px] font-mono"
                  {...register('bankAccount')}
                />
                {errors.bankAccount && (
                  <p className="text-sm text-destructive mt-1">{errors.bankAccount.message}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex items-center gap-4">
          <Button
            type="submit"
            disabled={isSaving}
            className="min-h-[56px] min-w-[140px] text-lg"
          >
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Enregistrement...
              </>
            ) : (
              <>
                <Save className="mr-2 h-5 w-5" />
                Enregistrer
              </>
            )}
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={handleCancel}
            disabled={isSaving}
            className="min-h-[56px] min-w-[140px] text-lg"
          >
            <X className="mr-2 h-5 w-5" />
            Annuler
          </Button>
        </div>
      </form>
    </div>
  );
}
