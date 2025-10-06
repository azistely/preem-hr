/**
 * Positions List Page
 *
 * Lists all positions with create/edit actions
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
import { Plus, Briefcase, Loader2, Network } from 'lucide-react';
import Link from 'next/link';
import { usePositions } from '@/features/employees/hooks/use-positions';
import { formatCurrency } from '@/features/employees/hooks/use-salary-validation';

export default function PositionsPage() {
  const { data: positions, isLoading, error } = usePositions('active');

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

      {/* Loading State */}
      {isLoading && (
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
      {!isLoading && !error && (
        <Card>
          <CardHeader>
            <CardTitle>Tous les postes</CardTitle>
          </CardHeader>
          <CardContent>
            {!positions || positions.length === 0 ? (
              <div className="text-center py-12">
                <Briefcase className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
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
              </div>
            ) : (
              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Titre</TableHead>
                      <TableHead>Code</TableHead>
                      <TableHead>Département</TableHead>
                      <TableHead>Effectif</TableHead>
                      <TableHead>Fourchette salariale</TableHead>
                      <TableHead className="w-[80px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {positions.map((position: any) => (
                      <TableRow key={position.id}>
                        <TableCell className="font-medium">{position.title}</TableCell>
                        <TableCell className="font-mono text-sm">
                          {position.code || '-'}
                        </TableCell>
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
                          <Button variant="ghost" size="sm">
                            Modifier
                          </Button>
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
