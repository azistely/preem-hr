'use client';

/**
 * Root Error Boundary
 *
 * Catches errors in the application and displays a user-friendly message
 */

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle } from 'lucide-react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error('Application error:', error);
  }, [error]);

  return (
    <div className="container mx-auto py-16 px-4">
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-3 text-destructive">
              <AlertTriangle className="h-6 w-6" />
              Une erreur s'est produite
            </CardTitle>
            <CardDescription>
              Nous nous excusons pour le désagrément. L'erreur a été enregistrée.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-md bg-muted p-4">
              <p className="text-sm font-mono text-muted-foreground">
                {error.message || 'Une erreur inattendue s\'est produite'}
              </p>
              {error.digest && (
                <p className="text-xs text-muted-foreground mt-2">
                  Code d'erreur: {error.digest}
                </p>
              )}
            </div>
            <div className="flex gap-4">
              <Button onClick={reset} className="flex-1">
                Réessayer
              </Button>
              <Button variant="outline" onClick={() => window.location.href = '/'} className="flex-1">
                Retour à l'accueil
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
