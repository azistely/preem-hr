/**
 * Onboarding Q1: Country + Company Info + Locations
 *
 * Multi-step wizard approach:
 * - Step 1: Company info (country, name, sector)
 * - Step 2: Locations/Sites (physical work locations only, no payroll data)
 */

'use client';

import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api } from '@/trpc/react';
import { OnboardingQuestion } from '@/features/onboarding/components/onboarding-question';
import { FormField } from '@/features/onboarding/components/form-field';
import { Button } from '@/components/ui/button';
import { Wizard, WizardStep } from '@/components/wizard/wizard';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Plus, X, MapPin, Building2, HardHat, Users } from 'lucide-react';
import { toast } from 'sonner';
import { useState, useEffect } from 'react';

// Location schema
const locationSchema = z.object({
  locationType: z.enum(['headquarters', 'branch', 'construction_site', 'client_site']),
  city: z.string().min(1, 'La ville est requise'),
});

// Company setup schema with locations
const companySetupSchema = z.object({
  // Company info
  countryCode: z.string().min(2, 'Sélectionnez un pays'),
  legalName: z.string().min(2, 'Le nom doit contenir au moins 2 caractères'),
  industry: z.string().min(2, 'Le type d\'activité est requis'),
  cgeciSectorCode: z.string().min(1, 'Sélectionnez votre secteur d\'activité'),
  taxId: z.string().optional(),
  // Locations (at least one required)
  locations: z.array(locationSchema).min(1, 'Ajoutez au moins un site/emplacement'),
});

type CompanySetupFormData = z.infer<typeof companySetupSchema>;
type LocationFormData = z.infer<typeof locationSchema>;

const LOCATION_TYPE_LABELS: Record<string, { label: string; icon: any; description: string }> = {
  headquarters: {
    label: 'Siège social',
    icon: Building2,
    description: 'Bureau principal de l\'entreprise',
  },
  branch: {
    label: 'Succursale / Agence',
    icon: MapPin,
    description: 'Bureau secondaire, point de vente',
  },
  construction_site: {
    label: 'Chantier',
    icon: HardHat,
    description: 'Site de construction temporaire',
  },
  client_site: {
    label: 'Site client',
    icon: Users,
    description: 'Travail chez le client',
  },
};

export default function OnboardingQ1Page() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);

  // Get user info for pre-filling
  const { data: user } = api.auth.me.useQuery();

  // Load existing locations
  const { data: existingLocations } = api.locations.list.useQuery();

  // Mutations
  const setCompanyInfoMutation = api.onboarding.setCompanyInfoV2.useMutation();
  const createLocationMutation = api.locations.create.useMutation();

  const { register, handleSubmit, watch, setValue, formState: { errors }, trigger } = useForm<CompanySetupFormData>({
    resolver: zodResolver(companySetupSchema),
    defaultValues: {
      countryCode: 'CI', // Default to Côte d'Ivoire
      legalName: user?.companyName || '',
      cgeciSectorCode: '',
      locations: [],
    },
  });

  // Populate form with existing locations when they load
  useEffect(() => {
    if (existingLocations && existingLocations.length > 0) {
      const formattedLocations = existingLocations
        .filter(loc => loc.city) // Filter out null cities
        .map(loc => ({
          locationType: loc.locationType as LocationFormData['locationType'],
          city: loc.city as string, // Safe cast after filter
        }));
      setValue('locations', formattedLocations, { shouldValidate: false });
    }
  }, [existingLocations, setValue]);

  const locations = watch('locations') || [];

  const onSubmit = async (data: CompanySetupFormData) => {
    try {
      // Step 1: Save company info
      await setCompanyInfoMutation.mutateAsync({
        countryCode: data.countryCode,
        legalName: data.legalName,
        industry: data.industry,
        cgeciSectorCode: data.cgeciSectorCode,
        taxId: data.taxId,
      });

      // Step 2: Create NEW locations only (skip existing ones)
      // Build set of existing location codes for quick lookup
      const existingLocationCodes = new Set(
        (existingLocations || []).map(loc => loc.locationCode)
      );

      let createdCount = 0;
      let skippedCount = 0;

      for (let i = 0; i < data.locations.length; i++) {
        const location = data.locations[i];
        const typeInfo = LOCATION_TYPE_LABELS[location.locationType];

        // Auto-generate code: TYPE_CITY (e.g., HQ_ABIDJAN)
        const cityCode = location.city.toUpperCase().replace(/\s+/g, '_');
        const typePrefix = location.locationType === 'headquarters' ? 'HQ' :
                           location.locationType === 'branch' ? 'BR' :
                           location.locationType === 'construction_site' ? 'CH' : 'SC';
        const autoCode = `${typePrefix}_${cityCode}`;

        // Skip if location already exists
        if (existingLocationCodes.has(autoCode)) {
          skippedCount++;
          continue;
        }

        // Auto-generate name: Type - City (e.g., "Siège social - Abidjan")
        const autoName = `${typeInfo.label} - ${location.city}`;

        await createLocationMutation.mutateAsync({
          locationCode: autoCode,
          locationName: autoName,
          locationType: location.locationType,
          city: location.city,
          countryCode: data.countryCode,
        });
        createdCount++;
      }

      // Show appropriate message
      if (createdCount > 0 && skippedCount > 0) {
        toast.success(`Configuration enregistrée: ${createdCount} nouveau(x) site(s) créé(s), ${skippedCount} existant(s)`);
      } else if (createdCount > 0) {
        toast.success(`Configuration enregistrée: ${createdCount} site(s) créé(s)`);
      } else {
        toast.success('Configuration enregistrée (sites déjà existants)');
      }

      // Navigate to success page (skip Q2/employee setup)
      router.push('/onboarding/success');
    } catch (error: any) {
      toast.error(error.message || 'Impossible d\'enregistrer les informations');
    }
  };

  const addLocation = () => {
    const newLocation: LocationFormData = {
      locationType: 'headquarters',
      city: '',
    };
    setValue('locations', [...locations, newLocation], { shouldValidate: true });
  };

  const removeLocation = (index: number) => {
    setValue('locations', locations.filter((_, i) => i !== index), { shouldValidate: true });
  };

  const updateLocation = (index: number, field: keyof LocationFormData, value: any) => {
    const updated = locations.map((loc, i) =>
      i === index ? { ...loc, [field]: value } : loc
    );
    setValue('locations', updated, { shouldValidate: true });
  };

  const wizardSteps: WizardStep[] = [
    // STEP 1: Company Info
    {
      title: 'Informations de l\'entreprise',
      description: 'Votre pays et secteur d\'activité',
      validate: async () => {
        return await trigger(['countryCode', 'legalName', 'industry', 'cgeciSectorCode']);
      },
      content: (
        <div className="space-y-4">
          {/* Country Selection */}
          <FormField
            label="Pays"
            type="select"
            {...register('countryCode')}
            error={errors.countryCode?.message}
            required
            helperText="Détermine CNPS/IPRES, ITS/IRPP, SMIG"
          >
            <option value="CI">🇨🇮 Côte d'Ivoire (CNPS 6.3%, ITS, SMIG 75,000)</option>
            <option value="SN" disabled>🇸🇳 Sénégal (Bientôt disponible)</option>
            <option value="BF" disabled>🇧🇫 Burkina Faso (Bientôt disponible)</option>
            <option value="ML" disabled>🇲🇱 Mali (Bientôt disponible)</option>
          </FormField>

          {/* Company Name */}
          <FormField
            label="Nom de l'entreprise"
            {...register('legalName')}
            error={errors.legalName?.message}
            required
            placeholder="Ex: Ma Boutique"
          />

          {/* CGECI Sector Selection */}
          <FormField
            label="Secteur d'activité (CGECI)"
            type="select"
            {...register('cgeciSectorCode')}
            error={errors.cgeciSectorCode?.message}
            required
            helperText="Votre secteur détermine les catégories d'employés et salaires minimums"
          >
            <option value="">-- Sélectionnez votre secteur --</option>
            <optgroup label="Services Financiers">
              <option value="BANQUES">🏦 Banques</option>
              <option value="ASSURANCES">🛡️ Assurances</option>
            </optgroup>
            <optgroup label="Commerce & Hôtellerie">
              <option value="COMMERCE">🏪 Commerce, Distribution</option>
              <option value="IND_HOTEL">🏨 Hôtellerie</option>
              <option value="IND_TOURISME">✈️ Tourisme</option>
            </optgroup>
            <optgroup label="Construction">
              <option value="BTP">🏗️ BTP (Bâtiment, Travaux Publics)</option>
            </optgroup>
            <optgroup label="Industrie">
              <option value="IND_MECANIQUE">⚙️ Industrie Mécanique, Extractive, Alimentaire, Chimique</option>
              <option value="IND_TEXTILE">👕 Industrie Textile</option>
              <option value="IND_BOIS">🌳 Industrie du Bois</option>
              <option value="IND_SUCRE">🍬 Industrie Sucrière</option>
              <option value="IND_THON">🐟 Industrie du Thon</option>
              <option value="IND_IMPRIMERIE">🖨️ Imprimerie</option>
              <option value="IND_POLYGRAPHIQUE">📚 Industrie Polygraphique (Arts Graphiques)</option>
            </optgroup>
            <optgroup label="Transport & Logistique">
              <option value="AUX_TRANSPORT">🚛 Transport, Logistique</option>
              <option value="PETROLE_DISTRIB">⛽ Distribution de Pétrole</option>
            </optgroup>
            <optgroup label="Services">
              <option value="NETTOYAGE">✨ Nettoyage</option>
              <option value="SECURITE">🛡️ Sécurité, Gardiennage</option>
              <option value="GENS_MAISON">🏠 Gens de Maison</option>
            </optgroup>
          </FormField>

          {/* Industry Detail */}
          <FormField
            label="Type d'activité précis"
            {...register('industry')}
            error={errors.industry?.message}
            placeholder="Ex: Vente de vêtements, Restaurant, Coiffure"
            required
            helperText="Description détaillée de votre activité"
          />

          {/* Tax ID (Optional) */}
          <FormField
            label="Numéro fiscal (optionnel)"
            {...register('taxId')}
            error={errors.taxId?.message}
            placeholder="Ex: CI-123456789"
          />
        </div>
      ),
    },

    // STEP 2: Locations
    {
      title: 'Sites / Emplacements',
      description: 'Ajoutez vos bureaux, boutiques, chantiers',
      validate: async () => {
        return await trigger(['locations']);
      },
      content: (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Enregistrez tous les sites où vos employés travaillent (bureaux, boutiques, chantiers).
          </p>

          {/* Locations List */}
          {locations.length > 0 && (
            <div className="space-y-3">
              {locations.map((location, index) => {
                const typeInfo = LOCATION_TYPE_LABELS[location.locationType] || LOCATION_TYPE_LABELS.headquarters;
                const Icon = typeInfo.icon;

                return (
                  <Card key={index} className="relative">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <Icon className="h-5 w-5 text-primary" />
                          <div>
                            <CardTitle className="text-base">
                              {location.city ? `${typeInfo.label} - ${location.city}` : `Site ${index + 1}`}
                            </CardTitle>
                            <CardDescription className="text-xs">
                              {location.city || 'Sélectionnez une ville'}
                            </CardDescription>
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeLocation(index)}
                          className="h-8 w-8 p-0"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-sm font-medium">Type *</label>
                          <select
                            value={location.locationType}
                            onChange={(e) => updateLocation(index, 'locationType', e.target.value as any)}
                            className="w-full mt-1 px-3 py-2 border rounded-md"
                          >
                            {Object.entries(LOCATION_TYPE_LABELS).map(([key, value]) => (
                              <option key={key} value={key}>
                                {value.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="text-sm font-medium">Ville *</label>
                          <input
                            type="text"
                            value={location.city || ''}
                            onChange={(e) => updateLocation(index, 'city', e.target.value)}
                            placeholder="Ex: Abidjan, Bouaké"
                            className="w-full mt-1 px-3 py-2 border rounded-md"
                          />
                          <p className="text-xs text-muted-foreground mt-1">
                            Détermine les indemnités légales
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {/* Add Location Button */}
          <Button
            type="button"
            variant="outline"
            onClick={addLocation}
            className="w-full"
          >
            <Plus className="mr-2 h-4 w-4" />
            Ajouter un site
          </Button>

          {/* Validation Error */}
          {errors.locations && (
            <p className="text-sm text-destructive">{errors.locations.message}</p>
          )}

          {/* Helper Text */}
          {locations.length === 0 && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-900 font-medium">
                💡 Pourquoi ajouter des sites ?
              </p>
              <ul className="text-sm text-blue-800 mt-2 space-y-1 list-disc list-inside">
                <li>Organisez vos employés par emplacement géographique</li>
                <li>Chaque employé sera affecté à un site principal</li>
                <li>La ville du site détermine les indemnités légales (transport, etc.)</li>
              </ul>
            </div>
          )}
        </div>
      ),
    },
  ];

  return (
    <OnboardingQuestion
      title="Configurez votre entreprise"
      subtitle="Informations de base et emplacements de travail"
      progress={{ current: 1, total: 1 }}
    >
      <Wizard
        steps={wizardSteps}
        currentStep={currentStep}
        onStepChange={setCurrentStep}
        onComplete={handleSubmit(onSubmit)}
        isSubmitting={setCompanyInfoMutation.isPending || createLocationMutation.isPending}
      />
    </OnboardingQuestion>
  );
}
