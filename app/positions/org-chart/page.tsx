/**
 * Org Chart Page
 *
 * Visual hierarchy tree of positions
 */

'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Network, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { usePositions } from '@/features/employees/hooks/use-positions';

export default function OrgChartPage() {
  const { data: positions, isLoading } = usePositions('active');

  return (
    <div className="container py-8">
      {/* Header */}
      <div className="mb-8">
        <Link href="/positions">
          <Button variant="ghost" className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Retour aux postes
          </Button>
        </Link>
        <div className="flex items-center gap-3">
          <Network className="h-8 w-8" />
          <div>
            <h1 className="text-3xl font-bold">Organigramme</h1>
            <p className="text-muted-foreground mt-1">
              Structure hiérarchique de votre organisation
            </p>
          </div>
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Simple List View (placeholder for full org chart) */}
      {!isLoading && (
        <Card>
          <CardHeader>
            <CardTitle>Postes</CardTitle>
          </CardHeader>
          <CardContent>
            {!positions || positions.length === 0 ? (
              <div className="text-center py-12">
                <Network className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  Aucun poste à afficher dans l'organigramme
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {positions.map((position: any) => (
                  <div
                    key={position.id}
                    className="p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="font-medium text-lg">{position.title}</div>
                    {position.code && (
                      <div className="text-sm text-muted-foreground font-mono">
                        {position.code}
                      </div>
                    )}
                    {position.description && (
                      <div className="text-sm text-muted-foreground mt-2">
                        {position.description}
                      </div>
                    )}
                    <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground">
                      <span>Effectif: {position.headcount || 1}</span>
                      <span>•</span>
                      <span>{position.weeklyHours || 40}h/semaine</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800">
                L'organigramme visuel complet sera implémenté dans une prochaine version.
                Pour l'instant, tous les postes sont listés ci-dessus.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
