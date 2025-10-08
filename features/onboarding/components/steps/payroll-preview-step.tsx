'use client';

import { useState } from 'react';
import { api } from '@/trpc/react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import { HelpBox } from '../help-box';
import { CheckCircle2, TrendingUp, Users, Calculator } from 'lucide-react';

interface PayrollPreviewStepProps {
  onComplete: () => void;
}

export function PayrollPreviewStep({ onComplete }: PayrollPreviewStepProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const completeStep = api.onboarding.completeStep.useMutation();

  const handleContinue = async () => {
    setIsSubmitting(true);

    try {
      await completeStep.mutateAsync({ stepId: 'payroll_preview' });

      toast.success('Configuration validée !');

      // Call parent callback
      onComplete();
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de la validation');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <HelpBox>
        Votre système de paie est prêt ! Voici un aperçu de ce qui sera calculé automatiquement.
      </HelpBox>

      {/* Preview Cards */}
      <div className="grid gap-4">
        <Card className="border-green-200 bg-green-50/50">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-6 w-6 text-green-600 mt-0.5 flex-shrink-0" />
              <div>
                <h3 className="font-semibold mb-1">Calculs automatiques</h3>
                <p className="text-sm text-muted-foreground">
                  CNPS (cotisations sociales), ITS (impôt sur salaire), et déductions seront calculés automatiquement selon les lois ivoiriennes.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-blue-200 bg-blue-50/50">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <Calculator className="h-6 w-6 text-blue-600 mt-0.5 flex-shrink-0" />
              <div>
                <h3 className="font-semibold mb-1">Bulletins de paie conformes</h3>
                <p className="text-sm text-muted-foreground">
                  Chaque mois, vos bulletins de paie seront générés automatiquement avec tous les détails légaux requis.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-purple-200 bg-purple-50/50">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <TrendingUp className="h-6 w-6 text-purple-600 mt-0.5 flex-shrink-0" />
              <div>
                <h3 className="font-semibold mb-1">Déclarations CNPS simplifiées</h3>
                <p className="text-sm text-muted-foreground">
                  Exportez vos déclarations CNPS en un clic pour les soumettre en ligne ou au guichet.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-orange-200 bg-orange-50/50">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <Users className="h-6 w-6 text-orange-600 mt-0.5 flex-shrink-0" />
              <div>
                <h3 className="font-semibold mb-1">Accès employés</h3>
                <p className="text-sm text-muted-foreground">
                  Vos employés pourront consulter leurs bulletins de paie en ligne dès que vous les inviterez.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sample Calculation Preview */}
      <Card>
        <CardContent className="p-4">
          <h3 className="font-semibold mb-3">Exemple de calcul (pour 200,000 FCFA brut)</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Salaire brut</span>
              <span className="font-medium">200,000 FCFA</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">CNPS employé (3.2%)</span>
              <span className="text-destructive">-6,400 FCFA</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">ITS (environ 1.5%)</span>
              <span className="text-destructive">-3,000 FCFA</span>
            </div>
            <div className="border-t pt-2 mt-2 flex justify-between">
              <span className="font-semibold">Salaire net (estimation)</span>
              <span className="font-bold text-primary">~190,600 FCFA</span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            💡 Les calculs exacts dépendent de votre situation (famille, ancienneté, etc.)
          </p>
        </CardContent>
      </Card>

      <Button
        onClick={handleContinue}
        disabled={isSubmitting}
        className="w-full min-h-[48px] text-lg"
      >
        {isSubmitting ? 'Validation...' : 'Tout est prêt, continuer'}
      </Button>
    </div>
  );
}
