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
} from 'lucide-react';

import { api } from '@/trpc/react';
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
  contractHtmlContent: z.string(), // Allow empty for drafts
  contentSource: z.enum(['blank', 'copy']).optional(),
  sourceContractId: z.string().uuid().optional(),
});

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

  // Mutations
  const createContractMutation = api.contracts.createContract.useMutation();
  const updateContractMutation = api.contracts.updateContract.useMutation();
  const generatePdfMutation = api.documents.generateContractDocument.useMutation();

  // Form
  const form = useForm<ContractFormValues>({
    resolver: zodResolver(contractFormSchema),
    defaultValues: {
      employeeId: initialData?.employeeId || '',
      contractType: initialData?.contractType || 'CDI',
      startDate: initialData?.startDate || new Date().toISOString().split('T')[0],
      contractHtmlContent: initialData?.contractHtmlContent || '',
      contentSource: 'blank',
      sourceContractId: '',
    },
  });

  // Watch content source to load contract when "copy" is selected
  const contentSource = form.watch('contentSource');
  const sourceContractId = form.watch('sourceContractId');

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

  // Save as draft (no PDF generation)
  const handleSaveDraft = async (values: ContractFormValues) => {
    // Get ACTUAL current content from the editor (what user sees)
    const contentToSave = getEditorContent?.() || editorContent || values.contractHtmlContent;

    try {
      if (mode === 'edit' && contractId) {
        await updateContractMutation.mutateAsync({
          id: contractId,
          contractHtmlContent: contentToSave,
        });
        toast.success('Brouillon sauvegardé');
      } else {
        const result = await createContractMutation.mutateAsync({
          employeeId: values.employeeId,
          contractType: values.contractType,
          startDate: values.startDate,
          contractHtmlContent: contentToSave,
        });
        toast.success('Brouillon sauvegardé');
        // Navigate to edit page to continue editing
        router.push(`/contracts/${result.id}/edit`);
      }
    } catch (error) {
      console.error('Error saving draft:', error);
      toast.error('Erreur lors de la sauvegarde du brouillon');
    }
  };

  // Save and generate PDF
  const handleSaveAndGeneratePdf = async (values: ContractFormValues) => {
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

        toast.success('Contrat généré avec succès');
        router.push('/contracts');
      }
    } catch (error) {
      console.error('Error generating contract:', error);
      toast.error('Erreur lors de la génération du contrat');
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
        <div className="flex flex-col sm:flex-row gap-4 justify-between items-center sticky bottom-4 bg-background p-4 rounded-lg border shadow-lg">
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
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                const values = form.getValues();
                handleSaveDraft(values);
              }}
              disabled={
                createContractMutation.isPending ||
                updateContractMutation.isPending
              }
              className="min-h-[56px] w-full sm:w-auto"
            >
              {createContractMutation.isPending || updateContractMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Sauvegarde...
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
              disabled={
                createContractMutation.isPending ||
                updateContractMutation.isPending ||
                generatePdfMutation.isPending
              }
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
      </form>
    </Form>
  );
}
