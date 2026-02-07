/**
 * Invite Acceptance Form Component
 *
 * Client component that handles invitation validation and acceptance.
 * Supports PHONE-FIRST signup (default for employees without email)
 * and email signup as alternative.
 */

'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  ArrowRight,
  Loader2,
  Check,
  XCircle,
  Clock,
  UserPlus,
  LogIn,
  Building2,
  Phone,
  Mail,
  RefreshCw,
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { JamanaLogo } from '@/components/brand/jamana-logo';
import { api } from '@/trpc/react';
import { createAuthClient } from '@/lib/supabase/auth-client';

interface InviteAcceptFormProps {
  token: string;
}

/**
 * Role labels in French
 */
const roleLabels: Record<string, string> = {
  employee: 'Employe',
  manager: 'Manager',
  hr_manager: 'Gestionnaire RH',
  tenant_admin: 'Administrateur',
};

/**
 * Loading state while validating token
 */
function LoadingState() {
  return (
    <Card className="border-2 border-preem-teal/20 shadow-preem-teal">
      <CardContent className="py-12">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-12 w-12 animate-spin text-preem-teal" />
          <p className="text-lg text-muted-foreground">Verification de l'invitation...</p>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Error state for invalid/expired tokens
 */
function ErrorState({
  error,
  message,
}: {
  error: 'invalid' | 'used' | 'revoked' | 'expired';
  message: string;
}) {
  const errorIcons = {
    invalid: XCircle,
    used: Check,
    revoked: XCircle,
    expired: Clock,
  };

  const errorColors = {
    invalid: 'text-destructive',
    used: 'text-blue-500',
    revoked: 'text-destructive',
    expired: 'text-amber-500',
  };

  const Icon = errorIcons[error];
  const color = errorColors[error];

  return (
    <Card className="border-2 border-destructive/20">
      <CardContent className="py-12">
        <div className="flex flex-col items-center gap-4 text-center">
          <Icon className={`h-16 w-16 ${color}`} />
          <div>
            <h2 className="text-xl font-semibold">{message}</h2>
            {error === 'expired' && (
              <p className="mt-2 text-sm text-muted-foreground">
                Contactez l'administrateur pour recevoir une nouvelle invitation.
              </p>
            )}
            {error === 'used' && (
              <p className="mt-2 text-sm text-muted-foreground">
                Vous pouvez vous connecter avec votre compte.
              </p>
            )}
          </div>
          <div className="mt-4 flex gap-3">
            <Link href="/login">
              <Button variant="outline" className="min-h-[44px]">
                <LogIn className="mr-2 h-4 w-4" />
                Se connecter
              </Button>
            </Link>
            <Link href="/">
              <Button variant="ghost" className="min-h-[44px]">
                Retour a l'accueil
              </Button>
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Valid invitation display with accept options
 */
function ValidInvitation({
  invitation,
  existingUser,
  onAcceptAsExisting,
  onCreateAccount,
  isAccepting,
}: {
  invitation: {
    id: string;
    email: string | null;
    role: string;
    tenantName: string;
    employeeId: string | null;
  };
  existingUser: { id: string; name: string } | null;
  onAcceptAsExisting: () => void;
  onCreateAccount: () => void;
  isAccepting: boolean;
}) {
  const roleLabel = roleLabels[invitation.role] || invitation.role;

  return (
    <>
      {/* Header */}
      <div className="mb-6 flex items-center justify-center">
        <JamanaLogo size="default" />
      </div>

      <Card className="border-2 border-preem-teal/20 shadow-preem-teal">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-preem-teal/10">
            <Building2 className="h-8 w-8 text-preem-teal" />
          </div>
          <CardTitle className="text-2xl">Invitation a rejoindre</CardTitle>
          <CardDescription className="text-lg font-medium text-foreground">
            {invitation.tenantName}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Invitation details */}
          <div className="rounded-lg bg-muted/50 p-4 space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Role</span>
              <span className="font-medium">{roleLabel}</span>
            </div>
            {invitation.employeeId && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Lien employe</span>
                <span className="font-medium text-green-600">Actif</span>
              </div>
            )}
          </div>

          {/* Accept options */}
          {existingUser ? (
            <div className="space-y-4">
              <p className="text-center text-muted-foreground">
                Un compte existe deja pour <strong>{existingUser.name}</strong>.
              </p>
              <Button
                onClick={onAcceptAsExisting}
                disabled={isAccepting}
                className="w-full min-h-[56px] bg-preem-teal hover:bg-preem-teal-700 text-lg"
              >
                {isAccepting ? (
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                ) : (
                  <LogIn className="mr-2 h-5 w-5" />
                )}
                Se connecter et accepter
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-center text-muted-foreground">
                Creez un compte pour accepter cette invitation.
              </p>
              <Button
                onClick={onCreateAccount}
                disabled={isAccepting}
                className="w-full min-h-[56px] bg-preem-teal hover:bg-preem-teal-700 text-lg"
              >
                {isAccepting ? (
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                ) : (
                  <UserPlus className="mr-2 h-5 w-5" />
                )}
                Creer un compte
              </Button>
            </div>
          )}

          {/* Already have account link */}
          {!existingUser && (
            <div className="text-center border-t pt-4">
              <p className="text-sm text-muted-foreground">
                Vous avez deja un compte ?{' '}
                <Link
                  href={`/login?redirect=/invite/${encodeURIComponent(invitation.id)}`}
                  className="text-preem-teal font-medium hover:underline"
                >
                  Se connecter
                </Link>
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}

/**
 * Phone signup form - DEFAULT for employees
 * Step 1: Enter phone number → receive OTP
 * Step 2: Enter OTP + name → create account
 */
function PhoneSignupForm({
  tenantName,
  inviteToken,
  employee,
  onBack,
  onSwitchToEmail,
}: {
  tenantName: string;
  inviteToken: string;
  employee: { firstName: string; lastName: string; phone: string | null } | null;
  onBack: () => void;
  onSwitchToEmail: () => void;
}) {
  const router = useRouter();
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(0);

  // Phone input schema
  const phoneSchema = z.object({
    phone: z.string().min(10, { message: 'Numero de telephone invalide' }),
  });

  // OTP + name schema
  const otpSchema = z.object({
    token: z.string().length(6, { message: 'Le code doit contenir 6 chiffres' }),
    firstName: z.string().min(1, { message: 'Prenom requis' }),
    lastName: z.string().min(1, { message: 'Nom requis' }),
  });

  // Send OTP mutation
  const sendOtpMutation = api.auth.sendPhoneOtp.useMutation({
    onSuccess: () => {
      toast.success('Code SMS envoye !');
      setStep('otp');
      setCountdown(60);
    },
    onError: (err: { message?: string }) => {
      setError(err.message || 'Erreur lors de l\'envoi du SMS');
    },
  });

  // Complete signup mutation
  const signupMutation = api.auth.signupWithInvitePhone.useMutation({
    onSuccess: async (data) => {
      // Case B: Existing user added to new tenant - needs to log in again
      if (data.needsRelogin) {
        toast.success('Vous avez ete ajoute a la nouvelle entreprise !', {
          description: 'Connectez-vous avec votre numero de telephone.',
          duration: 5000,
        });
        // Redirect to login page
        router.push('/login?phone=true');
        return;
      }

      // Normal case: New user or retry - auto-login with session
      toast.success('Compte cree avec succes !');

      // Set session in Supabase client for auto-login
      if (data.session?.access_token && data.session?.refresh_token) {
        const supabase = createAuthClient();
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        });

        if (sessionError) {
          console.error('Failed to set session:', sessionError);
          // Redirect to login if session setup failed
          toast.info('Veuillez vous connecter');
          router.push('/login?phone=true');
          return;
        }

        // Small delay to ensure cookies are set before navigation
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      // Redirect to dashboard
      router.push('/dashboard');
    },
    onError: (err: { message?: string }) => {
      setError(err.message || 'Erreur lors de la creation du compte');
    },
  });

  // Countdown timer for resend
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  // Phone form - prefill phone from employee data if available
  // Strip +225 prefix if present since we show it separately
  const employeePhone = employee?.phone?.replace(/^\+225/, '') || '';
  const phoneForm = useForm<{ phone: string }>({
    resolver: zodResolver(phoneSchema),
    defaultValues: { phone: employeePhone },
  });

  // OTP form - prefill name from employee data if available
  const otpForm = useForm<{ token: string; firstName: string; lastName: string }>({
    resolver: zodResolver(otpSchema),
    defaultValues: {
      token: '',
      firstName: employee?.firstName || '',
      lastName: employee?.lastName || '',
    },
  });

  const handleSendOtp = (data: { phone: string }) => {
    setError(null);
    // Format phone number (ensure +225 prefix for Cote d'Ivoire)
    let formattedPhone = data.phone.replace(/\s/g, '');
    if (!formattedPhone.startsWith('+')) {
      formattedPhone = '+225' + formattedPhone;
    }
    setPhoneNumber(formattedPhone);
    sendOtpMutation.mutate({ phone: formattedPhone });
  };

  const handleResendOtp = () => {
    if (countdown === 0 && phoneNumber) {
      sendOtpMutation.mutate({ phone: phoneNumber });
    }
  };

  const handleVerifyOtp = (data: { token: string; firstName: string; lastName: string }) => {
    setError(null);
    signupMutation.mutate({
      phone: phoneNumber,
      token: data.token,
      firstName: data.firstName,
      lastName: data.lastName,
      inviteToken,
    });
  };

  const isPending = sendOtpMutation.isPending || signupMutation.isPending;

  return (
    <>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <Button
          variant="ghost"
          onClick={step === 'phone' ? onBack : () => setStep('phone')}
          className="min-h-[44px] text-preem-teal hover:text-preem-teal-700 hover:bg-preem-teal/10"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Retour
        </Button>
        <JamanaLogo size="default" />
      </div>

      <Card className="border-2 border-preem-teal/20 shadow-preem-teal">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-preem-teal/10">
            <Phone className="h-6 w-6 text-preem-teal" />
          </div>
          <CardTitle className="text-2xl">
            {step === 'phone' ? 'Entrez votre numero' : 'Verifiez votre numero'}
          </CardTitle>
          <CardDescription>
            Pour rejoindre <strong>{tenantName}</strong>
          </CardDescription>
        </CardHeader>

        <CardContent>
          {step === 'phone' ? (
            <form onSubmit={phoneForm.handleSubmit(handleSendOtp)} className="space-y-4">
              {/* Phone number */}
              <div className="space-y-2">
                <Label htmlFor="phone">Numero de telephone</Label>
                <div className="flex gap-2">
                  <div className="flex items-center px-3 border rounded-md bg-muted text-sm">
                    +225
                  </div>
                  <Input
                    id="phone"
                    type="tel"
                    {...phoneForm.register('phone')}
                    placeholder="07 XX XX XX XX"
                    className="min-h-[48px] flex-1"
                    autoFocus
                  />
                </div>
                {phoneForm.formState.errors.phone && (
                  <p className="text-sm text-destructive">
                    {phoneForm.formState.errors.phone.message}
                  </p>
                )}
                <p className="text-sm text-muted-foreground">
                  Vous recevrez un code SMS pour verifier votre numero
                </p>
              </div>

              {/* Error message */}
              {error && (
                <div className="rounded-lg bg-destructive/10 p-3 text-destructive text-sm">
                  {error}
                </div>
              )}

              {/* Submit */}
              <Button
                type="submit"
                disabled={isPending}
                className="w-full min-h-[56px] bg-preem-teal hover:bg-preem-teal-700 text-lg mt-6"
              >
                {isPending ? (
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                ) : (
                  <ArrowRight className="mr-2 h-5 w-5" />
                )}
                Recevoir le code SMS
              </Button>

              {/* Switch to email */}
              <div className="text-center border-t pt-4">
                <button
                  type="button"
                  onClick={onSwitchToEmail}
                  className="text-sm text-muted-foreground hover:text-preem-teal"
                >
                  <Mail className="inline mr-1 h-4 w-4" />
                  Preferer utiliser un email ?
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={otpForm.handleSubmit(handleVerifyOtp)} className="space-y-4">
              {/* OTP code */}
              <div className="space-y-2">
                <Label htmlFor="token">Code SMS</Label>
                <Input
                  id="token"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  {...otpForm.register('token')}
                  placeholder="______"
                  className="min-h-[48px] text-center text-2xl tracking-widest font-mono"
                  autoFocus
                />
                {otpForm.formState.errors.token && (
                  <p className="text-sm text-destructive">
                    {otpForm.formState.errors.token.message}
                  </p>
                )}
                <p className="text-sm text-muted-foreground text-center">
                  Code envoye au {phoneNumber}
                </p>
              </div>

              {/* Resend button */}
              <div className="text-center">
                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={countdown > 0 || isPending}
                  className="text-sm text-preem-teal hover:underline disabled:text-muted-foreground disabled:no-underline"
                >
                  <RefreshCw className="inline mr-1 h-3 w-3" />
                  {countdown > 0 ? `Renvoyer dans ${countdown}s` : 'Renvoyer le code'}
                </button>
              </div>

              {/* Name fields */}
              <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                <div className="space-y-2">
                  <Label htmlFor="firstName">Prenom</Label>
                  <Input
                    id="firstName"
                    {...otpForm.register('firstName')}
                    placeholder="Jean"
                    className="min-h-[48px]"
                  />
                  {otpForm.formState.errors.firstName && (
                    <p className="text-sm text-destructive">
                      {otpForm.formState.errors.firstName.message}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Nom</Label>
                  <Input
                    id="lastName"
                    {...otpForm.register('lastName')}
                    placeholder="Dupont"
                    className="min-h-[48px]"
                  />
                  {otpForm.formState.errors.lastName && (
                    <p className="text-sm text-destructive">
                      {otpForm.formState.errors.lastName.message}
                    </p>
                  )}
                </div>
              </div>

              {/* Error message */}
              {error && (
                <div className="rounded-lg bg-destructive/10 p-3 text-destructive text-sm">
                  {error}
                </div>
              )}

              {/* Submit */}
              <Button
                type="submit"
                disabled={isPending}
                className="w-full min-h-[56px] bg-preem-teal hover:bg-preem-teal-700 text-lg mt-6"
              >
                {isPending ? (
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                ) : (
                  <Check className="mr-2 h-5 w-5" />
                )}
                Creer mon compte
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </>
  );
}

/**
 * Email signup form - Alternative for users who prefer email
 */
const emailSignupSchema = z
  .object({
    email: z.string().email({ message: 'Email invalide' }),
    firstName: z.string().min(2, { message: 'Prenom requis (min 2 caracteres)' }),
    lastName: z.string().min(2, { message: 'Nom requis (min 2 caracteres)' }),
    password: z.string().min(8, { message: 'Mot de passe requis (min 8 caracteres)' }),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Les mots de passe ne correspondent pas',
    path: ['confirmPassword'],
  });

type EmailSignupFormData = z.infer<typeof emailSignupSchema>;

function EmailSignupForm({
  prefilledEmail,
  tenantName,
  token,
  employee,
  onBack,
  onSwitchToPhone,
}: {
  prefilledEmail: string | null;
  tenantName: string;
  token: string;
  employee: { firstName: string; lastName: string; phone: string | null } | null;
  onBack: () => void;
  onSwitchToPhone: () => void;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  const signupMutation = api.auth.signupWithInvite.useMutation({
    onSuccess: () => {
      toast.success('Compte cree avec succes ! Verifiez votre email pour confirmer.');
      router.push('/login?message=check-email');
    },
    onError: (err: { message?: string }) => {
      setError(err.message || 'Erreur lors de la creation du compte');
    },
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<EmailSignupFormData>({
    resolver: zodResolver(emailSignupSchema),
    defaultValues: {
      email: prefilledEmail || '',
      firstName: employee?.firstName || '',
      lastName: employee?.lastName || '',
    },
  });

  const onSubmit = async (data: EmailSignupFormData) => {
    setError(null);
    signupMutation.mutate({
      email: data.email,
      firstName: data.firstName,
      lastName: data.lastName,
      password: data.password,
      inviteToken: token,
    });
  };

  const isPending = signupMutation.isPending;
  const isEmailEditable = !prefilledEmail;

  return (
    <>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <Button
          variant="ghost"
          onClick={onBack}
          className="min-h-[44px] text-preem-teal hover:text-preem-teal-700 hover:bg-preem-teal/10"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Retour
        </Button>
        <JamanaLogo size="default" />
      </div>

      <Card className="border-2 border-preem-teal/20 shadow-preem-teal">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-preem-teal/10">
            <Mail className="h-6 w-6 text-preem-teal" />
          </div>
          <CardTitle className="text-2xl">Creer votre compte</CardTitle>
          <CardDescription>
            Pour rejoindre <strong>{tenantName}</strong>
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                {...register('email')}
                placeholder="votre.email@exemple.com"
                disabled={!isEmailEditable}
                className={`min-h-[48px] ${!isEmailEditable ? 'bg-muted' : ''}`}
                autoFocus={isEmailEditable}
              />
              {errors.email && (
                <p className="text-sm text-destructive">{errors.email.message}</p>
              )}
            </div>

            {/* Name fields */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">Prenom</Label>
                <Input
                  id="firstName"
                  {...register('firstName')}
                  placeholder="Jean"
                  className="min-h-[48px]"
                  autoFocus={!isEmailEditable}
                />
                {errors.firstName && (
                  <p className="text-sm text-destructive">{errors.firstName.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Nom</Label>
                <Input
                  id="lastName"
                  {...register('lastName')}
                  placeholder="Dupont"
                  className="min-h-[48px]"
                />
                {errors.lastName && (
                  <p className="text-sm text-destructive">{errors.lastName.message}</p>
                )}
              </div>
            </div>

            {/* Password */}
            <div className="space-y-2">
              <Label htmlFor="password">Mot de passe</Label>
              <Input
                id="password"
                type="password"
                {...register('password')}
                placeholder="Min. 8 caracteres"
                className="min-h-[48px]"
              />
              {errors.password && (
                <p className="text-sm text-destructive">{errors.password.message}</p>
              )}
            </div>

            {/* Confirm Password */}
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmer le mot de passe</Label>
              <Input
                id="confirmPassword"
                type="password"
                {...register('confirmPassword')}
                placeholder="Repetez le mot de passe"
                className="min-h-[48px]"
              />
              {errors.confirmPassword && (
                <p className="text-sm text-destructive">{errors.confirmPassword.message}</p>
              )}
            </div>

            {/* Error message */}
            {error && (
              <div className="rounded-lg bg-destructive/10 p-3 text-destructive text-sm">
                {error}
              </div>
            )}

            {/* Submit */}
            <Button
              type="submit"
              disabled={isPending}
              className="w-full min-h-[56px] bg-preem-teal hover:bg-preem-teal-700 text-lg mt-6"
            >
              {isPending ? (
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              ) : (
                <ArrowRight className="mr-2 h-5 w-5" />
              )}
              Creer mon compte
            </Button>

            {/* Switch to phone */}
            <div className="text-center border-t pt-4">
              <button
                type="button"
                onClick={onSwitchToPhone}
                className="text-sm text-muted-foreground hover:text-preem-teal"
              >
                <Phone className="inline mr-1 h-4 w-4" />
                Preferer utiliser un numero de telephone ?
              </button>
            </div>
          </form>
        </CardContent>
      </Card>
    </>
  );
}

/**
 * Main invite acceptance form
 */
export function InviteAcceptForm({ token }: InviteAcceptFormProps) {
  const router = useRouter();
  const [step, setStep] = useState<'loading' | 'valid' | 'phone-signup' | 'email-signup' | 'error'>(
    'loading'
  );
  const [errorInfo, setErrorInfo] = useState<{
    error: 'invalid' | 'used' | 'revoked' | 'expired';
    message: string;
  } | null>(null);
  const [invitationData, setInvitationData] = useState<{
    invitation: {
      id: string;
      email: string | null;
      role: string;
      tenantName: string;
      employeeId: string | null;
    };
    employee: { firstName: string; lastName: string; phone: string | null } | null;
    existingUser: { id: string; name: string } | null;
  } | null>(null);
  const [isAccepting, setIsAccepting] = useState(false);

  // Validate token on mount
  const {
    data: validationResult,
    isLoading,
    error: queryError,
  } = api.invitations.validateToken.useQuery({ token }, { retry: false });

  // Handle validation result
  useEffect(() => {
    if (isLoading) return;

    if (queryError) {
      setErrorInfo({ error: 'invalid', message: 'Erreur lors de la verification' });
      setStep('error');
      return;
    }

    if (!validationResult) return;

    if (!validationResult.valid) {
      const invalidResult = validationResult as {
        valid: false;
        error: 'invalid' | 'used' | 'revoked' | 'expired';
        message: string;
      };
      setErrorInfo({
        error: invalidResult.error,
        message: invalidResult.message,
      });
      setStep('error');
    } else {
      const validResult = validationResult as {
        valid: true;
        invitation: {
          id: string;
          email: string | null;
          role: string;
          tenantName: string;
          employeeId: string | null;
        };
        employee: { firstName: string; lastName: string; phone: string | null } | null;
        existingUser: { id: string; name: string } | null;
      };
      setInvitationData({
        invitation: validResult.invitation,
        employee: validResult.employee,
        existingUser: validResult.existingUser,
      });

      // If no existing user, go directly to phone signup (skip intermediate screen)
      // If existing user found, show options to login or create new account
      if (!validResult.existingUser) {
        setStep('phone-signup');
      } else {
        setStep('valid');
      }
    }
  }, [validationResult, isLoading, queryError]);

  // Handle accept as existing user
  const handleAcceptAsExisting = () => {
    const returnUrl = `/invite/${encodeURIComponent(token)}/accept`;
    router.push(`/login?redirect=${encodeURIComponent(returnUrl)}`);
  };

  // Handle create new account - go to phone signup by default
  const handleCreateAccount = () => {
    setStep('phone-signup');
  };

  // Render based on step
  if (step === 'loading' || isLoading) {
    return <LoadingState />;
  }

  if (step === 'error' && errorInfo) {
    return <ErrorState error={errorInfo.error} message={errorInfo.message} />;
  }

  if (step === 'phone-signup' && invitationData) {
    return (
      <PhoneSignupForm
        tenantName={invitationData.invitation.tenantName}
        inviteToken={token}
        employee={invitationData.employee}
        onBack={() => setStep('valid')}
        onSwitchToEmail={() => setStep('email-signup')}
      />
    );
  }

  if (step === 'email-signup' && invitationData) {
    return (
      <EmailSignupForm
        prefilledEmail={invitationData.invitation.email}
        tenantName={invitationData.invitation.tenantName}
        token={token}
        employee={invitationData.employee}
        onBack={() => setStep('valid')}
        onSwitchToPhone={() => setStep('phone-signup')}
      />
    );
  }

  if (step === 'valid' && invitationData) {
    return (
      <ValidInvitation
        invitation={invitationData.invitation}
        existingUser={invitationData.existingUser}
        onAcceptAsExisting={handleAcceptAsExisting}
        onCreateAccount={handleCreateAccount}
        isAccepting={isAccepting}
      />
    );
  }

  return <LoadingState />;
}
