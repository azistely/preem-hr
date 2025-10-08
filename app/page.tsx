/**
 * Marketing Homepage
 *
 * Simple, elegant, modern homepage for Preem HR
 * Designed for low digital literacy users in French-speaking West Africa
 *
 * Features:
 * - Hero section with clear value proposition
 * - 3 benefit cards (not feature list)
 * - Trust indicators
 * - CTA to signup
 * - Mobile-first responsive design
 */

import Link from 'next/link';
import { ArrowRight, Users, Zap, Shield, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-green-50">
      {/* Header / Navigation */}
      <header className="container mx-auto px-4 py-6">
        <nav className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-orange-500 to-green-500 flex items-center justify-center">
              <span className="text-white font-bold text-xl">P</span>
            </div>
            <span className="text-2xl font-bold text-primary">PREEM HR</span>
          </div>
          <Link href="/login">
            <Button variant="outline" className="min-h-[44px] min-w-[44px]">
              Se connecter
            </Button>
          </Link>
        </nav>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-12 md:py-20">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 bg-gradient-to-r from-orange-600 to-green-600 bg-clip-text text-transparent">
            La paie simplifiée pour l&apos;Afrique de l&apos;Ouest
          </h1>
          <p className="text-xl md:text-2xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Payez vos employés en quelques clics. Simple, rapide, et 100% conforme aux lois ivoiriennes.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link href="/signup">
              <Button size="lg" className="min-h-[56px] text-lg px-8 w-full sm:w-auto">
                Commencer gratuitement
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <p className="text-sm text-muted-foreground">
              Aucune carte bancaire requise
            </p>
          </div>
        </div>

        {/* Trust Indicators */}
        <div className="max-w-3xl mx-auto mt-16 grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
          <div className="flex flex-col items-center gap-2">
            <CheckCircle className="h-8 w-8 text-green-600" />
            <p className="text-sm font-medium">Conforme ITS 2024</p>
          </div>
          <div className="flex flex-col items-center gap-2">
            <CheckCircle className="h-8 w-8 text-green-600" />
            <p className="text-sm font-medium">Calcul CNPS automatique</p>
          </div>
          <div className="flex flex-col items-center gap-2">
            <CheckCircle className="h-8 w-8 text-green-600" />
            <p className="text-sm font-medium">Accessible sur mobile</p>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="container mx-auto px-4 py-12 md:py-16">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">
            Pourquoi choisir Preem HR ?
          </h2>

          <div className="grid gap-6 md:grid-cols-3">
            {/* Benefit 1: Simple */}
            <Card className="hover:shadow-lg transition-shadow border-2">
              <CardHeader>
                <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-lg bg-orange-100">
                  <Zap className="h-8 w-8 text-orange-600" />
                </div>
                <CardTitle className="text-2xl mb-2">Simple et rapide</CardTitle>
                <CardDescription className="text-base">
                  Créez votre paie en 3 clics. Pas besoin d&apos;être expert en RH ou en comptabilité.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                    <span>Interface guidée étape par étape</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                    <span>Calculs automatiques</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                    <span>Utilisable sans formation</span>
                  </li>
                </ul>
              </CardContent>
            </Card>

            {/* Benefit 2: Conforme */}
            <Card className="hover:shadow-lg transition-shadow border-2">
              <CardHeader>
                <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-lg bg-green-100">
                  <Shield className="h-8 w-8 text-green-600" />
                </div>
                <CardTitle className="text-2xl mb-2">100% conforme</CardTitle>
                <CardDescription className="text-base">
                  Respecte toutes les lois du travail de Côte d&apos;Ivoire. Vos données sont sécurisées.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                    <span>ITS 2024 avec barème progressif</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                    <span>Cotisations CNPS et CMU</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                    <span>Respect du SMIG</span>
                  </li>
                </ul>
              </CardContent>
            </Card>

            {/* Benefit 3: Accessible */}
            <Card className="hover:shadow-lg transition-shadow border-2">
              <CardHeader>
                <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-lg bg-blue-100">
                  <Users className="h-8 w-8 text-blue-600" />
                </div>
                <CardTitle className="text-2xl mb-2">Accessible partout</CardTitle>
                <CardDescription className="text-base">
                  Fonctionne sur votre téléphone, tablette ou ordinateur. Même avec une connexion lente.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                    <span>Interface optimisée pour mobile</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                    <span>Fonctionne avec 3G</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                    <span>100% en français</span>
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="container mx-auto px-4 py-12 md:py-16 bg-gradient-to-r from-orange-50 to-green-50 rounded-3xl my-12">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">
            Comment ça marche ?
          </h2>

          <div className="grid gap-8 md:grid-cols-3">
            <div className="text-center">
              <div className="mb-4 mx-auto inline-flex h-16 w-16 items-center justify-center rounded-full bg-orange-500 text-white text-2xl font-bold">
                1
              </div>
              <h3 className="text-xl font-semibold mb-2">Créez votre compte</h3>
              <p className="text-muted-foreground">
                En 2 minutes. Juste votre email et le nom de votre entreprise.
              </p>
            </div>

            <div className="text-center">
              <div className="mb-4 mx-auto inline-flex h-16 w-16 items-center justify-center rounded-full bg-green-500 text-white text-2xl font-bold">
                2
              </div>
              <h3 className="text-xl font-semibold mb-2">Ajoutez vos employés</h3>
              <p className="text-muted-foreground">
                Nom, poste, salaire. C&apos;est tout ce dont nous avons besoin.
              </p>
            </div>

            <div className="text-center">
              <div className="mb-4 mx-auto inline-flex h-16 w-16 items-center justify-center rounded-full bg-blue-500 text-white text-2xl font-bold">
                3
              </div>
              <h3 className="text-xl font-semibold mb-2">Lancez la paie</h3>
              <p className="text-muted-foreground">
                Un clic et c&apos;est fait. Bulletins de paie prêts à télécharger.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="container mx-auto px-4 py-16 md:py-20">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">
            Prêt à simplifier votre paie ?
          </h2>
          <p className="text-xl text-muted-foreground mb-8">
            Rejoignez les entreprises qui ont choisi Preem HR pour gérer leur paie en toute sérénité.
          </p>
          <Link href="/signup">
            <Button size="lg" className="min-h-[56px] text-lg px-8">
              Créer mon compte gratuit
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
          <p className="mt-4 text-sm text-muted-foreground">
            Essai gratuit • Aucune carte bancaire requise • Assistance en français
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-muted/50">
        <div className="container mx-auto px-4 py-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-orange-500 to-green-500 flex items-center justify-center">
                <span className="text-white font-bold">P</span>
              </div>
              <span className="font-semibold">PREEM HR</span>
            </div>
            <p className="text-sm text-muted-foreground text-center">
              Système de gestion de paie pour l&apos;Afrique de l&apos;Ouest
            </p>
            <p className="text-sm text-muted-foreground">
              © 2025 Preem HR. Tous droits réservés.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
