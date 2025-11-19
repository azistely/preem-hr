/**
 * Send Contract for Electronic Signature Dialog
 *
 * Dialog for sending generated contract documents for e-signature:
 * - Configure signers (employee + HR/company representative)
 * - Sequential signing order (employee first, then HR)
 * - Subject and message customization
 * - Integrates with Dropbox Sign API
 */

'use client';

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
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, PenTool, CheckCircle, Mail } from 'lucide-react';
import { api } from '@/trpc/react';
import { toast } from 'sonner';

// ============================================================================
// Schema
// ============================================================================

const sendForSignatureSchema = z.object({
  employeeName: z.string().min(1, 'Le nom de l\'employé est requis'),
  employeeEmail: z.string().email('Email invalide'),
  hrName: z.string().min(1, 'Le nom du représentant est requis'),
  hrEmail: z.string().email('Email invalide'),
  subject: z.string().optional(),
  message: z.string().optional(),
});

type SendForSignatureFormValues = z.infer<typeof sendForSignatureSchema>;

// ============================================================================
// Types
// ============================================================================

interface SendForSignatureDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentId?: string;
  contractType: string;
  employeeName: string;
  contractNumber?: string;
  onSuccess?: () => void;
}

// ============================================================================
// Component
// ============================================================================

export function SendForSignatureDialog({
  open,
  onOpenChange,
  documentId,
  contractType,
  employeeName,
  contractNumber,
  onSuccess,
}: SendForSignatureDialogProps) {
  const utils = api.useUtils();

  const form = useForm<SendForSignatureFormValues>({
    resolver: zodResolver(sendForSignatureSchema),
    defaultValues: {
      employeeName: employeeName,
      employeeEmail: '',
      hrName: '',
      hrEmail: '',
      subject: `Signature requise : Contrat ${contractType}`,
      message: `Bonjour,\n\nVeuillez signer le contrat ${contractType} ci-joint.\n\nMerci.`,
    },
  });

  // Send for signature mutation
  const sendForSignature = api.documents.sendForSignature.useMutation({
    onSuccess: () => {
      toast.success('Demande de signature envoyée', {
        description: 'Les signataires ont reçu un email avec le lien de signature.',
      });

      // Invalidate queries to refresh UI
      utils.contracts.getAllContracts.invalidate();

      onSuccess?.();
      handleClose();
    },
    onError: (error) => {
      toast.error('Erreur lors de l\'envoi', {
        description: error.message,
      });
    },
  });

  const onSubmit = async (data: SendForSignatureFormValues) => {
    if (!documentId) {
      toast.error('Aucun document à signer', {
        description: 'Veuillez d\'abord générer le document de contrat.',
      });
      return;
    }

    await sendForSignature.mutateAsync({
      documentId,
      signers: [
        {
          name: data.employeeName,
          email: data.employeeEmail,
          order: 0, // Employee signs first
        },
        {
          name: data.hrName,
          email: data.hrEmail,
          order: 1, // HR signs second
        },
      ],
      title: `Contrat ${contractType} - ${employeeName}`,
      subject: data.subject,
      message: data.message,
      signingOrder: 'sequential',
    });
  };

  const handleClose = () => {
    onOpenChange(false);
    form.reset();
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
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Envoyer pour signature électronique</DialogTitle>
          <DialogDescription>
            Configurer les signataires et envoyer le contrat via Dropbox Sign
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Contract Info */}
            <div className="rounded-lg border border-muted p-4 space-y-2 bg-muted/50">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Type de contrat</p>
                  <p className="text-base font-semibold text-primary">{getContractTypeLabel(contractType)}</p>
                </div>
                <PenTool className="h-5 w-5 text-muted-foreground" />
              </div>

              {contractNumber && (
                <div className="pt-2 border-t border-border">
                  <p className="text-sm text-muted-foreground">Numéro de contrat</p>
                  <p className="text-base font-mono text-sm">{contractNumber}</p>
                </div>
              )}
            </div>

            {/* Warning if no document */}
            {!documentId && (
              <Alert variant="destructive">
                <Mail className="h-4 w-4" />
                <AlertTitle>Document non généré</AlertTitle>
                <AlertDescription>
                  Veuillez d'abord générer le document PDF du contrat avant de l'envoyer pour signature.
                </AlertDescription>
              </Alert>
            )}

            {/* Employee Signer (Order: 1st) */}
            <div className="space-y-3 border-l-4 border-primary pl-4">
              <div className="flex items-center gap-2">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
                  1
                </div>
                <p className="text-sm font-semibold">Employé(e) - Signature en premier</p>
              </div>

              <FormField
                control={form.control}
                name="employeeName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nom complet de l'employé(e)</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="Ex: Marie Kouadio"
                        className="min-h-[48px]"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="employeeEmail"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email de l'employé(e) *</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="email"
                        placeholder="Ex: marie.kouadio@example.com"
                        className="min-h-[48px]"
                      />
                    </FormControl>
                    <FormDescription>
                      L'employé(e) recevra un email pour signer le contrat
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* HR/Company Representative (Order: 2nd) */}
            <div className="space-y-3 border-l-4 border-orange-500 pl-4">
              <div className="flex items-center gap-2">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-orange-500 text-white text-xs font-bold">
                  2
                </div>
                <p className="text-sm font-semibold">Représentant de l'entreprise - Signature après l'employé(e)</p>
              </div>

              <FormField
                control={form.control}
                name="hrName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nom du représentant *</FormLabel>
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
                name="hrEmail"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email du représentant *</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="email"
                        placeholder="Ex: jean.kouassi@preem.ci"
                        className="min-h-[48px]"
                      />
                    </FormControl>
                    <FormDescription>
                      Le représentant signera après l'employé(e)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Email Customization */}
            <FormField
              control={form.control}
              name="subject"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Objet de l'email (optionnel)</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="Ex: Signature requise : Contrat CDI"
                      className="min-h-[48px]"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="message"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Message personnalisé (optionnel)</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder="Message pour les signataires..."
                      className="min-h-[100px]"
                      maxLength={1000}
                    />
                  </FormControl>
                  <FormDescription>
                    Ce message sera inclus dans l'email de signature
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Info */}
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertTitle>Comment fonctionne la signature électronique ?</AlertTitle>
              <AlertDescription className="text-sm">
                <ul className="list-disc list-inside space-y-1 mt-2">
                  <li>L'employé(e) reçoit un email avec un lien de signature sécurisé</li>
                  <li>Après signature de l'employé(e), le représentant reçoit son lien</li>
                  <li>Les deux parties signent électroniquement (légalement valide)</li>
                  <li>Le contrat signé est automatiquement téléchargé</li>
                  <li>Vous recevez une notification quand le contrat est entièrement signé</li>
                </ul>
              </AlertDescription>
            </Alert>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={sendForSignature.isPending}
                className="min-h-[44px]"
              >
                Annuler
              </Button>
              <Button
                type="submit"
                disabled={sendForSignature.isPending || !documentId}
                className="min-h-[44px]"
              >
                {sendForSignature.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Envoi en cours...
                  </>
                ) : (
                  <>
                    <PenTool className="h-4 w-4 mr-2" />
                    Envoyer pour signature
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
