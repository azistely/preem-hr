'use client';

/**
 * Unified Contract Form
 *
 * Single interface for creating and editing contracts with WYSIWYG editor.
 * Combines metadata fields (employee, type, dates) with contract content editing.
 *
 * Features:
 * - Essential fields only (employee, type, start date)
 * - Content source selection (blank or copy existing) - NEW contracts only
 * - Integrated WYSIWYG editor
 * - Two save modes: Draft or Generate PDF
 * - Mobile-friendly (375px+)
 * - Touch targets ≥ 44px
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { toast } from 'sonner';
import {
  FileText,
  Save,
  X,
  Check,
  Loader2,
  Copy,
  FileEdit,
  AlertTriangle,
  ExternalLink,
  RefreshCw,
  CloudOff,
  Info,
} from 'lucide-react';
import { addMonths, format } from 'date-fns';

import { api } from '@/trpc/react';
import { useResilientMutation } from '@/hooks/use-resilient-mutation';
import { useFormAutoSave } from '@/hooks/use-form-auto-save';
import { ConnectionStatus } from '@/components/ui/connection-status';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { ContractEditor } from '@/components/contracts/contract-editor';

// Form validation schema
const contractFormSchema = z.object({
  employeeId: z.string().uuid({ message: 'Veuillez sélectionner un employé' }),
  contractType: z.enum(['CDI', 'CDD', 'CDDTI', 'STAGE', 'INTERIM'], {
    required_error: 'Veuillez sélectionner un type de contrat',
  }),
  startDate: z.string().min(1, { message: 'La date de début est requise' }),
  endDate: z.string().optional(),
  contractHtmlContent: z.string(), // Allow empty for drafts
  contentSource: z.enum(['blank', 'copy']).optional(),
  sourceContractId: z.string().uuid().optional(),
})
.refine(
  (data) => {
    // CDD, STAGE, and INTERIM must have end date
    if (['CDD', 'STAGE', 'INTERIM'].includes(data.contractType) && !data.endDate) {
      return false;
    }
    return true;
  },
  {
    message: 'La date de fin est requise pour ce type de contrat',
    path: ['endDate'],
  }
)
.refine(
  (data) => {
    // End date must be after start date
    if (data.endDate && data.startDate && data.endDate <= data.startDate) {
      return false;
    }
    return true;
  },
  {
    message: 'La date de fin doit être postérieure à la date de début',
    path: ['endDate'],
  }
);

type ContractFormValues = z.infer<typeof contractFormSchema>;

interface ContractFormProps {
  mode: 'create' | 'edit';
  contractId?: string;
  initialData?: {
    employeeId: string;
    contractType: 'CDI' | 'CDD' | 'CDDTI' | 'STAGE' | 'INTERIM';
    startDate: string;
    contractHtmlContent?: string;
  };
}

export function ContractForm({ mode, contractId, initialData }: ContractFormProps) {
  const router = useRouter();
  const [employeeSearchOpen, setEmployeeSearchOpen] = useState(false);
  const [editorContent, setEditorContent] = useState(initialData?.contractHtmlContent || '');
  const [getEditorContent, setGetEditorContent] = useState<(() => string) | null>(null);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>(initialData?.employeeId || '');

  // Queries
  const { data: employees, isLoading: employeesLoading } = api.employees.list.useQuery({
    status: 'active',
    limit: 100, // Get more employees for search
  });

  const { data: existingContracts } = api.contracts.getAllContracts.useQuery(
    {
      isActive: true,
      limit: 50,
    },
    { enabled: mode === 'create' } // Only load for create mode
  );

  // Base mutations
  const createContractMutation = api.contracts.createContract.useMutation();
  const updateContractMutation = api.contracts.updateContract.useMutation();
  const generatePdfMutation = api.documents.generateContractDocument.useMutation();

  // Wrap mutations with resilience
  const resilientCreate = useResilientMutation({
    mutation: createContractMutation,
    successMessage: 'Brouillon sauvegardé',
    errorMessage: 'Erreur lors de la sauvegarde du brouillon',
  });

  const resilientUpdate = useResilientMutation({
    mutation: updateContractMutation,
    successMessage: 'Brouillon sauvegardé',
    errorMessage: 'Erreur lors de la sauvegarde du brouillon',
  });

  const resilientGeneratePdf = useResilientMutation({
    mutation: generatePdfMutation,
    successMessage: 'Contrat généré avec succès',
    errorMessage: 'Erreur lors de la génération du PDF',
  });

  // Form (must be before watch calls)
  const form = useForm<ContractFormValues>({
    resolver: zodResolver(contractFormSchema),
    defaultValues: {
      employeeId: initialData?.employeeId || '',
      contractType: initialData?.contractType || 'CDI',
      startDate: initialData?.startDate || new Date().toISOString().split('T')[0],
      endDate: '',
      contractHtmlContent: initialData?.contractHtmlContent || '',
      contentSource: 'blank',
      sourceContractId: '',
    },
  });

  // Watch dates for overlap check
  const startDateForOverlap = form.watch('startDate');
  const endDateForOverlap = form.watch('endDate');

  // Check for contract date overlap when employee + dates are set (create mode only)
  const { data: overlapCheck, isLoading: checkingOverlap } =
    api.contracts.checkContractOverlap.useQuery(
      {
        employeeId: selectedEmployeeId,
        startDate: startDateForOverlap,
        endDate: endDateForOverlap || null,
      },
      {
        enabled: mode === 'create' && !!selectedEmployeeId && !!startDateForOverlap,
      }
    );

  // Determine if form submission should be blocked (only overlapping dates)
  const hasOverlap = mode === 'create' && overlapCheck?.hasOverlap;
  const overlappingContract = overlapCheck?.overlappingContract;
  const precedingContract = overlapCheck?.precedingContract;

  // Auto-save form data to localStorage (only for new contracts)
  const { clearSavedData, hasSavedData } = useFormAutoSave({
    storageKey: mode === 'create' ? 'contract_create' : `contract_edit_${contractId}`,
    form,
    debounceMs: 1500,
    excludeFields: [], // No sensitive fields to exclude
    enabled: true,
    onRestore: (data) => {
      if (Object.keys(data).length > 0) {
        toast.info('Brouillon restauré', {
          description: 'Vos données ont été récupérées automatiquement.',
          icon: <CloudOff className="h-4 w-4" />,
        });
        // Restore editor content if present
        if (data.contractHtmlContent) {
          setEditorContent(data.contractHtmlContent);
        }
        // Restore selected employee ID for active contract check
        if (data.employeeId) {
          setSelectedEmployeeId(data.employeeId);
        }
      }
    },
  });

  // Watch content source to load contract when "copy" is selected
  const contentSource = form.watch('contentSource');
  const sourceContractId = form.watch('sourceContractId');
  const contractType = form.watch('contractType');
  const startDate = form.watch('startDate');

  // Auto-set end date based on contract type change
  useEffect(() => {
    if (!startDate) return;

    const startDateObj = new Date(startDate);

    if (contractType === 'CDD') {
      // Default 6 months for CDD
      form.setValue('endDate', format(addMonths(startDateObj, 6), 'yyyy-MM-dd'));
    } else if (contractType === 'STAGE') {
      // Default 3 months for internship
      form.setValue('endDate', format(addMonths(startDateObj, 3), 'yyyy-MM-dd'));
    } else if (contractType === 'INTERIM') {
      // Default 1 month for temporary work
      form.setValue('endDate', format(addMonths(startDateObj, 1), 'yyyy-MM-dd'));
    } else {
      // CDI and CDDTI have no end date
      form.setValue('endDate', '');
    }
  }, [contractType, startDate, form]);

  useEffect(() => {
    if (contentSource === 'copy' && sourceContractId && existingContracts) {
      const sourceContract = existingContracts.contracts.find(c => c.id === sourceContractId);
      if (sourceContract) {
        // Load content from source contract
        // TODO: Add query to fetch contract HTML content
        toast.info('Chargement du contrat source...');
      }
    } else if (contentSource === 'blank') {
      setEditorContent('');
      form.setValue('contractHtmlContent', '');
    }
  }, [contentSource, sourceContractId, existingContracts, form]);

  // Handle editor changes (called on every keystroke)
  const handleEditorChange = (html: string) => {
    setEditorContent(html);
    form.setValue('contractHtmlContent', html);
  };

  // Handle editor save (called on auto-save)
  const handleEditorSave = async (html: string) => {
    setEditorContent(html);
    form.setValue('contractHtmlContent', html);
  };

  // Combined pending state for all mutations
  const isPending =
    resilientCreate.isPending ||
    resilientUpdate.isPending ||
    resilientGeneratePdf.isPending;

  const isRetrying =
    resilientCreate.isRetrying ||
    resilientUpdate.isRetrying ||
    resilientGeneratePdf.isRetrying;

  const isOnline = resilientCreate.isOnline; // All hooks share same online state

  // Save as draft (no PDF generation)
  const handleSaveDraft = async (values: ContractFormValues) => {
    // Block if dates overlap with existing contract
    if (hasOverlap) {
      toast.error('Les dates chevauchent un contrat existant');
      return;
    }

    // Get ACTUAL current content from the editor (what user sees)
    const contentToSave = getEditorContent?.() || editorContent || values.contractHtmlContent;

    if (mode === 'edit' && contractId) {
      await resilientUpdate.mutate({
        id: contractId,
        contractHtmlContent: contentToSave,
      });
      // Clear auto-saved data after successful save
      clearSavedData();
    } else {
      await resilientCreate.mutate({
        employeeId: values.employeeId,
        contractType: values.contractType,
        startDate: values.startDate,
        endDate: values.endDate || null,
        contractHtmlContent: contentToSave,
      });
      // Clear auto-saved data after successful save
      clearSavedData();
      // Note: Navigation happens via onSuccess callback or manual after checking
    }
  };

  // Save and generate PDF
  const handleSaveAndGeneratePdf = async (values: ContractFormValues) => {
    // Block if has active contract
    if (hasOverlap) {
      toast.error('Les dates chevauchent un contrat existant');
      return;
    }

    // Get ACTUAL current content from the editor (what user sees)
    const contentToSave = getEditorContent?.() || editorContent || values.contractHtmlContent;

    // Validate content is not empty for PDF generation
    if (!contentToSave || contentToSave.trim().length === 0) {
      toast.error('Le contenu du contrat est requis pour générer le PDF');
      return;
    }

    try {
      let finalContractId = contractId;

      // First, create or update contract
      if (mode === 'edit' && contractId) {
        await updateContractMutation.mutateAsync({
          id: contractId,
          contractHtmlContent: contentToSave,
        });
      } else {
        const result = await createContractMutation.mutateAsync({
          employeeId: values.employeeId,
          contractType: values.contractType,
          startDate: values.startDate,
          endDate: values.endDate || null,
          contractHtmlContent: contentToSave,
        });
        finalContractId = result.id;
      }

      // Then generate PDF
      if (finalContractId) {
        await generatePdfMutation.mutateAsync({
          contractId: finalContractId,
          companyRepresentative: 'Directeur Général', // TODO: Get from user or company settings
          companyRepresentativeTitle: 'DG',
        });

        // Clear auto-saved data after successful generation
        clearSavedData();

        toast.success('Contrat généré avec succès');
        router.push('/contracts');
      }
    } catch (error) {
      console.error('Error generating contract:', error);
      // Error already handled by mutation
    }
  };

  return (
    <Form {...form}>
      <form className="space-y-6">
        {/* Essential Fields Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Informations essentielles</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Employee Selection */}
            <FormField
              control={form.control}
              name="employeeId"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Employé *</FormLabel>
                  <Popover open={employeeSearchOpen} onOpenChange={setEmployeeSearchOpen}>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          role="combobox"
                          className={cn(
                            'min-h-[56px] justify-between',
                            !field.value && 'text-muted-foreground'
                          )}
                          disabled={mode === 'edit'} // Can't change employee in edit mode
                        >
                          {field.value
                            ? employees?.employees.find((e) => e.id === field.value)
                                ? `${employees.employees.find((e) => e.id === field.value)?.firstName} ${
                                    employees.employees.find((e) => e.id === field.value)?.lastName
                                  } (${employees.employees.find((e) => e.id === field.value)?.employeeNumber})`
                                : 'Sélectionner un employé'
                            : 'Sélectionner un employé'}
                          <FileText className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-[400px] p-0">
                      <Command>
                        <CommandInput placeholder="Rechercher un employé..." />
                        <CommandList>
                          <CommandEmpty>Aucun employé trouvé</CommandEmpty>
                          <CommandGroup>
                            {employees?.employees.map((employee) => (
                              <CommandItem
                                key={employee.id}
                                value={`${employee.firstName} ${employee.lastName} ${employee.employeeNumber}`}
                                onSelect={() => {
                                  form.setValue('employeeId', employee.id);
                                  setSelectedEmployeeId(employee.id);
                                  setEmployeeSearchOpen(false);
                                }}
                              >
                                <Check
                                  className={cn(
                                    'mr-2 h-4 w-4',
                                    employee.id === field.value ? 'opacity-100' : 'opacity-0'
                                  )}
                                />
                                <div className="flex flex-col">
                                  <span>
                                    {employee.firstName} {employee.lastName}
                                  </span>
                                  <span className="text-sm text-muted-foreground">
                                    {employee.employeeNumber}
                                  </span>
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  <FormDescription>
                    Recherchez par nom ou numéro d&apos;employé
                  </FormDescription>
                  <FormMessage />

                  {/* Contract Overlap Check */}
                  {checkingOverlap && selectedEmployeeId && startDateForOverlap && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mt-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Vérification des contrats existants...
                    </div>
                  )}

                  {/* Date Overlap Warning (blocks submission) */}
                  {hasOverlap && overlappingContract && (
                    <Alert variant="destructive" className="mt-4">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertTitle>Chevauchement de dates</AlertTitle>
                      <AlertDescription className="space-y-3">
                        <p>
                          Les dates chevauchent un contrat {overlappingContract.contractType} actif
                          du {overlappingContract.startDate}
                          {overlappingContract.endDate ? ` jusqu'au ${overlappingContract.endDate}` : ' (durée indéterminée)'}.
                        </p>
                        <p>
                          Modifiez les dates ou résiliez le contrat existant.
                        </p>
                        <div className="flex flex-wrap gap-2 mt-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => router.push(`/contracts/${overlappingContract.id}`)}
                            className="min-h-[44px]"
                          >
                            <ExternalLink className="h-4 w-4 mr-2" />
                            Voir le contrat
                          </Button>
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            onClick={() => router.push(`/employees/${selectedEmployeeId}/terminate`)}
                            className="min-h-[44px]"
                          >
                            Résilier le contrat
                          </Button>
                        </div>
                      </AlertDescription>
                    </Alert>
                  )}

                  {/* Future Contract Info (allowed, just informational) */}
                  {!hasOverlap && precedingContract && (
                    <Alert className="mt-4 border-blue-200 bg-blue-50 text-blue-800">
                      <Info className="h-4 w-4" />
                      <AlertTitle>Contrat futur</AlertTitle>
                      <AlertDescription>
                        Ce contrat commencera après la fin du contrat actuel ({precedingContract.contractType} jusqu&apos;au {precedingContract.endDate}).
                      </AlertDescription>
                    </Alert>
                  )}
                </FormItem>
              )}
            />

            {/* Contract Type */}
            <FormField
              control={form.control}
              name="contractType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Type de contrat *</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger className="min-h-[56px]">
                        <SelectValue placeholder="Sélectionner un type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="CDI">CDI - Contrat à Durée Indéterminée</SelectItem>
                      <SelectItem value="CDD">CDD - Contrat à Durée Déterminée</SelectItem>
                      <SelectItem value="CDDTI">
                        CDDTI - Contrat à Durée Déterminée pour Tâche Indéterminée
                      </SelectItem>
                      <SelectItem value="STAGE">STAGE - Contrat de Stage</SelectItem>
                      <SelectItem value="INTERIM">INTERIM - Contrat Intérimaire</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Le type de contrat détermine les clauses légales applicables
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Start Date */}
            <FormField
              control={form.control}
              name="startDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Date de début *</FormLabel>
                  <FormControl>
                    <input
                      type="date"
                      className="flex h-14 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>Date d&apos;entrée en vigueur du contrat</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* End Date (for CDD, STAGE, INTERIM only) */}
            {['CDD', 'STAGE', 'INTERIM'].includes(contractType) && (
              <FormField
                control={form.control}
                name="endDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date de fin *</FormLabel>
                    <FormControl>
                      <input
                        type="date"
                        className="flex h-14 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        {...field}
                        min={startDate || undefined}
                      />
                    </FormControl>
                    <FormDescription>
                      {contractType === 'CDD' && 'Maximum 24 mois (renouvellements compris)'}
                      {contractType === 'STAGE' && 'Durée maximale selon la convention'}
                      {contractType === 'INTERIM' && 'Durée de la mission'}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
          </CardContent>
        </Card>

        {/* Content Source Selection (NEW contracts only) */}
        {mode === 'create' && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Source du contenu</CardTitle>
            </CardHeader>
            <CardContent>
              <FormField
                control={form.control}
                name="contentSource"
                render={({ field }) => (
                  <FormItem className="space-y-4">
                    <FormControl>
                      <RadioGroup
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                        className="grid grid-cols-1 md:grid-cols-2 gap-4"
                      >
                        <div className="flex items-start space-x-3 space-y-0 rounded-md border p-4 min-h-[80px]">
                          <RadioGroupItem value="blank" id="blank" />
                          <div className="flex-1">
                            <Label htmlFor="blank" className="font-medium cursor-pointer flex items-center gap-2">
                              <FileEdit className="h-4 w-4" />
                              Document vierge
                            </Label>
                            <p className="text-sm text-muted-foreground mt-1">
                              Écrivez ou collez votre contrat depuis Word
                            </p>
                          </div>
                        </div>

                        <div className="flex items-start space-x-3 space-y-0 rounded-md border p-4 min-h-[80px]">
                          <RadioGroupItem value="copy" id="copy" />
                          <div className="flex-1">
                            <Label htmlFor="copy" className="font-medium cursor-pointer flex items-center gap-2">
                              <Copy className="h-4 w-4" />
                              Copier un contrat existant
                            </Label>
                            <p className="text-sm text-muted-foreground mt-1">
                              Partir d&apos;un modèle déjà créé
                            </p>
                          </div>
                        </div>
                      </RadioGroup>
                    </FormControl>

                    {/* Source Contract Selection (shown when "copy" is selected) */}
                    {field.value === 'copy' && (
                      <FormField
                        control={form.control}
                        name="sourceContractId"
                        render={({ field: sourceField }) => (
                          <FormItem>
                            <FormLabel>Contrat à copier</FormLabel>
                            <Select onValueChange={sourceField.onChange} defaultValue={sourceField.value}>
                              <FormControl>
                                <SelectTrigger className="min-h-[56px]">
                                  <SelectValue placeholder="Sélectionner un contrat" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {existingContracts?.contracts.map((contract) => (
                                  <SelectItem key={contract.id} value={contract.id}>
                                    {contract.contractType} - {contract.employeeFirstName}{' '}
                                    {contract.employeeLastName} ({contract.startDate})
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>
        )}

        {/* Contract Content Editor */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Contenu du contrat</CardTitle>
          </CardHeader>
          <CardContent>
            <FormField
              control={form.control}
              name="contractHtmlContent"
              render={() => (
                <FormItem>
                  <FormControl>
                    <ContractEditor
                      initialContent={editorContent}
                      onChange={handleEditorChange}
                      onSave={handleEditorSave}
                      onEditorReady={(getContent) => setGetEditorContent(() => getContent)}
                      autoSave={true}
                      autoSaveInterval={30000}
                      placeholder="Collez ou écrivez le contenu du contrat ici..."
                      className="min-h-[600px]"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex flex-col gap-4 sticky bottom-4 bg-background p-4 rounded-lg border shadow-lg">
          {/* Connection Status */}
          <ConnectionStatus
            isOnline={isOnline}
            isRetrying={isRetrying}
            retryCount={resilientCreate.retryCount || resilientUpdate.retryCount}
            maxRetries={3}
          />

          <div className="flex flex-col sm:flex-row gap-4 justify-between items-center">
            <Button
              type="button"
              variant="ghost"
              onClick={() => router.push('/contracts')}
              className="min-h-[56px] w-full sm:w-auto"
            >
              <X className="h-4 w-4 mr-2" />
              Annuler
            </Button>

            <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
              {/* Retry button (shown when can retry) */}
              {(resilientCreate.canRetry || resilientUpdate.canRetry) && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    resilientCreate.retry();
                    resilientUpdate.retry();
                  }}
                  className="min-h-[56px] w-full sm:w-auto"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Réessayer
                </Button>
              )}

              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  const values = form.getValues();
                  handleSaveDraft(values);
                }}
                disabled={isPending || !isOnline || hasOverlap}
                className="min-h-[56px] w-full sm:w-auto"
              >
                {isPending && !isRetrying ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Sauvegarde...
                  </>
                ) : isRetrying ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Nouvelle tentative...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Sauvegarder brouillon
                  </>
                )}
              </Button>

              <Button
                type="button"
                variant="default"
                onClick={() => {
                  const values = form.getValues();
                  handleSaveAndGeneratePdf(values);
                }}
                disabled={isPending || !isOnline || hasOverlap}
                className="min-h-[56px] w-full sm:w-auto"
              >
                {generatePdfMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Génération...
                  </>
                ) : (
                  <>
                    <FileText className="h-4 w-4 mr-2" />
                    Sauvegarder et générer PDF
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </form>
    </Form>
  );
}
