import Link from 'next/link';
import { Calculator, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function HomePage() {
  return (
    <div className="container mx-auto py-16 px-4">
      <div className="max-w-3xl mx-auto text-center mb-12">
        <h1 className="text-4xl font-bold mb-4">PREEM HR</h1>
        <p className="text-xl text-muted-foreground">
          Système de Gestion de Paie pour la Côte d&apos;Ivoire
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 max-w-4xl mx-auto">
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <Calculator className="h-6 w-6" />
              Calculateur de Paie
            </CardTitle>
            <CardDescription>
              Calculez rapidement le salaire net d&apos;un employé avec toutes les déductions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/payroll/calculator">
              <Button className="w-full touch-target" size="lg">
                Ouvrir le calculateur
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="opacity-50">
          <CardHeader>
            <CardTitle>Gestion des Employés</CardTitle>
            <CardDescription>Gérez vos employés, contrats et historique salarial</CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full touch-target" size="lg" disabled>
              Bientôt disponible
            </Button>
          </CardContent>
        </Card>

        <Card className="opacity-50">
          <CardHeader>
            <CardTitle>Bulletins de Paie</CardTitle>
            <CardDescription>Générez et téléchargez les bulletins de paie mensuels</CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full touch-target" size="lg" disabled>
              Bientôt disponible
            </Button>
          </CardContent>
        </Card>

        <Card className="opacity-50">
          <CardHeader>
            <CardTitle>Exécution de Paie</CardTitle>
            <CardDescription>Lancez la paie pour tous les employés en un clic</CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full touch-target" size="lg" disabled>
              Bientôt disponible
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="mt-12 max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Fonctionnalités Actuelles</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              <li className="flex items-start gap-2">
                <span className="text-primary">✓</span>
                <span>
                  Calcul conforme aux réglementations de Côte d&apos;Ivoire (SMIG, CNPS, CMU, ITS 2024)
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">✓</span>
                <span>Support complet des indemnités (logement, transport, repas)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">✓</span>
                <span>Calcul automatique des cotisations patronales</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">✓</span>
                <span>Interface optimisée pour mobile avec cibles tactiles de 44px</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">✓</span>
                <span>100% en français pour utilisateurs ivoiriens</span>
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
