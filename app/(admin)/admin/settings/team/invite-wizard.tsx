/**
 * Invite Wizard Component
 *
 * Simple 2-step wizard for inviting users:
 * 1. Enter email and select role
 * 2. Choose to send email or copy link
 *
 * Design principles:
 * - Large touch targets (min 44px)
 * - Clear French messages
 * - Instant feedback
 */

'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  ArrowRight,
  Loader2,
  Mail,
  Link2,
  Check,
  Users,
  Shield,
  Crown,
  Copy,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { api } from '@/trpc/react';

interface InviteWizardProps {
  onSuccess: () => void;
  onCancel: () => void;
  prefilledEmail?: string;
  prefilledEmployeeId?: string;
}

/**
 * Role options with French labels
 */
const roleOptions = [
  {
    value: 'employee',
    label: 'Employe',
    description: 'Consulter ses informations et demander des conges',
    icon: Users,
  },
  {
    value: 'manager',
    label: 'Manager',
    description: 'Gerer son equipe et approuver les demandes',
    icon: Users,
  },
  {
    value: 'hr_manager',
    label: 'Gestionnaire RH',
    description: 'Gerer les employes, la paie et les RH',
    icon: Shield,
  },
  {
    value: 'tenant_admin',
    label: 'Administrateur',
    description: 'Acces complet a toutes les fonctionnalites',
    icon: Crown,
  },
] as const;

/**
 * Form validation schema
 * Email is optional - can create link-only invites for employees without email
 */
const inviteSchema = z.object({
  email: z.string().optional(),
  role: z.enum(['employee', 'manager', 'hr_manager', 'tenant_admin'], {
    errorMap: () => ({ message: 'Selectionnez un role' }),
  }),
  sendEmail: z.boolean(),
  personalMessage: z.string().max(500).optional(),
}).superRefine((data, ctx) => {
  // Validate email format if provided and non-empty
  if (data.email && data.email.trim() !== '') {
    const emailResult = z.string().email().safeParse(data.email);
    if (!emailResult.success) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Email invalide',
        path: ['email'],
      });
    }
  }

  // If sendEmail is true, email is required
  if (data.sendEmail && (!data.email || data.email.trim() === '')) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Un email est requis pour envoyer l\'invitation par email',
      path: ['email'],
    });
  }
});

type InviteFormData = z.infer<typeof inviteSchema>;

export function InviteWizard({
  onSuccess,
  onCancel,
  prefilledEmail,
  prefilledEmployeeId,
}: InviteWizardProps) {
  const [step, setStep] = useState<'form' | 'success'>('form');
  const [inviteResult, setInviteResult] = useState<{
    inviteUrl: string;
    emailSent: boolean;
  } | null>(null);
  const [showMessage, setShowMessage] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<InviteFormData>({
    resolver: zodResolver(inviteSchema),
    defaultValues: {
      email: prefilledEmail || '',
      role: 'employee',
      sendEmail: !!prefilledEmail, // Default to sending email if email is prefilled
      personalMessage: '',
    },
  });

  const selectedRole = watch('role');
  const sendEmail = watch('sendEmail');

  // Create invitation mutation
  const createMutation = api.invitations.create.useMutation({
    onSuccess: (data) => {
      setInviteResult({
        inviteUrl: data.invitation.inviteUrl,
        emailSent: data.emailSent,
      });
      setStep('success');
    },
    onError: (error: { message?: string }) => {
      toast.error(error.message || 'Erreur lors de la creation de l\'invitation');
    },
  });

  const onSubmit = (data: InviteFormData) => {
    // Convert empty string email to undefined
    const email = data.email && data.email.trim() !== '' ? data.email : undefined;

    createMutation.mutate({
      email,
      role: data.role,
      employeeId: prefilledEmployeeId,
      sendEmail: data.sendEmail,
      personalMessage: data.personalMessage || undefined,
    });
  };

  const handleCopyLink = () => {
    if (inviteResult?.inviteUrl) {
      navigator.clipboard.writeText(inviteResult.inviteUrl);
      toast.success('Lien copie !');
    }
  };

  // Step 1: Form
  if (step === 'form') {
    return (
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Email */}
        <div className="space-y-2">
          <Label htmlFor="email">
            Email de la personne a inviter
            <span className="text-muted-foreground font-normal"> (optionnel)</span>
          </Label>
          <Input
            id="email"
            type="email"
            {...register('email')}
            placeholder="jean.dupont@exemple.com"
            className="min-h-[48px]"
            disabled={!!prefilledEmail}
          />
          <p className="text-sm text-muted-foreground">
            {sendEmail
              ? 'L\'email est requis pour envoyer l\'invitation par email.'
              : 'Laissez vide pour generer un lien d\'invitation seulement.'}
          </p>
          {errors.email && (
            <p className="text-sm text-destructive">{errors.email.message}</p>
          )}
        </div>

        {/* Role selection */}
        <div className="space-y-3">
          <Label>Role</Label>
          <RadioGroup
            value={selectedRole}
            onValueChange={(value) => setValue('role', value as InviteFormData['role'])}
            className="space-y-2"
          >
            {roleOptions.map((option) => {
              const Icon = option.icon;
              return (
                <label
                  key={option.value}
                  className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                    selectedRole === option.value
                      ? 'border-preem-teal bg-preem-teal/5'
                      : 'border-border hover:border-muted-foreground'
                  }`}
                >
                  <RadioGroupItem value={option.value} className="sr-only" />
                  <div
                    className={`flex items-center justify-center h-10 w-10 rounded-full ${
                      selectedRole === option.value
                        ? 'bg-preem-teal text-white'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <div className="font-medium">{option.label}</div>
                    <div className="text-sm text-muted-foreground">
                      {option.description}
                    </div>
                  </div>
                  {selectedRole === option.value && (
                    <Check className="h-5 w-5 text-preem-teal" />
                  )}
                </label>
              );
            })}
          </RadioGroup>
          {errors.role && (
            <p className="text-sm text-destructive">{errors.role.message}</p>
          )}
        </div>

        {/* Send email option */}
        <div className="flex items-center space-x-2">
          <Checkbox
            id="sendEmail"
            checked={sendEmail}
            onCheckedChange={(checked) => setValue('sendEmail', checked as boolean)}
          />
          <Label htmlFor="sendEmail" className="cursor-pointer">
            Envoyer l'invitation par email
          </Label>
        </div>

        {/* Personal message (optional) */}
        {sendEmail && (
          <div className="space-y-2">
            {!showMessage ? (
              <Button
                type="button"
                variant="link"
                size="sm"
                onClick={() => setShowMessage(true)}
                className="p-0 h-auto text-preem-teal"
              >
                + Ajouter un message personnalise
              </Button>
            ) : (
              <>
                <Label htmlFor="personalMessage">Message personnalise (optionnel)</Label>
                <Textarea
                  id="personalMessage"
                  {...register('personalMessage')}
                  placeholder="Bienvenue dans l'equipe !"
                  className="min-h-[80px]"
                  maxLength={500}
                />
              </>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            className="flex-1 min-h-[44px]"
          >
            Annuler
          </Button>
          <Button
            type="submit"
            disabled={createMutation.isPending}
            className="flex-1 min-h-[44px] bg-preem-teal hover:bg-preem-teal-700"
          >
            {createMutation.isPending ? (
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            ) : sendEmail ? (
              <Mail className="mr-2 h-5 w-5" />
            ) : (
              <Link2 className="mr-2 h-5 w-5" />
            )}
            {sendEmail ? 'Envoyer l\'invitation' : 'Generer le lien'}
          </Button>
        </div>
      </form>
    );
  }

  // Step 2: Success
  return (
    <div className="space-y-6 text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
        <Check className="h-8 w-8 text-green-600" />
      </div>

      <div>
        <h3 className="text-lg font-semibold">Invitation creee !</h3>
        <p className="text-muted-foreground mt-1">
          {inviteResult?.emailSent
            ? 'L\'email d\'invitation a ete envoye.'
            : 'Partagez le lien ci-dessous pour inviter cette personne.'}
        </p>
      </div>

      {/* Invite link */}
      <div className="space-y-2">
        <Label>Lien d'invitation</Label>
        <div className="flex gap-2">
          <Input
            value={inviteResult?.inviteUrl || ''}
            readOnly
            className="min-h-[48px] font-mono text-sm"
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={handleCopyLink}
            className="min-h-[48px] min-w-[48px]"
          >
            <Copy className="h-5 w-5" />
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          Ce lien expire dans 7 jours.
        </p>
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={onSuccess}
          className="flex-1 min-h-[44px]"
        >
          Terminer
        </Button>
        <Button
          type="button"
          onClick={() => {
            setStep('form');
            setInviteResult(null);
            setValue('email', '');
          }}
          className="flex-1 min-h-[44px] bg-preem-teal hover:bg-preem-teal-700"
        >
          Inviter quelqu'un d'autre
        </Button>
      </div>
    </div>
  );
}
