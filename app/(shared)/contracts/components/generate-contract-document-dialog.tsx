/**
 * Generate Contract Document Dialog (With Rich Text Editor)
 *
 * Word-like editor for creating/editing contract content:
 * - Start from blank or copy from previous contract
 * - Pre-populated with employee/company data
 * - Rich text editing with Tiptap
 * - Saves HTML content to database
 * - Generates PDF from HTML using Puppeteer
 * - Creates versioned documents
 * - Ready for e-signature integration
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
  DialogFooter,
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
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Loader2,
  FileText,
  CheckCircle,
  AlertTriangle,
  Copy,
  FileEdit,
} from 'lucide-react';
import { api } from '@/trpc/react';
import { toast } from 'sonner';
import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/skeleton';

const ContractEditor = dynamic(
  () => import('@/components/contracts/contract-editor').then(mod => mod.ContractEditor),
  { loading: () => <Skeleton className="h-64 w-full" />, ssr: false }
);

// ============================================================================
// Schema
// ============================================================================

const generateContractDocumentSchema = z.object({
  companyRepresentative: z.string().min(1, 'Le nom du représentant est requis'),
  companyRepresentativeTitle: z.string().min(1, 'Le titre du représentant est requis'),
  versionNotes: z.string().optional(),
  contentSource: z.enum(['blank', 'previous']),
  sourceContractId: z.string().uuid().optional(),
});

type GenerateContractDocumentFormValues = z.infer<typeof generateContractDocumentSchema>;

// ============================================================================
// Types
// ============================================================================

interface GenerateContractDocumentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contractId: string;
  employeeName: string;
  contractType: string;
  contractNumber?: string;
  onSuccess?: () => void;
}

// ============================================================================
// Helper: Generate Default HTML Template
// ============================================================================

function generateDefaultContractHTML(data: {
  contractType: string;
  contractNumber: string;
  employeeName: string;
  companyName: string;
  companyRepresentative: string;
  companyRepresentativeTitle: string;
  startDate: string;
}): string {
  return `
<h1>CONTRAT DE TRAVAIL</h1>
<h1>${data.contractType === 'CDI' ? 'À DURÉE INDÉTERMINÉE (CDI)' :
      data.contractType === 'CDD' ? 'À DURÉE DÉTERMINÉE (CDD)' :
      'TEMPORAIRE/INTERMITTENT (CDDTI)'}</h1>

<p><strong>N° ${data.contractNumber}</strong></p>

<p><strong>ENTRE LES SOUSSIGNÉS :</strong></p>

<p><strong>L'EMPLOYEUR :</strong></p>
<p>${data.companyName}</p>
<p>Représentée par ${data.companyRepresentative}, ${data.companyRepresentativeTitle}</p>

<p><strong>ET</strong></p>

<p><strong>L'EMPLOYÉ(E) :</strong></p>
<p>${data.employeeName}</p>

<p><strong>IL A ÉTÉ CONVENU ET ARRÊTÉ CE QUI SUIT :</strong></p>

<h2>ARTICLE 1 - OBJET</h2>
<p>Le présent contrat a pour objet de définir les conditions d'emploi de ${data.employeeName} au sein de la société ${data.companyName}.</p>
<p>L'employé(e) est engagé(e) à compter du ${new Date(data.startDate).toLocaleDateString('fr-FR')}.</p>

<h2>ARTICLE 2 - FONCTIONS</h2>
<p><em>[Décrivez les fonctions et responsabilités de l'employé(e)]</em></p>

<h2>ARTICLE 3 - RÉMUNÉRATION</h2>
<p><em>[Indiquez le salaire brut mensuel et les avantages]</em></p>

<h2>ARTICLE 4 - DURÉE DU TRAVAIL</h2>
<p><em>[Précisez les heures de travail et l'horaire]</em></p>

<h2>ARTICLE 5 - CONFIDENTIALITÉ ET LOYAUTÉ</h2>
<p>L'employé(e) s'engage à ne divulguer aucune information confidentielle concernant l'entreprise, ses clients, ses projets ou ses méthodes de travail, pendant la durée du contrat et après sa cessation.</p>

<p><strong>Fait à __________, le ${new Date().toLocaleDateString('fr-FR')}</strong></p>

<div style="display: flex; justify-content: space-between; margin-top: 40px;">
  <div style="width: 45%;">
    <p><strong>L'Employeur</strong></p>
    <p>${data.companyRepresentative}</p>
  </div>
  <div style="width: 45%;">
    <p><strong>L'Employé(e)</strong></p>
    <p>${data.employeeName}</p>
  </div>
</div>
  `.trim();
}

// ============================================================================
// Component
// ============================================================================

export function GenerateContractDocumentDialog({
  open,
  onOpenChange,
  contractId,
  employeeName,
  contractType,
  contractNumber,
  onSuccess,
}: GenerateContractDocumentDialogProps) {
  const utils = api.useUtils();
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);
  const [editorContent, setEditorContent] = useState<string>('');
  const [isLoadingContent, setIsLoadingContent] = useState(false);

  const form = useForm<GenerateContractDocumentFormValues>({
    resolver: zodResolver(generateContractDocumentSchema),
    defaultValues: {
      companyRepresentative: '',
      companyRepresentativeTitle: '',
      versionNotes: '',
      contentSource: 'blank',
    },
  });

  // Get existing HTML content for this contract
  const { data: existingContent } = api.contracts.getContractHtml.useQuery(
    { contractId },
    { enabled: open }
  );

  // Get all contracts for copy dropdown
  const { data: allContracts } = api.contracts.getAllContracts.useQuery(
    { isActive: true, limit: 100 },
    { enabled: open && form.watch('contentSource') === 'previous' }
  );

  // Get preview data for default template
  const { data: contractPreview } = api.documents.getContractPreview.useQuery(
    { contractId },
    { enabled: open }
  );

  // Generate contract document mutation
  const generateDocument = api.documents.generateContractDocument.useMutation({
    onSuccess: (data) => {
      setGeneratedUrl(data.fileUrl);
      toast.success('Document généré avec succès', {
        description: `Le contrat ${contractType} a été généré et téléversé.`,
        action: {
          label: 'Télécharger',
          onClick: () => window.open(data.fileUrl, '_blank'),
        },
      });

      // Invalidate queries to refresh UI
      utils.contracts.getAllContracts.invalidate();
      onSuccess?.();
    },
    onError: (error) => {
      toast.error('Erreur lors de la génération du document', {
        description: error.message,
      });
    },
  });

  // Update contract HTML mutation
  const updateContractHtml = api.contracts.updateContractHtml.useMutation({
    onError: (error) => {
      toast.error('Erreur lors de la sauvegarde du contenu', {
        description: error.message,
      });
    },
  });

  // Copy contract content mutation
  const copyContent = api.contracts.copyContractContent.useMutation({
    onSuccess: () => {
      // Reload content after copy
      utils.contracts.getContractHtml.invalidate({ contractId });
    },
  });

  // Load content based on source selection
  useEffect(() => {
    if (!open || !contractPreview) return;

    const contentSource = form.watch('contentSource');
    const sourceContractId = form.watch('sourceContractId');

    if (contentSource === 'blank') {
      // Generate default template with employee data
      const defaultHtml = generateDefaultContractHTML({
        contractType,
        contractNumber: contractNumber || `${contractType}-${new Date().getFullYear()}-XXXX`,
        employeeName,
        companyName: contractPreview.companyName,
        companyRepresentative: form.watch('companyRepresentative') || '[Nom du représentant]',
        companyRepresentativeTitle: form.watch('companyRepresentativeTitle') || '[Titre]',
        startDate: contractPreview.startDate,
      });
      setEditorContent(defaultHtml);
    } else if (contentSource === 'previous' && sourceContractId) {
      // Copy from selected contract
      setIsLoadingContent(true);
      copyContent.mutate(
        { sourceContractId, targetContractId: contractId },
        {
          onSuccess: () => {
            utils.contracts.getContractHtml.invalidate({ contractId });
            setIsLoadingContent(false);
          },
          onError: () => {
            setIsLoadingContent(false);
          },
        }
      );
    }
  }, [
    open,
    form.watch('contentSource'),
    form.watch('sourceContractId'),
    contractPreview,
  ]);

  // Load existing content if available
  useEffect(() => {
    if (existingContent?.htmlContent) {
      setEditorContent(existingContent.htmlContent);
    }
  }, [existingContent]);

  const handleSaveContent = async (html: string) => {
    await updateContractHtml.mutateAsync({
      contractId,
      htmlContent: html,
      templateSource: form.watch('contentSource'),
    });
  };

  const onSubmit = async (data: GenerateContractDocumentFormValues) => {
    // First, save the current editor content
    if (editorContent) {
      await handleSaveContent(editorContent);
    }

    // Then generate PDF (backend will use the saved HTML)
    await generateDocument.mutateAsync({
      contractId,
      companyRepresentative: data.companyRepresentative,
      companyRepresentativeTitle: data.companyRepresentativeTitle,
      versionNotes: data.versionNotes,
    });
  };

  const handleClose = () => {
    onOpenChange(false);
    form.reset();
    setGeneratedUrl(null);
    setEditorContent('');
  };

  const getContractTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      CDI: 'Contrat à Durée Indéterminée',
      CDD: 'Contrat à Durée Déterminée',
      CDDTI: 'Contrat Temporaire/Intermittent',
      STAGE: 'Convention de Stage',
      INTERIM: 'Contrat Intérim',
    };
    return labels[type] || type;
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-6xl max-h-[95vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Générer le contrat de travail</DialogTitle>
          <DialogDescription>
            Modifiez le contenu du contrat puis générez le PDF final
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Contract Info */}
            <div className="rounded-lg border border-muted p-4 space-y-2 bg-muted/50">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Type de contrat</p>
                  <p className="text-base font-semibold text-primary">{getContractTypeLabel(contractType)}</p>
                </div>
                <FileText className="h-5 w-5 text-muted-foreground" />
              </div>

              {contractNumber && (
                <div className="pt-2 border-t border-border">
                  <p className="text-sm text-muted-foreground">Numéro de contrat</p>
                  <p className="text-base font-mono text-sm">{contractNumber}</p>
                </div>
              )}

              <div className="pt-2 border-t border-border">
                <p className="text-sm text-muted-foreground">Employé(e)</p>
                <p className="text-base font-semibold">{employeeName}</p>
              </div>
            </div>

            {/* Company Representative */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="companyRepresentative"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Représentant de l'entreprise *</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="Ex: Jean Kouassi"
                        className="min-h-[48px]"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="companyRepresentativeTitle"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Titre du représentant *</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="Ex: Directeur Général"
                        className="min-h-[48px]"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Content Source Selection */}
            {!existingContent?.htmlContent && (
              <FormField
                control={form.control}
                name="contentSource"
                render={({ field }) => (
                  <FormItem className="space-y-3">
                    <FormLabel>Source du contenu</FormLabel>
                    <FormControl>
                      <RadioGroup
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                        className="flex flex-col space-y-1"
                      >
                        <div className="flex items-center space-x-3 space-y-0">
                          <RadioGroupItem value="blank" id="blank" />
                          <Label htmlFor="blank" className="font-normal cursor-pointer">
                            <div className="flex items-center gap-2">
                              <FileEdit className="h-4 w-4" />
                              <span>Commencer avec un modèle vide</span>
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">
                              Un contrat de base pré-rempli avec les informations de l'employé
                            </p>
                          </Label>
                        </div>

                        <div className="flex items-center space-x-3 space-y-0">
                          <RadioGroupItem value="previous" id="previous" />
                          <Label htmlFor="previous" className="font-normal cursor-pointer">
                            <div className="flex items-center gap-2">
                              <Copy className="h-4 w-4" />
                              <span>Copier depuis un contrat existant</span>
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">
                              Réutiliser le contenu d'un autre contrat
                            </p>
                          </Label>
                        </div>
                      </RadioGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Contract Selection for Copy */}
            {form.watch('contentSource') === 'previous' && !existingContent?.htmlContent && (
              <FormField
                control={form.control}
                name="sourceContractId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sélectionnez le contrat à copier</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger className="min-h-[48px]">
                          <SelectValue placeholder="Choisir un contrat" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {allContracts?.contracts
                          .filter((c) => c.id !== contractId)
                          .map((contract) => (
                            <SelectItem key={contract.id} value={contract.id}>
                              {contract.employeeName} - {contract.contractType} ({contract.contractNumber || 'Sans numéro'})
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Le contenu sera copié et vous pourrez le modifier
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Contract Editor */}
            {isLoadingContent ? (
              <div className="flex items-center justify-center h-64 border rounded-lg">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Contenu du contrat</Label>
                <ContractEditor
                  initialContent={editorContent}
                  onSave={handleSaveContent}
                  autoSave={true}
                  placeholder="Collez ou écrivez le contenu du contrat ici..."
                />
                <p className="text-sm text-muted-foreground">
                  Le contenu est sauvegardé automatiquement toutes les 30 secondes
                </p>
              </div>
            )}

            {/* Version Notes */}
            <FormField
              control={form.control}
              name="versionNotes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes de version (optionnel)</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder="Ex: Première version, Correction du salaire, etc."
                      className="min-h-[80px]"
                      maxLength={500}
                    />
                  </FormControl>
                  <FormDescription>
                    Ces notes seront ajoutées à l'historique du document
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Success State */}
            {generatedUrl && (
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertTitle>Document généré avec succès</AlertTitle>
                <AlertDescription>
                  <p className="mb-2">Le contrat PDF a été généré et téléversé.</p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(generatedUrl, '_blank')}
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    Télécharger le PDF
                  </Button>
                </AlertDescription>
              </Alert>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={generateDocument.isPending}
                className="min-h-[44px]"
              >
                {generatedUrl ? 'Fermer' : 'Annuler'}
              </Button>
              <Button
                type="submit"
                disabled={generateDocument.isPending || !editorContent}
                className="min-h-[44px]"
              >
                {generateDocument.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Génération en cours...
                  </>
                ) : (
                  <>
                    <FileText className="h-4 w-4 mr-2" />
                    Générer le PDF
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
