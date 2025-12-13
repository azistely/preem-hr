/**
 * Positions List Page
 *
 * Lists all positions with create/edit actions.
 * Supports ?filter=missing-competencies to show only positions without competencies.
 */

'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Plus, Briefcase, Loader2, Network, AlertTriangle, X } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { usePositions } from '@/features/employees/hooks/use-positions';
import { formatCurrency } from '@/features/employees/hooks/use-salary-validation';
import { api } from '@/trpc/react';
import { useMemo } from 'react';

export default function PositionsPage() {
  const searchParams = useSearchParams();
  const filterMissing = searchParams.get('filter') === 'missing-competencies';

  const { data: positions, isLoading, error } = usePositions('active');

  // Fetch positions with missing competencies when filtered
  const { data: positionsWithMissing, isLoading: missingLoading } =
    api.performance.positionCompetencies.listMissing.useQuery(undefined, {
      enabled: filterMissing,
    });

  // Create a Set of position IDs with missing competencies for efficient lookup
  const missingCompetenciesIds = useMemo(() => {
    if (!positionsWithMissing) return new Set<string>();
    return new Set(positionsWithMissing.map((p) => p.id));
  }, [positionsWithMissing]);

  // Filter positions based on the filter query param
  const displayedPositions = useMemo(() => {
    if (!positions) return [];
    if (!filterMissing) return positions;
    return positions.filter((p: any) => missingCompetenciesIds.has(p.id));
  }, [positions, filterMissing, missingCompetenciesIds]);

  const isLoadingAny = isLoading || (filterMissing && missingLoading);

  return (
    <div className="container mx-auto py-8">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Briefcase className="h-8 w-8" />
            Postes
          </h1>
          <p className="text-muted-foreground mt-2">
            Gérez les postes et la structure organisationnelle
          </p>
        </div>

        <div className="flex gap-2">
          <Link href="/positions/org-chart">
            <Button variant="outline" className="min-h-[44px]">
              <Network className="mr-2 h-4 w-4" />
              Organigramme
            </Button>
          </Link>
          <Link href="/positions/new">
            <Button className="min-h-[56px]">
              <Plus className="mr-2 h-5 w-5" />
              Créer un poste
            </Button>
          </Link>
        </div>
      </div>

      {/* Filter Alert Banner */}
      {filterMissing && (
        <Alert variant="destructive" className="mb-6">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>
              Ces postes n&apos;ont pas de compétences définies. Ajoutez des compétences pour pouvoir
              lancer le cycle d&apos;évaluation.
            </span>
            <Link href="/positions">
              <Button variant="outline" size="sm" className="ml-4">
                <X className="h-4 w-4 mr-1" />
                Voir tous les postes
              </Button>
            </Link>
          </AlertDescription>
        </Alert>
      )}

      {/* Loading State */}
      {isLoadingAny && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Error State */}
      {error && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <p className="text-destructive text-center">
              Erreur lors du chargement des postes: {error.message}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Positions Table */}
      {!isLoadingAny && !error && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>
                {filterMissing ? 'Postes sans compétences' : 'Tous les postes'}
              </CardTitle>
              {filterMissing && displayedPositions.length > 0 && (
                <Badge variant="destructive">
                  {displayedPositions.length} poste{displayedPositions.length > 1 ? 's' : ''} à
                  corriger
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {displayedPositions.length === 0 ? (
              <div className="text-center py-12">
                <Briefcase className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                {filterMissing ? (
                  <>
                    <h3 className="text-lg font-semibold mb-2 text-green-600">
                      Tous les postes ont des compétences
                    </h3>
                    <p className="text-muted-foreground mb-6">
                      Vous pouvez lancer le cycle d&apos;évaluation
                    </p>
                    <Link href="/performance">
                      <Button className="min-h-[44px]">Retour au Performance</Button>
                    </Link>
                  </>
                ) : (
                  <>
                    <h3 className="text-lg font-semibold mb-2">Aucun poste créé</h3>
                    <p className="text-muted-foreground mb-6">
                      Créez votre premier poste pour commencer à structurer votre organisation
                    </p>
                    <Link href="/positions/new">
                      <Button className="min-h-[56px]">
                        <Plus className="mr-2 h-5 w-5" />
                        Créer un poste
                      </Button>
                    </Link>
                  </>
                )}
              </div>
            ) : (
              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Titre</TableHead>
                      <TableHead>Code</TableHead>
                      <TableHead>Fonction</TableHead>
                      <TableHead>Métier</TableHead>
                      <TableHead>Département</TableHead>
                      <TableHead>Effectif</TableHead>
                      <TableHead>Fourchette salariale</TableHead>
                      <TableHead className="w-[80px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {displayedPositions.map((position: any) => (
                      <TableRow
                        key={position.id}
                        className={
                          filterMissing || missingCompetenciesIds.has(position.id)
                            ? 'bg-destructive/5'
                            : ''
                        }
                      >
                        <TableCell className="font-medium">
                          {position.title}
                          {missingCompetenciesIds.has(position.id) && !filterMissing && (
                            <Badge variant="destructive" className="ml-2 text-xs">
                              Sans compétences
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-sm">{position.code || '-'}</TableCell>
                        <TableCell className="text-sm">{position.jobFunction || '-'}</TableCell>
                        <TableCell className="text-sm">{position.jobTrade || '-'}</TableCell>
                        <TableCell>{position.department || '-'}</TableCell>
                        <TableCell>{position.headcount || 1}</TableCell>
                        <TableCell>
                          {position.minSalary && position.maxSalary ? (
                            <span className="text-sm">
                              {formatCurrency(position.minSalary)} -{' '}
                              {formatCurrency(position.maxSalary)}
                            </span>
                          ) : (
                            '-'
                          )}
                        </TableCell>
                        <TableCell>
                          <Link href={`/positions/${position.id}`}>
                            <Button
                              variant={
                                filterMissing || missingCompetenciesIds.has(position.id)
                                  ? 'default'
                                  : 'ghost'
                              }
                              size="sm"
                            >
                              {filterMissing ? 'Ajouter compétences' : 'Voir / Modifier'}
                            </Button>
                          </Link>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
