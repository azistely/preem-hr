/**
 * Forgot Password Page
 *
 * Allows users to request a password reset email
 */

'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, Loader2, Mail } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { PreemLogo } from '@/components/brand/preem-logo';
import { requestPasswordReset } from './actions';

const forgotPasswordSchema = z.object({
  email: z.string().email({ message: 'Email invalide' }),
});

type ForgotPasswordData = z.infer<typeof forgotPasswordSchema>;

export default function ForgotPasswordPage() {
  const [isPending, startTransition] = useTransition();
  const [emailSent, setEmailSent] = useState(false);
  const [sentEmail, setSentEmail] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordData>({
    resolver: zodResolver(forgotPasswordSchema),
  });

  const onSubmit = async (data: ForgotPasswordData) => {
    startTransition(async () => {
      const result = await requestPasswordReset(data.email);

      if (result.success) {
        setEmailSent(true);
        setSentEmail(data.email);
        toast.success('Email envoyé', {
          description: 'Vérifiez votre boîte de réception',
        });
      } else {
        toast.error('Erreur', {
          description: result.error,
        });
      }
    });
  };

  if (emailSent) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-preem-teal-50 via-white to-preem-navy-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="mb-6 flex items-center justify-between">
            <Link href="/login">
              <Button variant="ghost" className="min-h-[44px]">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Retour
              </Button>
            </Link>
            <PreemLogo size="default" />
          </div>

          <Card className="border-2 border-preem-teal/20">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-preem-teal/10">
                <Mail className="h-8 w-8 text-preem-teal" />
              </div>
              <CardTitle className="text-2xl">Email envoyé</CardTitle>
              <CardDescription>
                Vérifiez votre boîte de réception
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4 text-center">
              <p className="text-sm">
                Si un compte existe avec l&apos;adresse <strong>{sentEmail}</strong>, vous recevrez un email avec un lien pour réinitialiser votre mot de passe.
              </p>
              <p className="text-sm text-muted-foreground">
                Vérifiez également votre dossier spam.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-preem-teal-50 via-white to-preem-navy-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-between">
          <Link href="/login">
            <Button variant="ghost" className="min-h-[44px]">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Retour
            </Button>
          </Link>
          <PreemLogo size="default" />
        </div>

        <Card className="border-2 border-preem-teal/20">
          <CardHeader className="text-center">
            <CardTitle className="text-3xl">Mot de passe oublié</CardTitle>
            <CardDescription className="text-base">
              Entrez votre email pour réinitialiser votre mot de passe
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-base">
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="votre@email.com"
                  className="min-h-[48px] text-base"
                  {...register('email')}
                  disabled={isPending}
                  autoComplete="email"
                />
                {errors.email && (
                  <p className="text-sm text-destructive">{errors.email.message}</p>
                )}
              </div>

              <Button
                type="submit"
                className="w-full min-h-[56px] text-lg"
                disabled={isPending}
              >
                {isPending ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Envoi en cours...
                  </>
                ) : (
                  <>
                    Envoyer le lien
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
