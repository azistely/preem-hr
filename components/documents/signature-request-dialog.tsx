'use client';

/**
 * Signature Request Dialog
 * Epic: Document Management - E-Signature
 *
 * Features:
 * - Add multiple signers with sequential/parallel ordering
 * - Customize email subject and message
 * - Preview signature request before sending
 * - Shows estimated completion time
 *
 * Design principles:
 * - Simple wizard-style flow (Add signers → Review → Send)
 * - Touch-friendly (min 44px targets)
 * - French language throughout
 * - Error prevention (validate emails, required fields)
 */

import { useState } from 'react';
import { PenLine, Plus, X, Send, Users, Mail, MessageSquare, CheckCircle2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { api } from '@/trpc/react';
import { toast } from 'sonner';

// =====================================================
// Types
// =====================================================

interface Signer {
  name: string;
  email: string;
  order: number;
}

interface SignatureRequestDialogProps {
  documentId: string;
  documentName: string;
  trigger?: React.ReactNode;
}

// =====================================================
// Main Component
// =====================================================

export function SignatureRequestDialog({
  documentId,
  documentName,
  trigger,
}: SignatureRequestDialogProps) {
  const [open, setOpen] = useState(false);
  const [signers, setSigners] = useState<Signer[]>([
    { name: '', email: '', order: 0 },
  ]);
  const [signingOrder, setSigningOrder] = useState<'sequential' | 'parallel'>('sequential');
  const [subject, setSubject] = useState(`Signature requise : ${documentName}`);
  const [message, setMessage] = useState('Merci de signer ce document.');
  const [step, setStep] = useState<'signers' | 'review'>('signers');

  const utils = api.useUtils();

  // Create signature request mutation
  const createSignatureRequest = api.documents.createSignatureRequest.useMutation({
    onSuccess: () => {
      toast.success('Demande de signature envoyée avec succès');
      setOpen(false);
      utils.documents.listUploaded.invalidate();
      utils.documents.getSignatureStatus.invalidate({ documentId });

      // Reset form
      setSigners([{ name: '', email: '', order: 0 }]);
      setSubject(`Signature requise : ${documentName}`);
      setMessage('Merci de signer ce document.');
      setStep('signers');
    },
    onError: (error) => {
      toast.error(error.message || 'Erreur lors de la création de la demande de signature');
    },
  });

  // =====================================================
  // Handlers
  // =====================================================

  const addSigner = () => {
    setSigners([...signers, { name: '', email: '', order: signers.length }]);
  };

  const removeSigner = (index: number) => {
    if (signers.length === 1) {
      toast.error('Au moins un signataire est requis');
      return;
    }

    const newSigners = signers.filter((_, i) => i !== index);
    // Reorder remaining signers
    newSigners.forEach((signer, i) => {
      signer.order = i;
    });
    setSigners(newSigners);
  };

  const updateSigner = (index: number, field: keyof Signer, value: string) => {
    const newSigners = [...signers];
    if (field === 'order') {
      newSigners[index][field] = parseInt(value, 10);
    } else {
      newSigners[index][field] = value;
    }
    setSigners(newSigners);
  };

  const validateSigners = (): boolean => {
    // Check all signers have name and email
    for (const signer of signers) {
      if (!signer.name.trim()) {
        toast.error('Tous les signataires doivent avoir un nom');
        return false;
      }
      if (!signer.email.trim()) {
        toast.error('Tous les signataires doivent avoir un email');
        return false;
      }
      // Basic email validation
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(signer.email)) {
        toast.error(`Email invalide : ${signer.email}`);
        return false;
      }
    }

    // Check for duplicate emails
    const emails = signers.map((s) => s.email.toLowerCase());
    const uniqueEmails = new Set(emails);
    if (emails.length !== uniqueEmails.size) {
      toast.error('Les emails des signataires doivent être uniques');
      return false;
    }

    return true;
  };

  const handleNext = () => {
    if (!validateSigners()) return;
    setStep('review');
  };

  const handleBack = () => {
    setStep('signers');
  };

  const handleSubmit = async () => {
    if (!validateSigners()) return;

    try {
      await createSignatureRequest.mutateAsync({
        documentId,
        signers: signers.map((s, i) => ({
          name: s.name,
          email: s.email,
          order: signingOrder === 'sequential' ? i : undefined,
        })),
        title: documentName,
        subject,
        message,
        signingOrder,
      });
    } catch (error) {
      // Error handled by mutation
    }
  };

  // =====================================================
  // Render
  // =====================================================

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm" className="min-h-[44px]">
            <PenLine className="h-4 w-4 mr-2" />
            Demander une signature
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PenLine className="h-5 w-5" />
            Demande de signature électronique
          </DialogTitle>
          <DialogDescription>
            Document : <span className="font-medium text-foreground">{documentName}</span>
          </DialogDescription>
        </DialogHeader>

        {/* Progress indicator */}
        <div className="flex items-center gap-2 mb-4">
          <div
            className={`flex items-center gap-2 ${
              step === 'signers' ? 'text-primary' : 'text-muted-foreground'
            }`}
          >
            <div
              className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-semibold ${
                step === 'signers' ? 'bg-primary text-primary-foreground' : 'bg-muted'
              }`}
            >
              1
            </div>
            <span className="text-sm">Signataires</span>
          </div>
          <div className="flex-1 h-px bg-border" />
          <div
            className={`flex items-center gap-2 ${
              step === 'review' ? 'text-primary' : 'text-muted-foreground'
            }`}
          >
            <div
              className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-semibold ${
                step === 'review' ? 'bg-primary text-primary-foreground' : 'bg-muted'
              }`}
            >
              2
            </div>
            <span className="text-sm">Révision</span>
          </div>
        </div>

        <Separator />

        {/* Step 1: Add Signers */}
        {step === 'signers' && (
          <div className="space-y-6 py-4">
            {/* Signing order */}
            <div>
              <Label>Ordre de signature</Label>
              <Select value={signingOrder} onValueChange={(v: 'sequential' | 'parallel') => setSigningOrder(v)}>
                <SelectTrigger className="min-h-[48px] mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sequential">
                    Séquentiel (un par un dans l'ordre)
                  </SelectItem>
                  <SelectItem value="parallel">
                    Parallèle (tous en même temps)
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                {signingOrder === 'sequential'
                  ? 'Chaque signataire reçoit l\'email uniquement après que le précédent a signé'
                  : 'Tous les signataires reçoivent l\'email en même temps'}
              </p>
            </div>

            {/* Signers list */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <Label className="text-base">
                  Signataires ({signers.length})
                </Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addSigner}
                  className="min-h-[44px]"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Ajouter
                </Button>
              </div>

              <div className="space-y-4">
                {signers.map((signer, index) => (
                  <div
                    key={index}
                    className="p-4 border rounded-lg space-y-3 relative"
                  >
                    {/* Order badge for sequential signing */}
                    {signingOrder === 'sequential' && (
                      <Badge variant="secondary" className="absolute top-2 right-2">
                        #{index + 1}
                      </Badge>
                    )}

                    {/* Name field */}
                    <div>
                      <Label htmlFor={`signer-name-${index}`} className="text-sm">
                        Nom complet
                      </Label>
                      <Input
                        id={`signer-name-${index}`}
                        placeholder="Jean Dupont"
                        value={signer.name}
                        onChange={(e) => updateSigner(index, 'name', e.target.value)}
                        className="min-h-[48px] mt-1"
                      />
                    </div>

                    {/* Email field */}
                    <div>
                      <Label htmlFor={`signer-email-${index}`} className="text-sm">
                        Email
                      </Label>
                      <Input
                        id={`signer-email-${index}`}
                        type="email"
                        placeholder="jean@example.com"
                        value={signer.email}
                        onChange={(e) => updateSigner(index, 'email', e.target.value)}
                        className="min-h-[48px] mt-1"
                      />
                    </div>

                    {/* Remove button */}
                    {signers.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeSigner(index)}
                        className="w-full text-destructive hover:text-destructive min-h-[44px]"
                      >
                        <X className="h-4 w-4 mr-2" />
                        Retirer ce signataire
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Email customization */}
            <div className="space-y-3">
              <Label>Personnaliser l'email (optionnel)</Label>

              <div>
                <Label htmlFor="subject" className="text-sm text-muted-foreground">
                  Objet de l'email
                </Label>
                <Input
                  id="subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="min-h-[48px] mt-1"
                  placeholder="Signature requise : ..."
                />
              </div>

              <div>
                <Label htmlFor="message" className="text-sm text-muted-foreground">
                  Message personnel
                </Label>
                <Textarea
                  id="message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="min-h-[100px] mt-1"
                  placeholder="Merci de signer ce document..."
                />
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Review */}
        {step === 'review' && (
          <div className="space-y-6 py-4">
            {/* Summary */}
            <div className="p-4 bg-muted rounded-lg space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <Users className="h-4 w-4" />
                <span className="font-medium">
                  {signers.length} signataire{signers.length > 1 ? 's' : ''}
                </span>
                <span className="text-muted-foreground">·</span>
                <span className="text-muted-foreground">
                  {signingOrder === 'sequential' ? 'Séquentiel' : 'Parallèle'}
                </span>
              </div>

              {/* Signers list */}
              <div className="space-y-2 mt-3">
                {signers.map((signer, index) => (
                  <div
                    key={index}
                    className="flex items-start gap-3 p-3 bg-background rounded-md text-sm"
                  >
                    {signingOrder === 'sequential' && (
                      <Badge variant="secondary" className="shrink-0">
                        #{index + 1}
                      </Badge>
                    )}
                    <div className="flex-1">
                      <div className="font-medium">{signer.name}</div>
                      <div className="text-muted-foreground text-xs">{signer.email}</div>
                    </div>
                    <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                  </div>
                ))}
              </div>
            </div>

            {/* Email preview */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-base">
                <Mail className="h-4 w-4" />
                Aperçu de l'email
              </Label>
              <div className="p-4 border rounded-lg space-y-3 text-sm">
                <div>
                  <span className="text-muted-foreground">Objet :</span>
                  <p className="font-medium mt-1">{subject}</p>
                </div>
                <Separator />
                <div>
                  <span className="text-muted-foreground">Message :</span>
                  <p className="mt-1 whitespace-pre-wrap">{message}</p>
                </div>
              </div>
            </div>

            {/* Estimated timeline */}
            <div className="p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg text-sm">
              <div className="flex items-start gap-3">
                <MessageSquare className="h-5 w-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-medium text-blue-900 dark:text-blue-100">
                    Délai estimé
                  </div>
                  <p className="text-blue-700 dark:text-blue-300 mt-1">
                    {signingOrder === 'sequential'
                      ? `${signers.length} jour${signers.length > 1 ? 's' : ''} (si chaque signataire signe dans les 24h)`
                      : 'Généralement sous 24 heures'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Footer buttons */}
        <DialogFooter className="gap-2">
          {step === 'signers' ? (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                className="min-h-[44px]"
              >
                Annuler
              </Button>
              <Button
                type="button"
                onClick={handleNext}
                className="min-h-[44px]"
              >
                Suivant
              </Button>
            </>
          ) : (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={handleBack}
                className="min-h-[44px]"
                disabled={createSignatureRequest.isPending}
              >
                Retour
              </Button>
              <Button
                type="button"
                onClick={handleSubmit}
                disabled={createSignatureRequest.isPending}
                className="min-h-[44px]"
              >
                {createSignatureRequest.isPending ? (
                  <>
                    <span className="animate-spin mr-2">⏳</span>
                    Envoi en cours...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Envoyer la demande
                  </>
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
