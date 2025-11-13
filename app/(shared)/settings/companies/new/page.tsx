/**
 * Create New Company/Tenant Page
 *
 * HCI Principles Applied:
 * - Pattern 1: Zero Learning Curve (simple 2-field form)
 * - Pattern 3: Error Prevention (validation before submission)
 * - Pattern 4: Cognitive Load Minimization (only essential fields)
 * - Pattern 5: Immediate Feedback (loading states, success/error messages)
 * - Pattern 6: Country-Aware Smart Defaults (defaults to CI)
 *
 * Allows tenant_admin or super_admin to:
 * - Create a new company/tenant
 * - Automatically switch to the new tenant
 * - Continue to onboarding (Q1/Q2) to complete setup
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api } from '@/trpc/react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowLeft, Building2, Globe, Loader2, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

// Form validation schema
const createTenantSchema = z.object({
  name: z.string().min(2, 'Le nom doit contenir au moins 2 caractères'),
  countryCode: z.string().length(2, 'Sélectionnez un pays'),
});

type CreateTenantFormData = z.infer<typeof createTenantSchema>;

// Country options for West Africa
const COUNTRY_OPTIONS = [
  { code: 'CI', flag: '🇨🇮', name: 'Côte d\'Ivoire', currency: 'XOF', available: true },
  { code: 'SN', flag: '🇸🇳', name: 'Sénégal', currency: 'XOF', available: false },
  { code: 'BF', flag: '🇧🇫', name: 'Burkina Faso', currency: 'XOF', available: false },
  { code: 'ML', flag: '🇲🇱', name: 'Mali', currency: 'XOF', available: false },
  { code: 'TG', flag: '🇹🇬', name: 'Togo', currency: 'XOF', available: false },
  { code: 'BJ', flag: '🇧🇯', name: 'Bénin', currency: 'XOF', available: false },
  { code: 'NE', flag: '🇳🇪', name: 'Niger', currency: 'XOF', available: false },
  { code: 'GW', flag: '🇬🇼', name: 'Guinée-Bissau', currency: 'XOF', available: false },
];

export default function CreateNewCompanyPage() {
  const router = useRouter();
  const [isSuccess, setIsSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CreateTenantFormData>({
    resolver: zodResolver(createTenantSchema),
    defaultValues: {
      name: '',
      countryCode: 'CI', // Default to Côte d'Ivoire
    },
  });

  const selectedCountryCode = watch('countryCode');
  const selectedCountry = COUNTRY_OPTIONS.find((c) => c.code === selectedCountryCode);

  // Create tenant mutation
  const createTenantMutation = api.tenant.createTenant.useMutation({
    onSuccess: (result) => {
      setIsSuccess(true);
      toast.success(result.message || 'Entreprise créée avec succès');

      // Wait 1.5 seconds to show success state, then do full page reload to refresh session
      // This ensures the new tenant context is loaded (similar to tenant switcher behavior)
      setTimeout(() => {
        window.location.href = '/onboarding/q1';
      }, 1500);
    },
    onError: (error) => {
      toast.error(error.message || 'Impossible de créer l\'entreprise');
    },
  });

  const onSubmit = async (data: CreateTenantFormData) => {
    await createTenantMutation.mutateAsync({
      name: data.name,
      countryCode: data.countryCode,
    });
  };

  return (
    <div className="container mx-auto max-w-2xl py-8 px-4">
      {/* Header */}
      <div className="mb-8">
        <Link href="/settings">
          <Button variant="ghost" className="mb-4 min-h-[44px]">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Retour aux paramètres
          </Button>
        </Link>
        <h1 className="text-3xl font-bold">Créer une nouvelle entreprise</h1>
        <p className="text-muted-foreground mt-2">
          Ajoutez une nouvelle entreprise à gérer dans Preem HR
        </p>
      </div>

      {/* Success State */}
      {isSuccess && (
        <Alert className="mb-6 bg-green-50 border-green-200">
          <CheckCircle2 className="h-5 w-5 text-green-600" />
          <AlertDescription className="text-green-800">
            <span className="font-medium">Entreprise créée avec succès!</span>
            <br />
            <span className="text-sm">Redirection vers la configuration...</span>
          </AlertDescription>
        </Alert>
      )}

      {/* Main Form Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Informations de base
          </CardTitle>
          <CardDescription>
            Renseignez le nom et le pays de la nouvelle entreprise. Vous pourrez compléter
            les détails dans l'étape suivante.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* Company Name Field */}
            <div className="space-y-2">
              <label htmlFor="name" className="text-sm font-medium">
                Nom de l'entreprise <span className="text-destructive">*</span>
              </label>
              <Input
                id="name"
                {...register('name')}
                placeholder="Ex: Ma Nouvelle Entreprise SARL"
                className="min-h-[48px]"
                disabled={isSubmitting || isSuccess}
                autoFocus
              />
              {errors.name && (
                <p className="text-sm text-destructive">{errors.name.message}</p>
              )}
              <p className="text-xs text-muted-foreground">
                Le nom officiel ou commercial de votre entreprise
              </p>
            </div>

            {/* Country Selection */}
            <div className="space-y-2">
              <label htmlFor="countryCode" className="text-sm font-medium">
                Pays <span className="text-destructive">*</span>
              </label>
              <Select
                value={selectedCountryCode}
                onValueChange={(value) => setValue('countryCode', value)}
                disabled={isSubmitting || isSuccess}
              >
                <SelectTrigger className="min-h-[48px]">
                  <SelectValue placeholder="Sélectionnez un pays" />
                </SelectTrigger>
                <SelectContent>
                  {COUNTRY_OPTIONS.map((country) => (
                    <SelectItem
                      key={country.code}
                      value={country.code}
                      disabled={!country.available}
                      className="min-h-[56px] py-3"
                    >
                      <div className="flex flex-col gap-1">
                        <span className="font-medium">
                          {country.flag} {country.name}
                        </span>
                        {!country.available && (
                          <span className="text-xs text-muted-foreground">
                            Bientôt disponible
                          </span>
                        )}
                        {country.available && (
                          <span className="text-xs text-muted-foreground">
                            Devise: {country.currency}
                          </span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.countryCode && (
                <p className="text-sm text-destructive">{errors.countryCode.message}</p>
              )}
              <p className="text-xs text-muted-foreground">
                Détermine les règles de paie (CNPS/IPRES, ITS/IRPP, SMIG, etc.)
              </p>
            </div>

            {/* Country Info Preview */}
            {selectedCountry && (
              <div className="rounded-lg border p-4 bg-muted/50">
                <div className="flex items-start gap-3">
                  <Globe className="h-5 w-5 text-primary mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium mb-2">
                      Configuration pour {selectedCountry.name}
                    </p>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>• Devise: {selectedCountry.currency}</li>
                      {selectedCountry.code === 'CI' && (
                        <>
                          <li>• Sécurité sociale: CNPS (6.3%)</li>
                          <li>• Impôt sur salaires: ITS</li>
                          <li>• SMIG: 75,000 FCFA</li>
                        </>
                      )}
                      {selectedCountry.code === 'SN' && (
                        <>
                          <li>• Sécurité sociale: IPRES</li>
                          <li>• Impôt: IRPP</li>
                        </>
                      )}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* Information Alert */}
            <Alert>
              <AlertDescription className="text-sm">
                <strong>Prochaine étape:</strong> Après la création, vous serez redirigé
                vers la configuration complète où vous pourrez ajouter les détails de
                l'entreprise (secteur, sites, employés, etc.).
              </AlertDescription>
            </Alert>

            {/* Action Buttons */}
            <div className="flex gap-4 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
                disabled={isSubmitting || isSuccess}
                className="min-h-[48px]"
              >
                Annuler
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting || isSuccess}
                className="min-h-[48px] flex-1"
              >
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isSuccess && <CheckCircle2 className="mr-2 h-4 w-4" />}
                {isSubmitting
                  ? 'Création en cours...'
                  : isSuccess
                  ? 'Créée avec succès!'
                  : 'Créer et continuer la configuration'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Additional Info */}
      <div className="mt-6 text-sm text-muted-foreground text-center">
        <p>
          Vous pourrez basculer entre vos entreprises à tout moment via le sélecteur
          d'entreprise.
        </p>
      </div>
    </div>
  );
}
