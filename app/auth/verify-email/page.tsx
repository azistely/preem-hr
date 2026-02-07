/**
 * Email Verification Pending Page
 *
 * Shows after signup, prompts user to check their email
 */

import Link from 'next/link';
import { Mail, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { JamanaLogo } from '@/components/brand/jamana-logo';

export const dynamic = 'force-dynamic';

export default function VerifyEmailPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-preem-teal-50 via-white to-preem-navy-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-between">
          <Link href="/login">
            <Button variant="ghost" className="min-h-[44px] text-preem-teal hover:text-preem-teal-700 hover:bg-preem-teal/10">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Retour à la connexion
            </Button>
          </Link>
          <JamanaLogo size="default" />
        </div>

        <Card className="border-2 border-preem-teal/20 shadow-preem-teal">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-preem-teal/10">
              <Mail className="h-8 w-8 text-preem-teal" />
            </div>
            <CardTitle className="text-3xl">Vérifiez votre email</CardTitle>
            <CardDescription className="text-base">
              Nous avons envoyé un lien de vérification à votre adresse email
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            <div className="space-y-4 text-center">
              <p className="text-sm text-muted-foreground">
                Cliquez sur le lien dans l&apos;email pour activer votre compte.
              </p>
              <p className="text-sm text-muted-foreground">
                Si vous ne voyez pas l&apos;email, vérifiez votre dossier spam.
              </p>
            </div>

            <div className="border-t pt-6 text-center space-y-3">
              <p className="text-sm text-muted-foreground">
                Vous n&apos;avez pas reçu l&apos;email ?
              </p>
              <p className="text-xs text-muted-foreground">
                Vérifiez votre dossier spam ou réessayez de vous inscrire avec la même adresse email pour recevoir un nouvel email de confirmation.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
