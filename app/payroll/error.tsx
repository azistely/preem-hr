'use client';

/**
 * Payroll Module Error Boundary
 */

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Calculator, AlertTriangle } from 'lucide-react';

export default function PayrollError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Payroll module error:', error);
  }, [error]);

  return (
    <div className="container mx-auto py-16 px-4">
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <Calculator className="h-6 w-6" />
              Erreur de Calcul de Paie
            </CardTitle>
            <CardDescription>
              Une erreur s'est produite lors du calcul de la paie
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-md bg-destructive/15 p-4 flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-destructive mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-destructive mb-1">
                  Détails de l'erreur:
                </p>
                <p className="text-sm text-muted-foreground">
                  {error.message || 'Erreur de calcul inattendue'}
                </p>
              </div>
            </div>

            <div className="text-sm text-muted-foreground space-y-2">
              <p>Suggestions:</p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>Vérifiez que tous les montants sont corrects</li>
                <li>Assurez-vous que le salaire de base est supérieur au SMIG (75 000 FCFA)</li>
                <li>Si le problème persiste, contactez le support technique</li>
              </ul>
            </div>

            <div className="flex gap-4">
              <Button onClick={reset} className="flex-1">
                Réessayer
              </Button>
              <Button variant="outline" onClick={() => window.location.href = '/payroll/calculator'} className="flex-1">
                Recommencer
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
