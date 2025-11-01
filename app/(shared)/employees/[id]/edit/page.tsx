/**
 * Employee Edit Page
 *
 * Mobile-first dedicated page for editing employee information.
 * Replaces modal approach with full-screen page for better UX on mobile devices.
 *
 * Features:
 * - Full-screen design (no modal constraints)
 * - Browser back button support
 * - Sticky header with context
 * - Tab-based progressive disclosure
 * - All 47 database fields covered
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  MapPin,
  ArrowLeft,
  Save,
  X,
} from 'lucide-react';
import { useUpdateEmployee } from '@/features/employees/hooks/use-employees';
import { useToast } from '@/hooks/use-toast';
import { CoefficientSelector } from '@/components/employees/coefficient-selector';
import { ContractInfoCard } from '@/components/contracts/contract-info-card';
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

  // Employment Fields (Contract managed separately via employment_contracts table)
  hireDate: z.date().optional(),
  paymentFrequency: z.enum(['DAILY', 'WEEKLY', 'BIWEEKLY', 'MONTHLY']).optional(),
  weeklyHoursRegime: z.enum(['40h', '44h', '48h', '52h', '56h']).optional(),

  // Family (Tab 3)
  maritalStatus: z.enum(['single', 'married', 'divorced', 'widowed']).optional(),
  // dependentChildren is auto-calculated from employee_dependents table - not editable

  // Documents (Tab 4)
  dateOfBirth: z.date().optional(),
  gender: z.enum(['male', 'female', 'other', 'prefer_not_to_say']).optional(),
  identityDocumentType: z.enum(['cni', 'passport', 'residence_permit', 'other']).optional(),
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

  // Personnel Record Fields (NEW - for Registre du Personnel compliance)
  nationalityZone: z.enum(['LOCAL', 'CEDEAO', 'HORS_CEDEAO']).optional(),
  employeeType: z.enum(['LOCAL', 'EXPAT', 'DETACHE', 'STAGIAIRE']).optional(),
  fatherName: z.string().optional(),
  motherName: z.string().optional(),
  placeOfBirth: z.string().optional(),
  emergencyContactName: z.string().optional(),
});

type EditEmployeeFormValues = z.infer<typeof editEmployeeSchema>;

interface EmployeeEditPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default function EmployeeEditPage({ params }: EmployeeEditPageProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('essential');
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Next.js 15: Unwrap async params
  const resolvedParams = React.use(params);
  const employeeId = resolvedParams.id;

  // Fetch employee data
  const { data: employee, isLoading: isLoadingEmployee } = trpc.employees.getById.useQuery({
    id: employeeId,
  });

  // Fetch locations
  const { data: locations } = trpc.locations.list.useQuery({});

  // Fetch managers
  const { data: employeesData } = trpc.employees.list.useQuery({
    status: 'active',
  });
  const allEmployees = employeesData?.employees || [];

  // Fetch categories (filtered by employee's CGECI sector to avoid duplicates)
  const { data: categories } = trpc.employeeCategories.getAllCategories.useQuery({
    countryCode: 'CI',
    sectorCode: (employee as any)?.sectorCodeCgeci || undefined,
  }, {
    enabled: !!employee, // Only fetch after employee data is loaded
  });

  // Fetch dependents for fiscal parts display
  const { data: dependentsStats } = trpc.dependents.getStats.useQuery({
    employeeId,
  });

  const updateEmployee = useUpdateEmployee();

  const form = useForm<EditEmployeeFormValues>({
    resolver: zodResolver(editEmployeeSchema),
    defaultValues: {
      id: employeeId,
      firstName: '',
      lastName: '',
      preferredName: '',
      email: '',
      phone: '',
      addressLine1: '',
      addressLine2: '',
      city: '',
      postalCode: '',
      primaryLocationId: '',
      reportingManagerId: '',
      categoryCode: '',
      coefficient: undefined,
      rateType: 'MONTHLY',
      dailyRate: undefined,
      hourlyRate: undefined,
      sector: '',
      sectorCodeCgeci: '',
      conventionCode: '',
      professionalLevel: undefined,
      hireDate: undefined,
      paymentFrequency: 'MONTHLY',
      weeklyHoursRegime: '40h',
      maritalStatus: 'single',
      dateOfBirth: undefined,
      gender: undefined,
      identityDocumentType: undefined,
      nationalId: '',
      nationalIdExpiry: undefined,
      workPermitExpiry: undefined,
      bankName: '',
      bankAccount: '',
      cnpsNumber: '',
      taxNumber: '',
      taxDependents: 0,
      isExpat: false,
      nationalityZone: undefined,
      employeeType: undefined,
      fatherName: '',
      motherName: '',
      placeOfBirth: '',
      emergencyContactName: '',
    },
  });

  // Load employee data into form
  useEffect(() => {
    if (employee) {
      const emp = employee as any; // Type cast for compatibility with service return type
      form.reset({
        id: emp.id,
        firstName: emp.firstName || '',
        lastName: emp.lastName || '',
        preferredName: emp.preferredName || '',
        email: emp.email || '',
        phone: emp.phone || '',
        addressLine1: emp.addressLine1 || '',
        addressLine2: emp.addressLine2 || '',
        city: emp.city || '',
        postalCode: emp.postalCode || '',
        primaryLocationId: emp.primaryLocationId || '',
        reportingManagerId: emp.reportingManagerId || '',
        categoryCode: emp.categoryCode || '',
        coefficient: emp.coefficient || undefined,
        rateType: (emp.rateType as 'MONTHLY' | 'DAILY' | 'HOURLY') || 'MONTHLY',
        dailyRate: emp.dailyRate || undefined,
        hourlyRate: emp.hourlyRate || undefined,
        sector: emp.sector || '',
        sectorCodeCgeci: emp.sectorCodeCgeci || '',
        conventionCode: emp.conventionCode || '',
        professionalLevel: emp.professionalLevel || undefined,
        hireDate: emp.hireDate ? new Date(emp.hireDate) : undefined,
        paymentFrequency: (emp.paymentFrequency as 'DAILY' | 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY') || 'MONTHLY',
        weeklyHoursRegime: (emp.weeklyHoursRegime as '40h' | '44h' | '48h' | '52h' | '56h') || '40h',
        maritalStatus: (emp.maritalStatus as 'single' | 'married' | 'divorced' | 'widowed') || 'single',
        // dependentChildren is auto-calculated - not included in form
        dateOfBirth: emp.dateOfBirth ? new Date(emp.dateOfBirth) : undefined,
        gender: emp.gender as 'male' | 'female' | 'other' | 'prefer_not_to_say' | undefined,
        identityDocumentType: emp.identityDocumentType as 'cni' | 'passport' | 'residence_permit' | 'other' | undefined,
        nationalId: emp.nationalId || '',
        nationalIdExpiry: emp.nationalIdExpiry ? new Date(emp.nationalIdExpiry) : undefined,
        workPermitExpiry: emp.workPermitExpiry ? new Date(emp.workPermitExpiry) : undefined,
        bankName: emp.bankName || '',
        bankAccount: emp.bankAccount || '',
        cnpsNumber: emp.cnpsNumber || '',
        taxNumber: emp.taxNumber || '',
        taxDependents: emp.taxDependents || 0,
        isExpat: emp.isExpat ?? false,
        nationalityZone: emp.nationalityZone as 'LOCAL' | 'CEDEAO' | 'HORS_CEDEAO' | undefined,
        employeeType: emp.employeeType as 'LOCAL' | 'EXPAT' | 'DETACHE' | 'STAGIAIRE' | undefined,
        fatherName: emp.fatherName || '',
        motherName: emp.motherName || '',
        placeOfBirth: emp.placeOfBirth || '',
        emergencyContactName: emp.emergencyContactName || '',
      });
    }
  }, [employee, form]);

  const onSubmit = async (data: EditEmployeeFormValues) => {
    try {
      // Debug: Log what we're sending
      console.log('📤 Submitting employee update:', data);
      console.log('📊 Fields being updated:', Object.keys(data));

      // tRPC expects Date objects, not ISO strings
      await updateEmployee.mutateAsync({
        ...data,
        // Keep dates as Date objects for tRPC validation
        dateOfBirth: data.dateOfBirth,
        nationalIdExpiry: data.nationalIdExpiry,
        workPermitExpiry: data.workPermitExpiry,
        isExpat: data.isExpat,
        identityDocumentType: data.identityDocumentType,
      } as any);

      toast({
        title: 'Modifications enregistrées',
        description: 'Les informations de l\'employé ont été mises à jour avec succès.',
      });

      router.push(`/employees/${employeeId}`);
    } catch (error: any) {
      toast({
        title: 'Erreur',
        description: error.message || 'Impossible de mettre à jour l\'employé',
        variant: 'destructive',
      });
    }
  };

  const handleCancel = () => {
    router.push(`/employees/${employeeId}`);
  };

  // Derive rate type from contract type (CDDTI = HOURLY, others = form value)
  const contractType = (employee as any)?.contract?.contractType;
  const rateType = contractType === 'CDDTI' ? 'HOURLY' : form.watch('rateType');
  const categoryCode = form.watch('categoryCode');

  if (isLoadingEmployee) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="container mx-auto py-8">
        <Alert variant="destructive">
          <AlertDescription>Employé non trouvé</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Sticky Header */}
      <div className="sticky top-0 z-50 bg-background border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCancel}
              className="min-h-[44px]"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Retour
            </Button>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleCancel}
                disabled={updateEmployee.isPending}
                className="min-h-[44px]"
              >
                <X className="h-4 w-4 mr-2" />
                Annuler
              </Button>
              <Button
                onClick={form.handleSubmit(onSubmit)}
                disabled={updateEmployee.isPending}
                className="min-h-[44px]"
              >
                {updateEmployee.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Enregistrer
              </Button>
            </div>
          </div>

          {/* Employee Info Card */}
          <Card>
            <CardContent className="py-3">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h1 className="text-lg font-semibold">
                    {(employee as any).firstName} {(employee as any).lastName}
                  </h1>
                  <p className="text-sm text-muted-foreground">
                    {(employee as any).email || (employee as any).phone}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-6">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-5 mb-6">
                <TabsTrigger value="essential" className="min-h-[44px] flex-col gap-1">
                  <User className="h-4 w-4" />
                  <span className="text-xs">Essentiel</span>
                </TabsTrigger>
                <TabsTrigger value="employment" className="min-h-[44px] flex-col gap-1">
                  <Briefcase className="h-4 w-4" />
                  <span className="text-xs">Emploi</span>
                </TabsTrigger>
                <TabsTrigger value="family" className="min-h-[44px] flex-col gap-1">
                  <UsersIcon className="h-4 w-4" />
                  <span className="text-xs">Famille</span>
                </TabsTrigger>
                <TabsTrigger value="documents" className="min-h-[44px] flex-col gap-1">
                  <FileText className="h-4 w-4" />
                  <span className="text-xs">Documents</span>
                </TabsTrigger>
                <TabsTrigger value="banking" className="min-h-[44px] flex-col gap-1">
                  <CreditCard className="h-4 w-4" />
                  <span className="text-xs">Banque</span>
                </TabsTrigger>
              </TabsList>

              {/* Tab 1: Essential Info */}
              <TabsContent value="essential" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <User className="h-5 w-5" />
                      Informations essentielles
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="firstName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Prénom *</FormLabel>
                            <FormControl>
                              <Input {...field} className="min-h-[48px]" />
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
                              <Input {...field} className="min-h-[48px]" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="preferredName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nom préféré (optionnel)</FormLabel>
                          <FormControl>
                            <Input {...field} className="min-h-[48px]" />
                          </FormControl>
                          <FormDescription>
                            Le nom que l'employé préfère utiliser
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Email</FormLabel>
                            <FormControl>
                              <Input type="email" {...field} className="min-h-[48px]" />
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
                              <Input type="tel" {...field} className="min-h-[48px]" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
                      <CollapsibleTrigger asChild>
                        <Button
                          variant="ghost"
                          className="w-full justify-between min-h-[44px]"
                          type="button"
                        >
                          <span className="flex items-center gap-2">
                            <MapPin className="h-4 w-4" />
                            Adresse (optionnel)
                          </span>
                          <ChevronDown className={`h-4 w-4 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
                        </Button>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="space-y-4 mt-4">
                        <FormField
                          control={form.control}
                          name="addressLine1"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Adresse ligne 1</FormLabel>
                              <FormControl>
                                <Input {...field} className="min-h-[48px]" />
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
                                <Input {...field} className="min-h-[48px]" />
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
                                  <Input {...field} className="min-h-[48px]" />
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
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Tab 2: Employment */}
              <TabsContent value="employment" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Briefcase className="h-5 w-5" />
                      Informations d'emploi
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <FormField
                      control={form.control}
                      name="primaryLocationId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Lieu de travail</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            value={field.value || ''}
                          >
                            <FormControl>
                              <SelectTrigger className="min-h-[48px]">
                                <SelectValue placeholder="Sélectionner un lieu" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {locations?.map((loc: any) => (
                                <SelectItem key={loc.id} value={loc.id}>
                                  {loc.locationName || loc.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormDescription>
                            Détermine l'indemnité de transport minimum
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="reportingManagerId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Manager</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            value={field.value || ''}
                          >
                            <FormControl>
                              <SelectTrigger className="min-h-[48px]">
                                <SelectValue placeholder="Sélectionner un manager" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {allEmployees
                                .filter((e: any) => e.id !== employeeId)
                                .map((emp: any) => (
                                  <SelectItem key={emp.id} value={emp.id}>
                                    {emp.firstName} {emp.lastName}
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                          <FormDescription>
                            Hiérarchie organisationnelle
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Coefficient determines category automatically */}
                    <FormField
                      control={form.control}
                      name="coefficient"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Catégorie professionnelle</FormLabel>
                          <FormControl>
                            <CoefficientSelector
                              countryCode="CI"
                              value={field.value}
                              onChange={field.onChange}
                              onCategoryChange={(categoryCode) => {
                                // Auto-update hidden categoryCode field
                                form.setValue('categoryCode', categoryCode);
                              }}
                              className="min-h-[48px]"
                              hideLabel={true}
                            />
                          </FormControl>
                          <FormDescription>
                            Sélectionnez la catégorie, le coefficient sera défini automatiquement
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Rate Type - Auto-determined by contract type for CDDTI */}
                    {contractType !== 'CDDTI' && (
                      <FormField
                        control={form.control}
                        name="rateType"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Type de rémunération</FormLabel>
                            <Select
                              onValueChange={field.onChange}
                              value={field.value}
                            >
                              <FormControl>
                                <SelectTrigger className="min-h-[48px]">
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="MONTHLY">Mensuel</SelectItem>
                                <SelectItem value="DAILY">Journalier</SelectItem>
                                <SelectItem value="HOURLY">Horaire</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormDescription>
                              {contractType === 'CDI' || contractType === 'CDD' ?
                                'Généralement mensuel pour les CDI/CDD' :
                                'Type de calcul du salaire'}
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}

                    {/* Info for CDDTI - Rate type is fixed to HOURLY */}
                    {contractType === 'CDDTI' && (
                      <Alert>
                        <Info className="h-4 w-4" />
                        <AlertDescription>
                          <strong>Type de rémunération :</strong> Horaire (déterminé automatiquement par le type de contrat CDDTI - travailleurs journaliers)
                        </AlertDescription>
                      </Alert>
                    )}

                    {rateType === 'DAILY' && (
                      <FormField
                        control={form.control}
                        name="dailyRate"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Taux journalier</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                {...field}
                                onChange={(e) => field.onChange(e.target.valueAsNumber)}
                                className="min-h-[48px]"
                              />
                            </FormControl>
                            <FormDescription>
                              Salaire par jour travaillé (FCFA)
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
                            <FormLabel>Taux horaire</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                {...field}
                                onChange={(e) => field.onChange(e.target.valueAsNumber)}
                                className="min-h-[48px]"
                              />
                            </FormControl>
                            <FormDescription>
                              Salaire par heure travaillée (FCFA)
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}

                    {/* Contract Information - Now managed separately */}
                    <ContractInfoCard
                      employeeId={employeeId}
                      contract={(employee as any)?.contract || null}
                    />

                    {/* Hire Date - Still editable here */}
                    <FormField
                      control={form.control}
                      name="hireDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Date d'embauche</FormLabel>
                          <FormControl>
                            <Input
                              type="date"
                              value={field.value ? format(field.value, 'yyyy-MM-dd') : ''}
                              onChange={(e) => field.onChange(e.target.value ? new Date(e.target.value) : undefined)}
                              className="min-h-[48px]"
                            />
                          </FormControl>
                          <FormDescription>
                            Date d'entrée dans l'entreprise
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Payment Frequency (CDDTI specific) */}
                    <FormField
                      control={form.control}
                      name="paymentFrequency"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Fréquence de paiement</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            value={field.value || 'MONTHLY'}
                          >
                            <FormControl>
                              <SelectTrigger className="min-h-[48px]">
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="MONTHLY">Mensuel</SelectItem>
                              <SelectItem value="BIWEEKLY">Quinzaine</SelectItem>
                              <SelectItem value="WEEKLY">Hebdomadaire</SelectItem>
                              <SelectItem value="DAILY">Journalier</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormDescription>
                            Détermine le cycle de paie (CDDTI uniquement)
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Weekly Hours Regime (for CDDTI) */}
                    {form.watch('paymentFrequency') !== 'MONTHLY' && (
                      <FormField
                        control={form.control}
                        name="weeklyHoursRegime"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Régime horaire hebdomadaire</FormLabel>
                            <Select
                              onValueChange={field.onChange}
                              value={field.value || '40h'}
                            >
                              <FormControl>
                                <SelectTrigger className="min-h-[48px]">
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="40h">40 heures/semaine</SelectItem>
                                <SelectItem value="44h">44 heures/semaine</SelectItem>
                                <SelectItem value="48h">48 heures/semaine</SelectItem>
                                <SelectItem value="52h">52 heures/semaine</SelectItem>
                                <SelectItem value="56h">56 heures/semaine</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormDescription>
                              Définit le seuil des heures supplémentaires
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}

                    <Collapsible>
                      <CollapsibleTrigger asChild>
                        <Button
                          variant="ghost"
                          className="w-full justify-between min-h-[44px]"
                          type="button"
                        >
                          <span className="flex items-center gap-2">
                            <Info className="h-4 w-4" />
                            Informations avancées (optionnel)
                          </span>
                          <ChevronDown className="h-4 w-4" />
                        </Button>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="space-y-4 mt-4">
                        <FormField
                          control={form.control}
                          name="sector"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Secteur d'activité</FormLabel>
                              <FormControl>
                                <Input {...field} className="min-h-[48px]" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="sectorCodeCgeci"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Code secteur CGECI</FormLabel>
                              <FormControl>
                                <Input {...field} className="min-h-[48px]" />
                              </FormControl>
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
                              <FormLabel>Niveau professionnel</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  {...field}
                                  onChange={(e) => field.onChange(e.target.valueAsNumber)}
                                  className="min-h-[48px]"
                                />
                              </FormControl>
                              <FormDescription>
                                Entre 1 et 10
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </CollapsibleContent>
                    </Collapsible>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Tab 3: Family */}
              <TabsContent value="family" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <UsersIcon className="h-5 w-5" />
                      Situation familiale
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Alert>
                      <Info className="h-4 w-4" />
                      <AlertDescription>
                        La situation familiale influence le calcul de l'ITS (impôt sur les traitements et salaires) et de la CMU.
                        Pour ajouter les personnes à charge, utilisez l'onglet "Personnes à charge" de la fiche employé.
                      </AlertDescription>
                    </Alert>

                    <FormField
                      control={form.control}
                      name="maritalStatus"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Statut marital</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            value={field.value}
                          >
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
                          <FormDescription>
                            Influence le calcul des parts fiscales
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Dependent Children - Read-only, auto-calculated */}
                    {dependentsStats && (
                      <Alert>
                        <Info className="h-4 w-4" />
                        <AlertDescription>
                          <div className="space-y-2">
                            <p className="font-semibold">Personnes à charge (calculé automatiquement):</p>
                            <div className="grid grid-cols-2 gap-2 text-sm">
                              <div>
                                <Badge variant="outline">{dependentsStats.totalDependents}</Badge> Total
                              </div>
                              <div>
                                <Badge variant="outline">{dependentsStats.verifiedDependents}</Badge> Vérifiées
                              </div>
                              <div>
                                <Badge variant="outline">{dependentsStats.fiscalPartsDependents}</Badge> Parts fiscales
                              </div>
                              <div>
                                <Badge variant="outline">{dependentsStats.cmuDependents}</Badge> CMU
                              </div>
                            </div>
                            <p className="text-xs text-muted-foreground mt-2">
                              Le nombre de personnes à charge est calculé automatiquement à partir des enregistrements ci-dessous.
                            </p>
                            <Link
                              href={`/employees/${employeeId}#dependents`}
                              className="text-primary hover:underline text-sm inline-flex items-center gap-1"
                            >
                              → Gérer les personnes à charge
                            </Link>
                          </div>
                        </AlertDescription>
                      </Alert>
                    )}

                    <div className="p-4 bg-muted rounded-lg">
                      <p className="text-sm font-semibold mb-2">Parts fiscales calculées</p>
                      <p className="text-3xl font-bold text-primary">
                        {(employee as any).fiscalParts || '1.0'}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Calculées automatiquement selon le statut marital et les personnes à charge vérifiées
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Tab 4: Documents */}
              <TabsContent value="documents" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="h-5 w-5" />
                      Documents et identité
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
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
                                value={field.value ? format(field.value, 'yyyy-MM-dd') : ''}
                                onChange={(e) => field.onChange(e.target.value ? new Date(e.target.value) : undefined)}
                                className="min-h-[48px]"
                              />
                            </FormControl>
                            <FormDescription>
                              Pour calcul de l'âge et planification retraite
                            </FormDescription>
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
                            <Select
                              onValueChange={field.onChange}
                              value={field.value || ''}
                            >
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

                    <div className="space-y-4 pt-4 border-t">
                      <h4 className="text-sm font-medium">Pièce d'identité</h4>

                      <FormField
                        control={form.control}
                        name="identityDocumentType"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Type de document</FormLabel>
                            <Select
                              onValueChange={field.onChange}
                              value={field.value || ''}
                            >
                              <FormControl>
                                <SelectTrigger className="min-h-[48px]">
                                  <SelectValue placeholder="Sélectionner le type de document" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="cni">CNI (Carte Nationale d'Identité)</SelectItem>
                                <SelectItem value="passport">Passeport</SelectItem>
                                <SelectItem value="residence_permit">Titre de séjour</SelectItem>
                                <SelectItem value="other">Autre</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormDescription>
                              Type de pièce d'identité utilisée
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="nationalId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Numéro du document</FormLabel>
                            <FormControl>
                              <Input {...field} className="min-h-[48px]" placeholder="Ex: CI-ABJ-123456" />
                            </FormControl>
                            <FormDescription>
                              Numéro de la pièce d'identité
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="nationalIdExpiry"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Date d'expiration CNI</FormLabel>
                          <FormControl>
                            <Input
                              type="date"
                              value={field.value ? format(field.value, 'yyyy-MM-dd') : ''}
                              onChange={(e) => field.onChange(e.target.value ? new Date(e.target.value) : undefined)}
                              className="min-h-[48px]"
                            />
                          </FormControl>
                          <FormDescription>
                            Alerte 30 jours avant expiration
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="workPermitExpiry"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Date d'expiration du permis de travail</FormLabel>
                          <FormControl>
                            <Input
                              type="date"
                              value={field.value ? format(field.value, 'yyyy-MM-dd') : ''}
                              onChange={(e) => field.onChange(e.target.value ? new Date(e.target.value) : undefined)}
                              className="min-h-[48px]"
                            />
                          </FormControl>
                          <FormDescription>
                            Pour les employés étrangers uniquement
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="space-y-4 pt-4 border-t">
                      <h4 className="text-sm font-medium">Statut d'expatrié</h4>
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

                    <div className="space-y-4 pt-4 border-t">
                      <h4 className="text-sm font-medium">Registre du Personnel</h4>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="nationalityZone"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Zone de nationalité</FormLabel>
                              <Select
                                onValueChange={field.onChange}
                                value={field.value || ''}
                              >
                                <FormControl>
                                  <SelectTrigger className="min-h-[48px]">
                                    <SelectValue placeholder="Sélectionner" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="LOCAL">Local</SelectItem>
                                  <SelectItem value="CEDEAO">CEDEAO</SelectItem>
                                  <SelectItem value="HORS_CEDEAO">Hors CEDEAO</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormDescription>
                                Pour le registre du personnel
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="employeeType"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Type d'employé</FormLabel>
                              <Select
                                onValueChange={field.onChange}
                                value={field.value || ''}
                              >
                                <FormControl>
                                  <SelectTrigger className="min-h-[48px]">
                                    <SelectValue placeholder="Sélectionner" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="LOCAL">Local</SelectItem>
                                  <SelectItem value="EXPAT">Expatrié</SelectItem>
                                  <SelectItem value="DETACHE">Détaché</SelectItem>
                                  <SelectItem value="STAGIAIRE">Stagiaire</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormDescription>
                                Statut d'emploi (registre du personnel)
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <FormField
                        control={form.control}
                        name="placeOfBirth"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Lieu de naissance</FormLabel>
                            <FormControl>
                              <Input {...field} className="min-h-[48px]" placeholder="Ville, Pays" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="fatherName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Nom du père</FormLabel>
                              <FormControl>
                                <Input {...field} className="min-h-[48px]" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="motherName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Nom de la mère</FormLabel>
                              <FormControl>
                                <Input {...field} className="min-h-[48px]" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <FormField
                        control={form.control}
                        name="emergencyContactName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Contact d'urgence</FormLabel>
                            <FormControl>
                              <Input {...field} className="min-h-[48px]" placeholder="Nom et téléphone" />
                            </FormControl>
                            <FormDescription>
                              Personne à contacter en cas d'urgence
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Tab 5: Banking & Tax */}
              <TabsContent value="banking" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <CreditCard className="h-5 w-5" />
                      Banque et informations fiscales
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="bankName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Nom de la banque</FormLabel>
                            <FormControl>
                              <Input {...field} className="min-h-[48px]" />
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
                              <Input {...field} className="min-h-[48px]" />
                            </FormControl>
                            <FormDescription>
                              Pour le virement du salaire
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="cnpsNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Numéro CNPS</FormLabel>
                          <FormControl>
                            <Input {...field} className="min-h-[48px]" />
                          </FormControl>
                          <FormDescription>
                            Caisse Nationale de Prévoyance Sociale
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
                          <FormLabel>Numéro fiscal</FormLabel>
                          <FormControl>
                            <Input {...field} className="min-h-[48px]" />
                          </FormControl>
                          <FormDescription>
                            Compte contribuable (DGI)
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="taxDependents"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Personnes à charge fiscales (déclarées)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              {...field}
                              onChange={(e) => field.onChange(e.target.valueAsNumber)}
                              className="min-h-[48px]"
                            />
                          </FormControl>
                          <FormDescription>
                            Nombre déclaré à la DGI (peut différer de la réalité)
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </form>
        </Form>
      </div>

      {/* Bottom Action Bar (Mobile) */}
      <div className="fixed bottom-0 left-0 right-0 bg-background border-t p-4 md:hidden">
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={updateEmployee.isPending}
            className="flex-1 min-h-[48px]"
          >
            Annuler
          </Button>
          <Button
            onClick={form.handleSubmit(onSubmit)}
            disabled={updateEmployee.isPending}
            className="flex-1 min-h-[48px]"
          >
            {updateEmployee.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              'Enregistrer'
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
