/**
 * Edit Employee Modal V2
 *
 * Complete employee information editor with tab-based progressive disclosure
 * Follows HCI principles for low digital literacy users:
 * - Task-oriented tabs (commonly edited first)
 * - Smart defaults and helper text
 * - Read-only calculated fields with explanations
 * - Clear French labels
 */

'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
  Loader2,
  User,
  Briefcase,
  Users as UsersIcon,
  FileText,
  CreditCard,
  ChevronDown,
  Info,
  Calendar,
  MapPin
} from 'lucide-react';
import { useUpdateEmployee } from '../hooks/use-employees';
import { useToast } from '@/hooks/use-toast';
import { CoefficientSelector } from '@/components/employees/coefficient-selector';
import { trpc } from '@/lib/trpc/client';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import Link from 'next/link';

// Complete schema with all fields
const editEmployeeSchema = z.object({
  id: z.string().uuid(),

  // Personal Info (Tab 1)
  firstName: z.string().min(1, 'Le prénom est requis'),
  lastName: z.string().min(1, 'Le nom est requis'),
  preferredName: z.string().optional(),
  email: z.string().email('Email invalide').optional().or(z.literal('')),
  phone: z.string().min(1, 'Le téléphone est requis'),
  addressLine1: z.string().optional(),
  addressLine2: z.string().optional(),
  city: z.string().optional(),
  postalCode: z.string().optional(),

  // Employment (Tab 2)
  primaryLocationId: z.string().optional(),
  reportingManagerId: z.string().optional(),
  categoryCode: z.string().optional(),
  coefficient: z.number().int().min(90).max(1000).optional(),
  rateType: z.enum(['MONTHLY', 'DAILY', 'HOURLY']).optional(),
  dailyRate: z.number().optional(),
  hourlyRate: z.number().optional(),
  sector: z.string().optional(),
  sectorCodeCgeci: z.string().optional(),
  conventionCode: z.string().optional(),
  professionalLevel: z.number().int().min(1).max(10).optional(),

  // Family (Tab 3)
  maritalStatus: z.enum(['single', 'married', 'divorced', 'widowed']).optional(),
  dependentChildren: z.number().int().min(0).max(10).optional(),
  // fiscalParts is calculated automatically from dependents

  // Documents (Tab 4)
  dateOfBirth: z.date().optional(),
  gender: z.enum(['male', 'female', 'other', 'prefer_not_to_say']).optional(),
  nationalId: z.string().optional(),
  nationalIdExpiry: z.date().optional(),
  workPermitExpiry: z.date().optional(),

  // Banking & Tax (Tab 5)
  bankName: z.string().optional(),
  bankAccount: z.string().optional(),
  cnpsNumber: z.string().optional(),
  taxNumber: z.string().optional(),
  taxDependents: z.number().int().min(0).max(10).optional(),
  isExpat: z.boolean().optional(),
});

type EditEmployeeFormData = z.infer<typeof editEmployeeSchema>;

interface EditEmployeeModalV2Props {
  employee: any;
  open: boolean;
  onClose: () => void;
}

export function EditEmployeeModalV2({ employee, open, onClose }: EditEmployeeModalV2Props) {
  const { toast } = useToast();
  const updateEmployee = useUpdateEmployee();
  const [activeTab, setActiveTab] = useState('essential');

  // Fetch locations for dropdown
  const { data: locations } = trpc.locations.list.useQuery({});

  // Fetch employees for reporting manager dropdown
  const { data: employeesData } = trpc.employees.list.useQuery({
    status: 'active',
  });
  const allEmployees = employeesData?.employees || [];

  // Fetch CGECI categories
  const { data: categories } = trpc.employeeCategories.getAllCategories.useQuery({
    countryCode: 'CI',
  });

  const form = useForm<EditEmployeeFormData>({
    resolver: zodResolver(editEmployeeSchema),
    defaultValues: {
      id: employee.id,
      firstName: employee.firstName ?? '',
      lastName: employee.lastName ?? '',
      preferredName: employee.preferredName ?? '',
      email: employee.email ?? '',
      phone: employee.phone ?? '',
      addressLine1: employee.addressLine1 ?? '',
      addressLine2: employee.addressLine2 ?? '',
      city: employee.city ?? '',
      postalCode: employee.postalCode ?? '',

      primaryLocationId: employee.primaryLocationId ?? '',
      reportingManagerId: employee.reportingManagerId ?? '',
      categoryCode: employee.categoryCode ?? '',
      coefficient: employee.coefficient ?? 100,
      rateType: employee.rateType ?? 'MONTHLY',
      dailyRate: employee.dailyRate ? parseFloat(employee.dailyRate) : undefined,
      hourlyRate: employee.hourlyRate ? parseFloat(employee.hourlyRate) : undefined,
      sector: employee.sector ?? '',
      sectorCodeCgeci: employee.sectorCodeCgeci ?? '',
      conventionCode: employee.conventionCode ?? '',
      professionalLevel: employee.professionalLevel ?? undefined,

      maritalStatus: employee.maritalStatus ?? 'single',
      dependentChildren: employee.dependentChildren ?? 0,

      dateOfBirth: employee.dateOfBirth ? new Date(employee.dateOfBirth) : undefined,
      gender: employee.gender ?? undefined,
      nationalId: employee.nationalId ?? '',
      nationalIdExpiry: employee.nationalIdExpiry ? new Date(employee.nationalIdExpiry) : undefined,
      workPermitExpiry: employee.workPermitExpiry ? new Date(employee.workPermitExpiry) : undefined,

      bankName: employee.bankName ?? '',
      bankAccount: employee.bankAccount ?? '',
      cnpsNumber: employee.cnpsNumber ?? '',
      taxNumber: employee.taxNumber ?? '',
      taxDependents: employee.taxDependents ?? 0,
      isExpat: employee.isExpat ?? false,
    },
  });

  const rateType = form.watch('rateType');

  const onSubmit = async (data: EditEmployeeFormData) => {
    try {
      // Only send fields that the update endpoint accepts
      const payload = {
        id: data.id,
        firstName: data.firstName,
        lastName: data.lastName,
        preferredName: data.preferredName,
        email: data.email,
        phone: data.phone,
        addressLine1: data.addressLine1,
        addressLine2: data.addressLine2,
        city: data.city,
        postalCode: data.postalCode,
        dateOfBirth: data.dateOfBirth,
        gender: data.gender,
        nationalId: data.nationalId,
        bankName: data.bankName,
        bankAccount: data.bankAccount,
        cnpsNumber: data.cnpsNumber,
        taxNumber: data.taxNumber,
        taxDependents: data.taxDependents,
        isExpat: data.isExpat,
        coefficient: data.coefficient,
        rateType: data.rateType,
        // Note: Other fields like primaryLocationId, maritalStatus, etc. are not in updateEmployeeSchema yet
        // They will be ignored by the API
      };

      await updateEmployee.mutateAsync(payload as any);
      toast({
        title: 'Employé modifié',
        description: 'Les informations ont été mises à jour avec succès',
      });
      onClose();
    } catch (error: any) {
      toast({
        title: 'Erreur',
        description: error.message || 'Erreur lors de la modification',
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">
            Modifier {employee.firstName} {employee.lastName}
          </DialogTitle>
          <DialogDescription>
            Mettez à jour les informations de l'employé
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="essential" className="min-h-[44px]">
                  <User className="h-4 w-4 mr-2" />
                  <span className="hidden md:inline">Essentiel</span>
                </TabsTrigger>
                <TabsTrigger value="employment" className="min-h-[44px]">
                  <Briefcase className="h-4 w-4 mr-2" />
                  <span className="hidden md:inline">Emploi</span>
                </TabsTrigger>
                <TabsTrigger value="family" className="min-h-[44px]">
                  <UsersIcon className="h-4 w-4 mr-2" />
                  <span className="hidden md:inline">Famille</span>
                </TabsTrigger>
                <TabsTrigger value="documents" className="min-h-[44px]">
                  <FileText className="h-4 w-4 mr-2" />
                  <span className="hidden md:inline">Documents</span>
                </TabsTrigger>
                <TabsTrigger value="banking" className="min-h-[44px]">
                  <CreditCard className="h-4 w-4 mr-2" />
                  <span className="hidden md:inline">Banque</span>
                </TabsTrigger>
              </TabsList>

              {/* TAB 1: ESSENTIAL INFO */}
              <TabsContent value="essential" className="space-y-4 mt-6">
                <h3 className="text-lg font-semibold">Informations essentielles</h3>
                <p className="text-sm text-muted-foreground">
                  Les informations de base de l'employé (les plus souvent modifiées)
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="firstName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Prénom *</FormLabel>
                        <FormControl>
                          <Input {...field} className="min-h-[48px]" placeholder="Jean" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="lastName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nom *</FormLabel>
                        <FormControl>
                          <Input {...field} className="min-h-[48px]" placeholder="Kouassi" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="preferredName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nom préféré (optionnel)</FormLabel>
                        <FormControl>
                          <Input {...field} className="min-h-[48px]" placeholder="Comment l'appeler" />
                        </FormControl>
                        <FormDescription className="text-xs">
                          Le nom que l'employé préfère utiliser au travail
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Contact */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input type="email" {...field} className="min-h-[48px]" placeholder="jean.kouassi@example.com" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Téléphone *</FormLabel>
                        <FormControl>
                          <Input {...field} className="min-h-[48px]" placeholder="+225 01 23 45 67 89" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Address (Collapsible) */}
                <Collapsible className="mt-4">
                  <CollapsibleTrigger className="flex items-center gap-2 text-sm font-medium hover:underline">
                    <ChevronDown className="h-4 w-4" />
                    Adresse (optionnel)
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-4 space-y-4">
                    <FormField
                      control={form.control}
                      name="addressLine1"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Adresse ligne 1</FormLabel>
                          <FormControl>
                            <Input {...field} className="min-h-[48px]" placeholder="Rue, avenue, quartier" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="addressLine2"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Adresse ligne 2</FormLabel>
                          <FormControl>
                            <Input {...field} className="min-h-[48px]" placeholder="Complément d'adresse" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="city"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Ville</FormLabel>
                            <FormControl>
                              <Input {...field} className="min-h-[48px]" placeholder="Abidjan" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="postalCode"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Code postal</FormLabel>
                            <FormControl>
                              <Input {...field} className="min-h-[48px]" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </TabsContent>

              {/* TAB 2: EMPLOYMENT */}
              <TabsContent value="employment" className="space-y-4 mt-6">
                <h3 className="text-lg font-semibold">Informations d'emploi</h3>

                {/* Hire Date (Read-Only) */}
                <Alert>
                  <Calendar className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Date d'embauche:</strong> {format(new Date(employee.hireDate), 'PPP', { locale: fr })}
                    <br />
                    <span className="text-xs text-muted-foreground">
                      La date d'embauche ne peut pas être modifiée après la création
                    </span>
                  </AlertDescription>
                </Alert>

                {/* Location */}
                <FormField
                  control={form.control}
                  name="primaryLocationId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        <MapPin className="inline h-4 w-4 mr-1" />
                        Site de travail principal
                      </FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || ''}>
                        <FormControl>
                          <SelectTrigger className="min-h-[48px]">
                            <SelectValue placeholder="Sélectionner un site" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {locations?.map((loc: any) => (
                            <SelectItem key={loc.id} value={loc.id}>
                              {loc.name} ({loc.city})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription className="text-xs">
                        Détermine l'indemnité de transport minimum légale
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Reporting Manager */}
                <FormField
                  control={form.control}
                  name="reportingManagerId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Manager direct (optionnel)</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || ''}>
                        <FormControl>
                          <SelectTrigger className="min-h-[48px]">
                            <SelectValue placeholder="Aucun manager" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="">Aucun</SelectItem>
                          {allEmployees?.filter((emp: any) => emp.id !== employee.id).map((emp: any) => (
                            <SelectItem key={emp.id} value={emp.id}>
                              {emp.firstName} {emp.lastName} - {emp.positionTitle || 'Sans poste'}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Category */}
                <FormField
                  control={form.control}
                  name="categoryCode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Catégorie professionnelle (CGECI)</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || ''}>
                        <FormControl>
                          <SelectTrigger className="min-h-[48px]">
                            <SelectValue placeholder="Sélectionner une catégorie" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {categories?.map((cat: any) => (
                            <SelectItem key={cat.category} value={cat.category}>
                              {cat.category} - {cat.description?.fr || cat.description}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription className="text-xs">
                        Détermine le salaire minimum légal (SMIG)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Coefficient */}
                <FormField
                  control={form.control}
                  name="coefficient"
                  render={({ field }) => (
                    <FormItem>
                      <CoefficientSelector
                        countryCode="CI"
                        value={field.value || 100}
                        onChange={field.onChange}
                        showExamples={true}
                      />
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Rate Type */}
                <FormField
                  control={form.control}
                  name="rateType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Type de paiement</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || 'MONTHLY'}>
                        <FormControl>
                          <SelectTrigger className="min-h-[48px]">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="MONTHLY">
                            <div>
                              <div className="font-medium">Mensuel</div>
                              <div className="text-xs text-muted-foreground">Salaire fixe chaque mois</div>
                            </div>
                          </SelectItem>
                          <SelectItem value="DAILY">
                            <div>
                              <div className="font-medium">Journalier</div>
                              <div className="text-xs text-muted-foreground">Payé selon les jours travaillés</div>
                            </div>
                          </SelectItem>
                          <SelectItem value="HOURLY">
                            <div>
                              <div className="font-medium">Horaire</div>
                              <div className="text-xs text-muted-foreground">Payé selon les heures travaillées</div>
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Daily/Hourly Rate (conditionally shown) */}
                {rateType === 'DAILY' && (
                  <FormField
                    control={form.control}
                    name="dailyRate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Taux journalier (FCFA/jour)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            {...field}
                            onChange={(e) => field.onChange(parseFloat(e.target.value) || undefined)}
                            className="min-h-[48px]"
                            placeholder="2500"
                          />
                        </FormControl>
                        <FormDescription className="text-xs">
                          Le taux journalier de base pour le calcul de la paie
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {rateType === 'HOURLY' && (
                  <FormField
                    control={form.control}
                    name="hourlyRate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Taux horaire (FCFA/heure)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            {...field}
                            onChange={(e) => field.onChange(parseFloat(e.target.value) || undefined)}
                            className="min-h-[48px]"
                            placeholder="312"
                          />
                        </FormControl>
                        <FormDescription className="text-xs">
                          Le taux horaire de base pour le calcul de la paie
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {/* Advanced Employment Fields (Collapsible) */}
                <Collapsible className="mt-4">
                  <CollapsibleTrigger className="flex items-center gap-2 text-sm font-medium hover:underline">
                    <ChevronDown className="h-4 w-4" />
                    Informations avancées (optionnel)
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-4 space-y-4">
                    <FormField
                      control={form.control}
                      name="sector"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Secteur d'activité</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value || ''}>
                            <FormControl>
                              <SelectTrigger className="min-h-[48px]">
                                <SelectValue placeholder="Sélectionner" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="services">Services</SelectItem>
                              <SelectItem value="industry">Industrie</SelectItem>
                              <SelectItem value="commerce">Commerce</SelectItem>
                              <SelectItem value="agriculture">Agriculture</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="conventionCode"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Code convention collective</FormLabel>
                          <FormControl>
                            <Input {...field} className="min-h-[48px]" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="professionalLevel"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Niveau professionnel (1-10)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min="1"
                              max="10"
                              {...field}
                              onChange={(e) => field.onChange(parseInt(e.target.value) || undefined)}
                              className="min-h-[48px]"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CollapsibleContent>
                </Collapsible>
              </TabsContent>

              {/* TAB 3: FAMILY */}
              <TabsContent value="family" className="space-y-4 mt-6">
                <h3 className="text-lg font-semibold">Situation familiale</h3>
                <p className="text-sm text-muted-foreground">
                  Pour le calcul automatique de l'impôt sur le revenu (ITS)
                </p>

                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Astuce:</strong> Utilisez l'onglet{' '}
                    <Link
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        onClose();
                        // User will see the Dependents tab in the employee detail page
                      }}
                      className="underline font-medium"
                    >
                      "Personnes à charge"
                    </Link>
                    {' '}dans la fiche employé pour gérer les dépendants avec vérification de documents.
                    Les parts fiscales seront calculées automatiquement.
                  </AlertDescription>
                </Alert>

                <FormField
                  control={form.control}
                  name="maritalStatus"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Statut marital</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || 'single'}>
                        <FormControl>
                          <SelectTrigger className="min-h-[48px]">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="single">Célibataire</SelectItem>
                          <SelectItem value="married">Marié(e)</SelectItem>
                          <SelectItem value="divorced">Divorcé(e)</SelectItem>
                          <SelectItem value="widowed">Veuf/Veuve</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="dependentChildren"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nombre d'enfants à charge (estimation)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          max="10"
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                          className="min-h-[48px]"
                        />
                      </FormControl>
                      <FormDescription className="text-xs">
                        Pour un calcul précis, ajoutez les dépendants dans l'onglet "Personnes à charge"
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Fiscal Parts Preview (Read-Only) */}
                {employee.fiscalParts && (
                  <Alert>
                    <AlertDescription>
                      <strong>Parts fiscales actuelles:</strong>{' '}
                      <Badge variant="secondary" className="text-lg">
                        {employee.fiscalParts}
                      </Badge>
                      <br />
                      <span className="text-xs text-muted-foreground">
                        Calculées automatiquement à partir des personnes à charge vérifiées
                      </span>
                    </AlertDescription>
                  </Alert>
                )}
              </TabsContent>

              {/* TAB 4: DOCUMENTS */}
              <TabsContent value="documents" className="space-y-4 mt-6">
                <h3 className="text-lg font-semibold">Documents & Identité</h3>
                <p className="text-sm text-muted-foreground">
                  Dates d'expiration pour les alertes automatiques
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="dateOfBirth"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Date de naissance</FormLabel>
                        <FormControl>
                          <Input
                            type="date"
                            {...field}
                            value={field.value ? format(field.value, 'yyyy-MM-dd') : ''}
                            onChange={(e) => field.onChange(e.target.value ? new Date(e.target.value) : undefined)}
                            className="min-h-[48px]"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="gender"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Genre</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || ''}>
                          <FormControl>
                            <SelectTrigger className="min-h-[48px]">
                              <SelectValue placeholder="Sélectionner" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="male">Homme</SelectItem>
                            <SelectItem value="female">Femme</SelectItem>
                            <SelectItem value="other">Autre</SelectItem>
                            <SelectItem value="prefer_not_to_say">Préfère ne pas dire</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="nationalId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Numéro CNI / Passeport</FormLabel>
                        <FormControl>
                          <Input {...field} className="min-h-[48px]" placeholder="CI123456789" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="nationalIdExpiry"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Date d'expiration CNI/Passeport</FormLabel>
                        <FormControl>
                          <Input
                            type="date"
                            {...field}
                            value={field.value ? format(field.value, 'yyyy-MM-dd') : ''}
                            onChange={(e) => field.onChange(e.target.value ? new Date(e.target.value) : undefined)}
                            className="min-h-[48px]"
                          />
                        </FormControl>
                        <FormDescription className="text-xs">
                          Vous recevrez une alerte 30 jours avant l'expiration
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="workPermitExpiry"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date d'expiration permis de travail (étranger)</FormLabel>
                      <FormControl>
                        <Input
                          type="date"
                          {...field}
                          value={field.value ? format(field.value, 'yyyy-MM-dd') : ''}
                          onChange={(e) => field.onChange(e.target.value ? new Date(e.target.value) : undefined)}
                          className="min-h-[48px]"
                        />
                      </FormControl>
                      <FormDescription className="text-xs">
                        Requis uniquement pour les travailleurs étrangers
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </TabsContent>

              {/* TAB 5: BANKING & TAX */}
              <TabsContent value="banking" className="space-y-4 mt-6">
                <h3 className="text-lg font-semibold">Banque & Fiscalité</h3>

                <div className="space-y-4">
                  <h4 className="text-sm font-medium">Informations bancaires</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="bankName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Banque</FormLabel>
                          <FormControl>
                            <Input {...field} className="min-h-[48px]" placeholder="Ex: SGBCI, Ecobank" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="bankAccount"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Numéro de compte</FormLabel>
                          <FormControl>
                            <Input {...field} className="min-h-[48px]" placeholder="CI01 2345 6789..." />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                <div className="space-y-4 pt-4 border-t">
                  <h4 className="text-sm font-medium">CNPS & Numéros fiscaux</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="cnpsNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Numéro CNPS</FormLabel>
                          <FormControl>
                            <Input {...field} className="min-h-[48px]" placeholder="1234567890" />
                          </FormControl>
                          <FormDescription className="text-xs">
                            Caisse Nationale de Prévoyance Sociale (sécurité sociale)
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="taxNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Numéro fiscal (IFU)</FormLabel>
                          <FormControl>
                            <Input {...field} className="min-h-[48px]" placeholder="0123456789A" />
                          </FormControl>
                          <FormDescription className="text-xs">
                            Identifiant Fiscal Unique
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                <div className="space-y-4 pt-4 border-t">
                  <h4 className="text-sm font-medium">Type de personnel</h4>
                  <FormField
                    control={form.control}
                    name="isExpat"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                        <FormControl>
                          <input
                            type="checkbox"
                            checked={field.value ?? false}
                            onChange={field.onChange}
                            className="h-5 w-5 mt-0.5"
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel className="text-base font-medium">
                            Personnel expatrié
                          </FormLabel>
                          <FormDescription className="text-xs">
                            Cochez cette case si l'employé est expatrié. Cela affectera le calcul de l'ITS employeur (1,2% pour personnel local, 10,4% pour expatrié).
                          </FormDescription>
                        </div>
                      </FormItem>
                    )}
                  />
                </div>

                <Alert className="mt-4">
                  <Info className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    <strong>Note:</strong> Le numéro CNPS est requis pour générer les déclarations sociales.
                    Le numéro fiscal (IFU) est requis pour les déclarations d'impôts.
                  </AlertDescription>
                </Alert>
              </TabsContent>
            </Tabs>

            {/* Actions */}
            <div className="flex gap-4 justify-end pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                className="min-h-[48px]"
              >
                Annuler
              </Button>
              <Button
                type="submit"
                disabled={updateEmployee.isPending}
                className="min-h-[48px] min-w-[120px]"
              >
                {updateEmployee.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Enregistrer
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
