/**
 * Salaries Hub Page
 *
 * Central page for all salary-related operations
 */

'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, Users, DollarSign, ArrowRight } from 'lucide-react';
import Link from 'next/link';

export default function SalariesPage() {
  return (
    <div className="container mx-auto py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <DollarSign className="h-8 w-8" />
          Gestion des salaires
        </h1>
        <p className="text-muted-foreground mt-2">
          Gérez les salaires, ajustements et bandes salariales
        </p>
      </div>

      {/* Action Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <div className="bg-primary/10 p-3 rounded-lg">
                <Users className="h-6 w-6 text-primary" />
              </div>
              Ajustement groupé
            </CardTitle>
            <CardDescription>
              Appliquez des augmentations ou réductions à plusieurs employés en même temps
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/salaries/bulk-adjustment">
              <Button className="w-full min-h-[48px]">
                Créer un ajustement
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <div className="bg-green-500/10 p-3 rounded-lg">
                <TrendingUp className="h-6 w-6 text-green-600" />
              </div>
              Bandes salariales
            </CardTitle>
            <CardDescription>
              Définissez des fourchettes salariales par niveau et catégorie
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/salaries/bands">
              <Button className="w-full min-h-[48px]" variant="outline">
                Gérer les bandes
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Info Section */}
      <div className="mt-8">
        <Card className="bg-blue-50 border-blue-200">
          <CardHeader>
            <CardTitle className="text-blue-900">À propos de la gestion des salaires</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-blue-800">
            <div className="flex items-start gap-3">
              <div className="bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0 mt-0.5">
                1
              </div>
              <div>
                <p className="font-medium">Ajustements groupés</p>
                <p className="text-sm text-blue-700 mt-1">
                  Appliquez des augmentations en pourcentage ou montant fixe à plusieurs employés en une seule opération
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0 mt-0.5">
                2
              </div>
              <div>
                <p className="font-medium">Bandes salariales</p>
                <p className="text-sm text-blue-700 mt-1">
                  Structurez vos rémunérations en définissant des fourchettes par niveau et catégorie de poste
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0 mt-0.5">
                3
              </div>
              <div>
                <p className="font-medium">Historique complet</p>
                <p className="text-sm text-blue-700 mt-1">
                  Tous les changements de salaire sont tracés et consultables dans l'historique de chaque employé
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
