/**
 * Onboarding: Company Information
 *
 * Optional step to collect basic company details during onboarding.
 * Users can skip and complete this later in settings.
 *
 * Design: Simplified form with only essential fields.
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Building2, ArrowRight } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { OnboardingQuestion } from '@/features/onboarding/components/onboarding-question';
import { toast } from 'sonner';
import { api } from '@/server/api/client';
import {
  CompanyGeneralInfoSchema,
  type CompanyGeneralInfo,
} from '@/lib/db/schema/tenant-settings.schema';

export default function OnboardingCompanyInfoPage() {
  const router = useRouter();
  const utils = api.useUtils();

  // Update mutation
  const updateMutation = api.tenant.updateCompanyInfo.useMutation({
    onSuccess: () => {
      toast.success('Informations enregistrées');
      utils.tenant.getCurrent.invalidate();
      router.push('/onboarding/success');
    },
    onError: (error) => {
      toast.error(error.message || 'Erreur lors de la sauvegarde');
    },
  });

  // Form setup
  const form = useForm<CompanyGeneralInfo>({
    resolver: zodResolver(CompanyGeneralInfoSchema),
    defaultValues: {
      legalName: '',
      tradeName: '',
      address: '',
      phone: '',
      email: '',
    },
  });

  // Handle submit
  const onSubmit = (data: CompanyGeneralInfo) => {
    updateMutation.mutate({
      generalInfo: data,
    });
  };

  // Handle skip
  const handleSkip = () => {
    router.push('/onboarding/success');
  };

  return (
    <OnboardingQuestion
      title="Informations de votre entreprise"
      subtitle="Quelques détails pour personnaliser votre expérience (optionnel)"
      progress={{ current: 3, total: 3 }}
    >
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Building2 className="h-6 w-6 text-primary" />
            </div>
            <div>
              <CardTitle>Coordonnées de l'entreprise</CardTitle>
              <CardDescription>
                Ces informations apparaîtront sur vos documents
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Legal Name */}
              <FormField
                control={form.control}
                name="legalName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Raison Sociale</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        value={field.value || ''}
                        placeholder="Ex: Preem Technologies SARL"
                        className="min-h-[48px]"
                      />
                    </FormControl>
                    <FormDescription>
                      Nom légal de votre entreprise
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Address */}
              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Adresse</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        value={field.value || ''}
                        placeholder="Ex: 01 BP 1234 Abidjan 01"
                        className="min-h-[96px] resize-none"
                      />
                    </FormControl>
                    <FormDescription>
                      Adresse du siège social
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Phone */}
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Téléphone</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        value={field.value || ''}
                        type="tel"
                        placeholder="Ex: +225 27 20 12 34 56"
                        className="min-h-[48px]"
                      />
                    </FormControl>
                    <FormDescription>
                      Numéro de téléphone principal
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Email */}
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        value={field.value || ''}
                        type="email"
                        placeholder="Ex: contact@preem.com"
                        className="min-h-[48px]"
                      />
                    </FormControl>
                    <FormDescription>
                      Email de contact
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-3 pt-4">
                <Button
                  type="submit"
                  disabled={updateMutation.isPending}
                  className="min-h-[56px] flex-1 sm:flex-initial sm:min-w-[200px]"
                >
                  {updateMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Enregistrement...
                    </>
                  ) : (
                    <>
                      Enregistrer et Continuer
                      <ArrowRight className="ml-2 h-5 w-5" />
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleSkip}
                  disabled={updateMutation.isPending}
                  className="min-h-[56px]"
                >
                  Passer cette étape
                </Button>
              </div>

              <p className="text-sm text-muted-foreground text-center">
                Vous pourrez compléter ces informations plus tard dans
                <br />
                <strong>Paramètres → Entreprise</strong>
              </p>
            </form>
          </Form>
        </CardContent>
      </Card>
    </OnboardingQuestion>
  );
}
