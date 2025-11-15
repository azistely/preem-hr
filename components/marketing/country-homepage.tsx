'use client';

/**
 * Country-Specific Homepage Component
 *
 * Reusable homepage that adapts content based on country
 * Supports: Côte d'Ivoire, Sénégal, Burkina Faso
 */

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  Shield,
  CheckCircle,
  Clock,
  Smartphone,
  Brain,
  Globe
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PreemLogo } from '@/components/brand/preem-logo';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from '@/trpc/react';

export interface CountryConfig {
  code: string;
  name: string;
  flag: string;
  taxSystem: string;
  taxSystemFull: string;
  socialSecurity: string;
  socialSecurityFull: string;
  minimumWage: string;
  minimumWageAmount: number;
  trustIndicators: {
    tax: string;
    taxDetail: string;
    social: string;
    socialDetail: string;
  };
  benefits: {
    compliance: {
      stat: string;
      items: string[];
    };
    expertise: {
      wage: string;
    };
  };
  howItWorks: {
    step1: {
      outcome: string;
      details: string;
    };
  };
}

interface CountryHomepageProps {
  country: CountryConfig;
  availableCountries: CountryConfig[];
}

export function CountryHomepage({ country, availableCountries }: CountryHomepageProps) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  // Check auth in background - don't block rendering
  const { data: user } = api.auth.me.useQuery(undefined, {
    // Disable automatic retries for better performance
    retry: false,
    // Cache for 5 minutes
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleCountryChange = (countryCode: string) => {
    // Route to country-specific page
    if (countryCode === 'ci') {
      router.push('/');
    } else {
      router.push(`/${countryCode}`);
    }
  };

  // Determine dashboard URL based on user role
  const getDashboardUrl = () => {
    if (!user || !user.onboardingComplete) {
      return '/onboarding';
    }

    const role = user.role || 'employee';
    switch (role) {
      case 'super_admin':
      case 'tenant_admin':
        return '/admin/settings/dashboard';
      case 'hr_manager':
        return '/admin/dashboard';
      case 'manager':
        return '/manager/dashboard';
      default:
        return '/employee/dashboard';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-preem-teal-50 via-white to-preem-navy-50">
      {/* Header / Navigation */}
      <header className="container mx-auto px-4 py-6">
        <nav className="flex items-center justify-between">
          <Link href="/">
            <PreemLogo size="default" />
          </Link>
          <div className="flex items-center gap-2 sm:gap-4">
            {/* Country Selector - Only render on client to avoid hydration mismatch */}
            {mounted && (
              <Select value={country.code} onValueChange={handleCountryChange}>
                <SelectTrigger className="min-h-[44px] w-[140px] sm:w-[180px] border-preem-teal/30 hidden sm:flex">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableCountries.map((c) => (
                    <SelectItem key={c.code} value={c.code}>
                      {c.flag} {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {/* Show different button based on auth state */}
            {user ? (
              <Link href={getDashboardUrl()}>
                <Button
                  className="min-h-[44px] min-w-[100px] sm:min-w-[120px] bg-preem-teal text-white hover:bg-preem-teal-600 transition-colors text-sm sm:text-base"
                >
                  Accéder à mon compte
                </Button>
              </Link>
            ) : (
              <Link href="/login">
                <Button
                  variant="outline"
                  className="min-h-[44px] min-w-[100px] sm:min-w-[120px] border-preem-teal text-preem-teal hover:bg-preem-teal hover:text-white transition-colors text-sm sm:text-base"
                >
                  Se connecter
                </Button>
              </Link>
            )}
          </div>
        </nav>
      </header>

      {/* Hero Section - Outcome-Focused */}
      <section className="container mx-auto px-4 py-12 md:py-20">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 leading-tight">
            Finissez la paie en 10 minutes.{' '}
            <span className="text-preem-gradient">Sans stress, sans erreur, sans amende.</span>
          </h1>
          <p className="text-xl md:text-2xl text-muted-foreground mb-8 max-w-3xl mx-auto">
            Preem HR calcule automatiquement les salaires, cotisations {country.socialSecurity}, et {country.taxSystem} pour votre entreprise en <strong>{country.flag} {country.name}</strong>.
            Utilisé par <strong>150+ entreprises</strong> qui veulent dormir tranquilles.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link href="/signup">
              <Button
                size="lg"
                className="min-h-[56px] text-lg px-8 w-full sm:w-auto bg-preem-teal hover:bg-preem-teal-600 text-white shadow-preem-teal transition-all"
              >
                Créer votre compte gratuitement
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            Assistance en français par WhatsApp
          </p>
        </div>

        {/* Trust Indicators - Country-Specific */}
        <div className="max-w-4xl mx-auto mt-16 grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
          <div className="flex flex-col items-center gap-2">
            <CheckCircle className="h-8 w-8 text-preem-teal" />
            <p className="text-sm font-medium">{country.trustIndicators.tax}</p>
            <p className="text-xs text-muted-foreground">{country.trustIndicators.taxDetail}</p>
          </div>
          <div className="flex flex-col items-center gap-2">
            <CheckCircle className="h-8 w-8 text-preem-teal" />
            <p className="text-sm font-medium">{country.trustIndicators.social}</p>
            <p className="text-xs text-muted-foreground">{country.trustIndicators.socialDetail}</p>
          </div>
          <div className="flex flex-col items-center gap-2">
            <CheckCircle className="h-8 w-8 text-preem-teal" />
            <p className="text-sm font-medium">Garantie zéro erreur</p>
            <p className="text-xs text-muted-foreground">ou remboursé</p>
          </div>
        </div>
      </section>

      {/* Social Proof / Testimonials */}
      <section className="container mx-auto px-4 py-12 md:py-16 bg-preem-navy/5 rounded-3xl my-12">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-4">
            Rejoignez 150+ entreprises qui ont dit adieu aux erreurs de paie
          </h2>
          <p className="text-center text-muted-foreground mb-12">
            Ils passaient 8 heures par mois sur Excel. Maintenant, 10 minutes.
          </p>

          <div className="grid gap-6 md:grid-cols-3">
            {/* Testimonial 1: Small Business Owner */}
            <Card className="border-preem-teal/20">
              <CardHeader>
                <div className="flex items-center gap-3 mb-2">
                  <div className="h-12 w-12 rounded-full bg-preem-teal/10 flex items-center justify-center text-preem-teal font-bold text-lg">
                    MK
                  </div>
                  <div>
                    <p className="font-semibold">Marie K.</p>
                    <p className="text-sm text-muted-foreground">Boutique de mode</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground italic">
                  &quot;Avant Preem HR, je passais 8 heures par mois sur Excel à calculer la paie. Maintenant, ça me prend 10 minutes. Et surtout, je ne stresse plus avant les contrôles {country.socialSecurity}.&quot;
                </p>
                <p className="text-xs text-muted-foreground mt-2">12 employés</p>
              </CardContent>
            </Card>

            {/* Testimonial 2: HR Manager */}
            <Card className="border-preem-purple/20">
              <CardHeader>
                <div className="flex items-center gap-3 mb-2">
                  <div className="h-12 w-12 rounded-full bg-preem-purple/10 flex items-center justify-center text-preem-purple font-bold text-lg">
                    KD
                  </div>
                  <div>
                    <p className="font-semibold">Kouadio D.</p>
                    <p className="text-sm text-muted-foreground">RH Logistique</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground italic">
                  &quot;Le système {country.taxSystem} m&apos;a toujours stressé. Avec Preem HR, tout est déjà configuré. Mon patron me demande &apos;comment tu fais si vite maintenant?&apos; 😊&quot;
                </p>
                <p className="text-xs text-muted-foreground mt-2">45 employés</p>
              </CardContent>
            </Card>

            {/* Testimonial 3: CFO */}
            <Card className="border-preem-gold/20">
              <CardHeader>
                <div className="flex items-center gap-3 mb-2">
                  <div className="h-12 w-12 rounded-full bg-preem-gold/10 flex items-center justify-center text-preem-gold-600 font-bold text-lg">
                    AS
                  </div>
                  <div>
                    <p className="font-semibold">Aminata S.</p>
                    <p className="text-sm text-muted-foreground">CFO, Société régionale</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground italic">
                  &quot;Nous avons 3 bureaux en Afrique de l&apos;Ouest. Avant, 3 systèmes différents. Avec Preem HR, un seul système qui connaît les règles CNPS, IPRES, CNSS. Enfin!&quot;
                </p>
                <p className="text-xs text-muted-foreground mt-2">120 employés</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Benefits Section - Outcome-Focused (4 benefits) */}
      <section className="container mx-auto px-4 py-12 md:py-16">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-4">
            Pourquoi les entreprises choisissent Preem HR
          </h2>
          <p className="text-center text-muted-foreground mb-12 max-w-2xl mx-auto">
            Parce qu&apos;elles veulent dormir tranquilles. Et se concentrer sur leur business, pas sur les formules Excel.
          </p>

          <div className="grid gap-6 md:grid-cols-2">
            {/* Benefit 1: Zero Risk of Fines */}
            <Card className="hover:shadow-lg transition-shadow border-2 border-preem-purple/20 hover:border-preem-purple">
              <CardHeader>
                <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-lg bg-preem-purple/10">
                  <Shield className="h-8 w-8 text-preem-purple" />
                </div>
                <CardTitle className="text-2xl mb-2">Zéro risque d&apos;amende fiscale</CardTitle>
                <CardDescription className="text-base">
                  Dormez tranquille. La conformité est garantie.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  {country.benefits.compliance.stat} Avec Preem HR, c&apos;est impossible:
                </p>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  {country.benefits.compliance.items.map((item, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-preem-purple mt-0.5 flex-shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
                <p className="text-sm italic text-preem-purple/70 mt-4">
                  &quot;Plus jamais de lettre du fisc qui vous fait paniquer.&quot;
                </p>
              </CardContent>
            </Card>

            {/* Benefit 2: Time Savings */}
            <Card className="hover:shadow-lg transition-shadow border-2 border-preem-teal/20 hover:border-preem-teal">
              <CardHeader>
                <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-lg bg-preem-teal/10">
                  <Clock className="h-8 w-8 text-preem-teal" />
                </div>
                <CardTitle className="text-2xl mb-2">8 heures de paie → 10 minutes</CardTitle>
                <CardDescription className="text-base">
                  Reprenez 8 heures par mois pour développer votre business.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Arrêtez de perdre des journées entières sur Excel:
                </p>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-preem-teal mt-0.5 flex-shrink-0" />
                    <span>Fini les formules compliquées (brut imposable, parts fiscales)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-preem-teal mt-0.5 flex-shrink-0" />
                    <span>Fini les erreurs de calcul (et les employés mécontents)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-preem-teal mt-0.5 flex-shrink-0" />
                    <span>Heures supplémentaires à 115%, 150%, 175% calculées automatiquement</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-preem-teal mt-0.5 flex-shrink-0" />
                    <span>Bulletins de paie générés en 1 clic</span>
                  </li>
                </ul>
                <p className="text-sm italic text-preem-teal/70 mt-4">
                  &quot;Imaginez: vous lancez la paie lundi matin, et à 10h c&apos;est déjà fini. Le reste de la journée? À vous.&quot;
                </p>
              </CardContent>
            </Card>

            {/* Benefit 3: No Expertise Needed */}
            <Card className="hover:shadow-lg transition-shadow border-2 border-preem-gold/20 hover:border-preem-gold">
              <CardHeader>
                <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-lg bg-preem-gold/10">
                  <Brain className="h-8 w-8 text-preem-gold-600" />
                </div>
                <CardTitle className="text-2xl mb-2">Pas besoin d&apos;être expert en paie</CardTitle>
                <CardDescription className="text-base">
                  L&apos;expertise RH intégrée dans le logiciel.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Vous n&apos;avez pas fait d&apos;études en comptabilité? Aucun problème:
                </p>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-preem-gold-600 mt-0.5 flex-shrink-0" />
                    <span>Interface guidée étape par étape (aucune formation nécessaire)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-preem-gold-600 mt-0.5 flex-shrink-0" />
                    <span>Explications simples pour chaque calcul (si vous voulez comprendre)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-preem-gold-600 mt-0.5 flex-shrink-0" />
                    <span>{country.benefits.expertise.wage} vérifié automatiquement</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-preem-gold-600 mt-0.5 flex-shrink-0" />
                    <span>Déductions familiales calculées selon vos parts fiscales</span>
                  </li>
                </ul>
                <p className="text-sm italic text-preem-gold-600/70 mt-4">
                  &quot;Même si vous ne connaissez rien à la paie, vous aurez l&apos;air d&apos;un pro.&quot;
                </p>
              </CardContent>
            </Card>

            {/* Benefit 4: Mobile + 3G */}
            <Card className="hover:shadow-lg transition-shadow border-2 border-preem-navy/20 hover:border-preem-navy">
              <CardHeader>
                <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-lg bg-preem-navy/10">
                  <Smartphone className="h-8 w-8 text-preem-navy" />
                </div>
                <CardTitle className="text-2xl mb-2">Fonctionne partout, même avec 3G</CardTitle>
                <CardDescription className="text-base">
                  Gérez la paie depuis votre téléphone. Connexion lente? Aucun souci.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Conçu pour l&apos;Afrique de l&apos;Ouest, pas pour la Silicon Valley:
                </p>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-preem-navy mt-0.5 flex-shrink-0" />
                    <span>Interface optimisée pour mobile (gérez tout depuis votre téléphone)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-preem-navy mt-0.5 flex-shrink-0" />
                    <span>Fonctionne avec connexion 3G lente</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-preem-navy mt-0.5 flex-shrink-0" />
                    <span>100% en français (langage business, pas jargon technique)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-preem-navy mt-0.5 flex-shrink-0" />
                    <span>Sauvegarde automatique (ne perdez jamais votre travail)</span>
                  </li>
                </ul>
                <p className="text-sm italic text-preem-navy/70 mt-4">
                  &quot;Vous êtes en déplacement? Lancez la paie depuis un taxi. Vraiment.&quot;
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* How it works - Outcome-Focused Steps */}
      <section className="container mx-auto px-4 py-12 md:py-16 bg-preem-gradient rounded-3xl my-12 text-white">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-4">
            Comment ça marche?
          </h2>
          <p className="text-center text-preem-teal-100 mb-12">
            3 étapes, 10 minutes, c&apos;est fait.
          </p>

          <div className="grid gap-8 md:grid-cols-3">
            <div className="text-center">
              <div className="mb-4 mx-auto inline-flex h-16 w-16 items-center justify-center rounded-full bg-preem-gold text-preem-navy text-2xl font-bold shadow-preem-gold">
                1
              </div>
              <h3 className="text-xl font-semibold mb-2">Créez votre compte en 2 minutes</h3>
              <p className="text-preem-teal-100 mb-2">
                {country.howItWorks.step1.outcome}
              </p>
              <p className="text-sm text-preem-teal-200">
                <em>Ce dont nous avons besoin:</em> votre email, nom de l&apos;entreprise. C&apos;est tout.<br />
                <em>Ce que Preem HR fait:</em> {country.howItWorks.step1.details}
              </p>
            </div>

            <div className="text-center">
              <div className="mb-4 mx-auto inline-flex h-16 w-16 items-center justify-center rounded-full bg-preem-gold text-preem-navy text-2xl font-bold shadow-preem-gold">
                2
              </div>
              <h3 className="text-xl font-semibold mb-2">Ajoutez vos employés une fois</h3>
              <p className="text-preem-teal-100 mb-2">
                Fini de rentrer les mêmes infos chaque mois
              </p>
              <p className="text-sm text-preem-teal-200">
                <em>Ce que vous faites:</em> Nom, poste, salaire de base. Preem HR enregistre tout.<br />
                <em>Les déductions familiales?</em> On vous demande &quot;marié + enfants&quot; (pas des calculs).
              </p>
            </div>

            <div className="text-center">
              <div className="mb-4 mx-auto inline-flex h-16 w-16 items-center justify-center rounded-full bg-preem-gold text-preem-navy text-2xl font-bold shadow-preem-gold">
                3
              </div>
              <h3 className="text-xl font-semibold mb-2">Cliquez &quot;Calculer la paie&quot; et c&apos;est fini</h3>
              <p className="text-preem-teal-100 mb-2">
                10 minutes plus tard, bulletins prêts à télécharger
              </p>
              <p className="text-sm text-preem-teal-200">
                <em>Ce que Preem HR fait:</em> calcule automatiquement brut imposable, {country.socialSecurity}, {country.taxSystem}, net à payer.<br />
                <em>Ce que vous faites:</em> vous vérifiez, vous téléchargez, vous payez. Terminé.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Risk Reversal / Final CTA */}
      <section className="container mx-auto px-4 py-16 md:py-20">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Essayez sans risque.
          </h2>
          <p className="text-xl text-muted-foreground mb-2">
            Si vous n&apos;êtes pas convaincu, vous ne payez rien.
          </p>
          <p className="text-lg text-muted-foreground mb-8">
            150+ entreprises nous font confiance. Rejoignez-les.
          </p>
          <Link href="/signup" className="w-full sm:w-auto">
            <Button
              size="lg"
              className="min-h-[56px] text-lg px-8 w-full sm:w-auto bg-preem-teal hover:bg-preem-teal-600 text-white shadow-preem-teal transition-all"
            >
              Commencer gratuitement - Sans carte bancaire
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>

          {/* Trust Signals Below CTA */}
          <div className="mt-8 grid gap-4 md:grid-cols-2 text-sm max-w-2xl mx-auto">
            <div className="flex flex-col items-center gap-2">
              <CheckCircle className="h-6 w-6 text-preem-teal" />
              <p className="font-medium">Assistance en français</p>
              <p className="text-muted-foreground">Par WhatsApp, email, téléphone</p>
            </div>
            <div className="flex flex-col items-center gap-2">
              <CheckCircle className="h-6 w-6 text-preem-teal" />
              <p className="font-medium">Garantie zéro erreur</p>
              <p className="text-muted-foreground">Si Preem HR se trompe, on corrige et on rembourse</p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-preem-teal/10 bg-preem-navy/5">
        <div className="container mx-auto px-4 py-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex flex-col items-center md:items-start gap-2">
              <Link href="/">
                <PreemLogo size="sm" />
              </Link>
              <p className="text-sm text-muted-foreground text-center md:text-left">
                Système de gestion de paie pour {country.name}
              </p>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Globe className="h-3 w-3" />
                Disponible en Côte d&apos;Ivoire, Sénégal, Burkina Faso
              </p>
            </div>
            <p className="text-sm text-muted-foreground">
              © 2025 Preem. Tous droits réservés.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
