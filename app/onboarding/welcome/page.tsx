'use client';

import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sparkles, Clock, CheckCircle2 } from 'lucide-react';

export default function WelcomePage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-green-50 flex items-center justify-center px-4 py-8">
      <Card className="w-full max-w-2xl">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
            <Sparkles className="h-8 w-8 text-primary" />
          </div>

          <div>
            <h1 className="text-3xl md:text-4xl font-bold mb-2">
              Bienvenue sur Jamana !
            </h1>
            <p className="text-lg text-muted-foreground">
              Configurons votre espace en quelques minutes
            </p>
          </div>
        </CardHeader>

        <CardContent className="space-y-8">
          {/* What to expect */}
          <div>
            <h2 className="font-semibold text-lg mb-4">
              Ce que vous allez faire :
            </h2>

            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-sm font-bold text-primary">1</span>
                </div>
                <div>
                  <p className="font-medium">Répondre à quelques questions</p>
                  <p className="text-sm text-muted-foreground">
                    7 questions simples sur votre entreprise (~2 minutes)
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-sm font-bold text-primary">2</span>
                </div>
                <div>
                  <p className="font-medium">Configuration personnalisée</p>
                  <p className="text-sm text-muted-foreground">
                    Nous adaptons le parcours à vos besoins
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-sm font-bold text-primary">3</span>
                </div>
                <div>
                  <p className="font-medium">Prêt à utiliser !</p>
                  <p className="text-sm text-muted-foreground">
                    Lancez votre première paie immédiatement
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Time estimate */}
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Clock className="h-5 w-5 text-primary" />
                <div>
                  <p className="font-medium text-sm">Temps estimé</p>
                  <p className="text-sm text-muted-foreground">
                    5 à 15 minutes selon la taille de votre entreprise
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Features */}
          <div>
            <h2 className="font-semibold text-lg mb-4">
              Pourquoi Jamana ?
            </h2>

            <div className="grid gap-3">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                <p className="text-sm">
                  <strong>Simple :</strong> Aucune connaissance en paie requise
                </p>
              </div>

              <div className="flex items-start gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                <p className="text-sm">
                  <strong>Automatique :</strong> CNPS, ITS calculés automatiquement
                </p>
              </div>

              <div className="flex items-start gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                <p className="text-sm">
                  <strong>Mobile :</strong> Fonctionne sur téléphone et ordinateur
                </p>
              </div>

              <div className="flex items-start gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                <p className="text-sm">
                  <strong>Conforme :</strong> Respecte le Code du Travail ivoirien
                </p>
              </div>
            </div>
          </div>

          {/* CTA */}
          <div className="space-y-3">
            <Button
              onClick={() => router.push('/onboarding/questionnaire')}
              className="w-full min-h-[56px] text-lg"
            >
              Commencer la configuration
            </Button>

            <p className="text-center text-sm text-muted-foreground">
              💡 Vous pourrez interrompre et reprendre à tout moment
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
