/**
 * Time-Off Request Form
 *
 * Mobile-first form following HCI principles:
 * - Wizard-style multi-step flow
 * - Smart defaults (today + 15 days)
 * - Error prevention (validate balance upfront)
 * - French labels
 * - Progressive disclosure
 */

'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
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
import { Calendar } from '@/components/ui/calendar';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { trpc } from '@/lib/trpc/client';
import { toast } from 'sonner';
import { Calendar as CalendarIcon, AlertCircle, Settings, Info, Upload, FileText, X } from 'lucide-react';
import { fr } from 'date-fns/locale';
import { addDays, format } from 'date-fns';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { UploadDocumentDialog } from '@/components/documents/upload-document-dialog';

const timeOffRequestSchema = z.object({
  policyId: z.string().uuid('Sélectionnez un type de congé'),
  startDate: z.date({
    required_error: 'Date de début requise',
  }),
  endDate: z.date({
    required_error: 'Date de fin requise',
  }),
  reason: z.string().optional(),
  handoverNotes: z.string().optional(),
  isDeductibleForACP: z.boolean(),
  justificationDocumentId: z.string().uuid().optional(),
});

type TimeOffRequestForm = z.infer<typeof timeOffRequestSchema>;

interface TimeOffRequestFormProps {
  employeeId: string;
  onSuccess?: () => void;
}

export function TimeOffRequestForm({ employeeId, onSuccess }: TimeOffRequestFormProps) {
  const utils = trpc.useUtils();

  // State for document upload
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [uploadedDocument, setUploadedDocument] = useState<{
    id: string;
    fileName: string;
  } | null>(null);

  // Get current user to check roles
  const { data: currentUser } = trpc.auth.me.useQuery();

  // Check if user has HR role
  const isHRUser = currentUser?.role
    ? ['hr', 'hr_manager', 'super_admin'].includes(currentUser.role)
    : false;

  // Get policies
  const { data: policies } = trpc.timeOff.getPolicies.useQuery();

  // Get balances
  const { data: balances } = trpc.timeOff.getAllBalances.useQuery({ employeeId });

  // Request mutation
  const requestMutation = trpc.timeOff.request.useMutation({
    onSuccess: () => {
      toast.success('Demande de congé envoyée');
      // Invalidate queries to refetch updated data
      utils.timeOff.getEmployeeRequests.invalidate({ employeeId });
      utils.timeOff.getAllBalances.invalidate({ employeeId });
      form.reset();
      setUploadedDocument(null); // Reset uploaded document
      onSuccess?.();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  // Form setup with smart defaults
  const form = useForm<TimeOffRequestForm>({
    resolver: zodResolver(timeOffRequestSchema),
    defaultValues: {
      startDate: addDays(new Date(), 15), // Default: 15 days from now
      endDate: addDays(new Date(), 16), // Default: 2 days leave
      isDeductibleForACP: true, // Default: deductible for ACP
    },
  });

  const selectedPolicy = form.watch('policyId');
  const startDate = form.watch('startDate');
  const endDate = form.watch('endDate');

  // Get server-side preview (accurate calculation with holidays)
  const { data: preview, isLoading: isLoadingPreview } = trpc.timeOff.previewRequest.useQuery(
    {
      employeeId,
      policyId: selectedPolicy || '',
      startDate: startDate || new Date(),
      endDate: endDate || new Date(),
    },
    {
      enabled: !!selectedPolicy && !!startDate && !!endDate,
    }
  );

  // Use preview data when available
  const businessDays = preview?.totalDays ?? 0;
  const returnDate = preview?.returnDate ? new Date(preview.returnDate) : null;
  const hasHolidays = preview?.hasHolidays ?? false;
  const holidays = preview?.holidays ?? [];

  // Get selected policy details
  const selectedPolicyDetails = policies?.find((p) => p.id === selectedPolicy);
  const isUnpaidLeave = selectedPolicyDetails?.accrualMethod === 'none' || !selectedPolicyDetails?.isPaid;

  // Check if this is an exceptional permission (Article 25.12 - famille_legale) or sick leave
  const policyMetadata = selectedPolicyDetails?.metadata as { permission_category?: string } | null;
  const isExceptionalPermission = policyMetadata?.permission_category === 'famille_legale';
  const isSickLeave = selectedPolicyDetails?.policyType === 'sick_leave';

  // Justificatif required for exceptional permissions AND sick leave
  const requiresJustificatif = isExceptionalPermission || isSickLeave;

  // Get balance for selected policy (only for paid leave)
  const selectedBalance = balances?.find((b) => b.policyId === selectedPolicy);
  const availableBalance = preview?.availableBalance ?? (selectedBalance
    ? parseFloat(selectedBalance.balance as string) - parseFloat(selectedBalance.pending as string)
    : 0);

  // Check if sufficient balance (skip check for unpaid leave)
  const hasSufficientBalance = preview?.hasSufficientBalance ?? (isUnpaidLeave || businessDays <= availableBalance);

  // Check if justificatif is required but missing (for exceptional permissions or sick leave)
  const isMissingRequiredJustificatif = requiresJustificatif && !uploadedDocument;

  // Submit handler
  const onSubmit = async (data: TimeOffRequestForm) => {
    // Check if justificatif is required but missing (for exceptional permissions)
    if (isMissingRequiredJustificatif) {
      toast.error('Un justificatif est requis pour les permissions exceptionnelles (Article 25.12)');
      return;
    }

    // Skip balance check for unpaid leave
    if (!isUnpaidLeave && !hasSufficientBalance) {
      toast.error(`Solde insuffisant (disponible: ${availableBalance.toFixed(1)} jours)`);
      return;
    }

    await requestMutation.mutateAsync({
      employeeId,
      policyId: data.policyId,
      startDate: data.startDate,
      endDate: data.endDate,
      reason: data.reason,
      handoverNotes: data.handoverNotes,
      isDeductibleForACP: data.isDeductibleForACP,
      justificationDocumentId: uploadedDocument?.id,
    });
  };

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle className="text-2xl">Demande de congé</CardTitle>
        <CardDescription className="text-base">
          Remplissez le formulaire pour demander un congé
        </CardDescription>
      </CardHeader>

      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Policy selection */}
            <FormField
              control={form.control}
              name="policyId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-lg">Type de congé</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="min-h-[48px] text-base">
                        <SelectValue placeholder="Sélectionnez un type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {policies?.map((policy) => {
                        // Check if this is unpaid leave (no balance needed)
                        const isUnpaid = policy.accrualMethod === 'none' || !policy.isPaid;

                        const balance = balances?.find((b) => b.policyId === policy.id);
                        const available = balance
                          ? parseFloat(balance.balance as string) - parseFloat(balance.pending as string)
                          : 0;

                        return (
                          <SelectItem key={policy.id} value={policy.id} className="text-base">
                            <div className="flex justify-between items-center gap-4">
                              <span>{policy.name}</span>
                              <Badge variant={isUnpaid ? "secondary" : "outline"}>
                                {isUnpaid ? 'Illimité' : `${available.toFixed(1)} jours disponibles`}
                              </Badge>
                            </div>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Date range selection */}
            <div className="grid gap-6 md:grid-cols-2">
              <FormField
                control={form.control}
                name="startDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-lg">Date de début</FormLabel>
                    <FormControl>
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={field.onChange}
                        locale={fr}
                        disabled={(date) => date < new Date()}
                        className="rounded-md border"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="endDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-lg">Dernier jour de congé</FormLabel>
                    <FormControl>
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={field.onChange}
                        locale={fr}
                        disabled={(date) => date < startDate}
                        className="rounded-md border"
                      />
                    </FormControl>
                    <FormDescription className="text-sm">
                      Vous reprendrez le travail le lendemain
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Duration summary with return date and holidays */}
            {businessDays > 0 && (
              <div className="space-y-4">
                <Alert className={hasSufficientBalance ? 'border-green-500' : 'border-destructive'}>
                  <AlertCircle className="h-5 w-5" />
                  <AlertDescription className="text-base">
                    <div className="space-y-2">
                      <p className="font-medium">
                        Durée: {businessDays} jour{businessDays > 1 ? 's' : ''} ouvrable{businessDays > 1 ? 's' : ''}
                      </p>
                      {returnDate && (
                        <p className="text-sm">
                          <span className="font-medium">Date de reprise:</span>{' '}
                          {format(returnDate, 'EEEE d MMMM yyyy', { locale: fr })}
                        </p>
                      )}
                      {selectedBalance && (
                        <>
                          <p>
                            Solde disponible: {availableBalance.toFixed(1)} jour{availableBalance > 1 ? 's' : ''}
                          </p>
                          {!hasSufficientBalance && (
                            <p className="text-destructive font-medium">
                              Solde insuffisant!
                            </p>
                          )}
                        </>
                      )}
                    </div>
                  </AlertDescription>
                </Alert>

                {/* Holiday warnings */}
                {hasHolidays && holidays.length > 0 && (
                  <Alert className="border-blue-500">
                    <Info className="h-5 w-5 text-blue-500" />
                    <AlertDescription className="text-base">
                      <p className="font-medium mb-1">
                        {holidays.length} jour{holidays.length > 1 ? 's' : ''} férié{holidays.length > 1 ? 's' : ''} dans cette période:
                      </p>
                      <ul className="list-disc list-inside text-sm space-y-0.5">
                        {holidays.map((holiday, idx) => (
                          <li key={idx}>
                            {holiday.name} ({format(new Date(holiday.date), 'd MMM', { locale: fr })})
                          </li>
                        ))}
                      </ul>
                      <p className="text-sm mt-2 text-muted-foreground">
                        Les jours fériés ne sont pas déduits de votre solde.
                      </p>
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            )}

            {/* Reason */}
            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-lg">Motif (optionnel)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Expliquez brièvement le motif de votre demande..."
                      className="min-h-[100px] text-base"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Ce champ est optionnel mais peut aider votre gestionnaire
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Handover Notes */}
            <FormField
              control={form.control}
              name="handoverNotes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-lg">Notes de passation (optionnel)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Décrivez la passation de charge pendant votre absence (tâches en cours, personnes à contacter, urgences)..."
                      className="min-h-[120px] text-base"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Informations importantes pour assurer la continuité pendant votre absence
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Exceptional Permission Notice (Article 25.12) - Only for famille_legale */}
            {isExceptionalPermission && (
              <Alert className="border-blue-500 bg-blue-50">
                <Info className="h-5 w-5 text-blue-600" />
                <AlertDescription className="text-blue-800">
                  <p className="font-medium">Permission exceptionnelle (Article 25.12)</p>
                  <p className="text-sm mt-1">
                    Si l'événement a lieu loin de votre domicile, vous pouvez demander des jours
                    supplémentaires (non payés) pour le trajet.
                  </p>
                </AlertDescription>
              </Alert>
            )}

            {/* Justificatif Upload Section - REQUIRED for exceptional permissions AND sick leave */}
            {requiresJustificatif && (
              <div className="space-y-4">
                <div className={`border rounded-lg p-4 space-y-3 ${!uploadedDocument ? 'border-amber-500 bg-amber-50' : 'border-green-500 bg-green-50'}`}>
                  <div className="flex items-center gap-2">
                    <FileText className={`h-5 w-5 ${!uploadedDocument ? 'text-amber-600' : 'text-green-600'}`} />
                    <span className="font-medium">Justificatif (obligatoire)</span>
                    {!uploadedDocument && (
                      <Badge variant="destructive" className="text-xs">Requis</Badge>
                    )}
                  </div>

                  {uploadedDocument ? (
                    <div className="flex items-center justify-between bg-green-100 border border-green-300 rounded-md p-3">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-green-600" />
                        <span className="text-sm text-green-800 font-medium">{uploadedDocument.fileName}</span>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setUploadedDocument(null)}
                        className="h-8 w-8 p-0 text-green-600 hover:text-red-600"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full min-h-[48px] border-amber-500 text-amber-700 hover:bg-amber-100"
                      onClick={() => setShowUploadDialog(true)}
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Télécharger le justificatif
                    </Button>
                  )}

                  <p className="text-sm text-amber-700">
                    {isSickLeave
                      ? 'Un certificat médical est requis pour les congés maladie.'
                      : 'Article 25.12: Un justificatif est requis pour les permissions exceptionnelles (acte de mariage, certificat de décès, etc.)'}
                  </p>
                </div>

                {/* Upload Dialog */}
                <UploadDocumentDialog
                  open={showUploadDialog}
                  onOpenChange={setShowUploadDialog}
                  employeeId={employeeId}
                  defaultCategory="leave_justification"
                  onUploadSuccess={(result) => {
                    if (result?.documentId) {
                      setUploadedDocument({
                        id: result.documentId,
                        fileName: 'Document téléchargé', // The dialog doesn't return filename, use generic
                      });
                    }
                    setShowUploadDialog(false);
                  }}
                />
              </div>
            )}

            {/* General Justification Note (for leaves that don't require upfront justificatif) */}
            {!requiresJustificatif && (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  <strong>Documents justificatifs :</strong> Vous pourrez télécharger des documents
                  justificatifs après l'approbation de votre demande si nécessaire.
                </AlertDescription>
              </Alert>
            )}

            {/* HR-only: ACP Deductibility */}
            {isHRUser && (
              <div className="space-y-2 p-4 bg-muted rounded-md border">
                <div className="flex items-center gap-2 mb-2">
                  <Settings className="h-4 w-4" />
                  <span className="text-sm font-semibold">
                    Options avancées (HR seulement)
                  </span>
                </div>

                <FormField
                  control={form.control}
                  name="isDeductibleForACP"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={!field.value}
                          onCheckedChange={(checked) => field.onChange(!checked)}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel className="text-sm font-normal cursor-pointer">
                          Non déductible pour le calcul ACP
                        </FormLabel>
                        <FormDescription className="text-xs">
                          Cocher si cette absence ne doit pas réduire les jours payés
                          pour le calcul de l'ACP (ex: permission, absence non justifiée)
                        </FormDescription>
                      </div>
                    </FormItem>
                  )}
                />
              </div>
            )}

            {/* Submit button */}
            <Button
              type="submit"
              disabled={requestMutation.isPending || !hasSufficientBalance || isMissingRequiredJustificatif}
              className="w-full min-h-[56px] text-lg"
              size="lg"
            >
              {requestMutation.isPending ? 'Envoi en cours...' : 'Envoyer la demande'}
            </Button>

            {/* Missing justificatif warning */}
            {isMissingRequiredJustificatif && (
              <p className="text-center text-sm text-destructive">
                Veuillez télécharger un justificatif avant de soumettre la demande
              </p>
            )}
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
