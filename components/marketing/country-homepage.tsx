'use client';

/**
 * Country-Specific Homepage Component - Sophisticated High-End Design
 *
 * Reusable homepage that adapts content based on country
 * Supports: Côte d'Ivoire, Sénégal, Burkina Faso
 *
 * Design Philosophy: Each section is distinct, sophisticated, mobile-first
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
  Globe,
  Calendar,
  Users,
  FileText,
  TrendingUp,
  Zap,
  BarChart3,
  MapPin,
  Camera,
  DollarSign,
  AlertCircle,
  Download,
  Target,
  Award,
  Lock
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
import { Badge } from '@/components/ui/badge';
import {
  GTAPillarSection,
  AdminHRPillarSection,
  TalentPillarSection,
  PayrollPillarSection
} from '@/components/marketing/homepage-pillar-sections';

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
    // ✅ PERFORMANCE: Don't refetch on window focus (marketing page doesn't need real-time auth status)
    refetchOnWindowFocus: false,
    // ✅ PERFORMANCE: Don't refetch on reconnect (auth status doesn't change when network reconnects)
    refetchOnReconnect: false,
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
    <div className="min-h-screen bg-white">
      {/* Fixed Header / Navigation */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">
        <div className="container mx-auto px-4 py-4">
          <nav className="flex items-center justify-between">
            <Link href="/" className="transition-opacity hover:opacity-80">
              <PreemLogo size="default" />
            </Link>
            <div className="flex items-center gap-2 sm:gap-4">
              {/* Country Selector - Only render on client to avoid hydration mismatch */}
              {mounted && (
                <Select value={country.code} onValueChange={handleCountryChange}>
                  <SelectTrigger className="min-h-[44px] w-[140px] sm:w-[180px] border-gray-200 hidden sm:flex">
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
                    className="min-h-[44px] min-w-[100px] sm:min-w-[120px] bg-gradient-to-r from-preem-teal to-preem-teal-600 text-white hover:shadow-lg transition-all text-sm sm:text-base"
                  >
                    Mon compte
                  </Button>
                </Link>
              ) : (
                <>
                  <Link href="/login" className="hidden sm:inline-block">
                    <Button
                      variant="ghost"
                      className="min-h-[44px] text-gray-700 hover:text-preem-teal"
                    >
                      Se connecter
                    </Button>
                  </Link>
                  <Link href="/signup">
                    <Button
                      className="min-h-[44px] min-w-[100px] sm:min-w-[140px] bg-gradient-to-r from-preem-teal to-preem-teal-600 text-white hover:shadow-lg transition-all text-sm sm:text-base"
                    >
                      Essai gratuit
                    </Button>
                  </Link>
                </>
              )}
            </div>
          </nav>
        </div>
      </header>

      {/* Hero Section - Dark Sophisticated Design */}
      <section className="relative overflow-hidden bg-gradient-to-br from-gray-900 via-preem-navy to-gray-900">
        {/* Decorative gradient orbs */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-preem-teal/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-preem-purple/10 rounded-full blur-3xl"></div>

        <div className="container mx-auto px-4 py-20 md:py-32 relative z-10">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-12">
              <Badge className="mb-6 bg-preem-teal/10 text-preem-teal border-preem-teal/20 hover:bg-preem-teal/20 text-sm px-4 py-2">
                AUTOMATISÉ. PROACTIF. CONFORME.
              </Badge>
              <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold mb-6 leading-tight text-white">
                Éliminez 80% des
                <br />
                <span className="bg-gradient-to-r from-preem-teal via-preem-purple to-preem-gold bg-clip-text text-transparent">
                  opérations manuelles
                </span>
              </h1>
              <p className="text-xl md:text-2xl text-gray-300 mb-4 max-w-3xl mx-auto leading-relaxed">
                Preem gère de façon <strong className="text-white">proactive</strong> les activités RH: pointage, variables de paie, heures sup, absences, congés, déclarations {country.socialSecurity}, CMU, {country.taxSystem}, bulletins de paie, solde de tout compte.
              </p>
              <p className="text-lg text-gray-400 mb-8">
                Tout dans <strong className="text-preem-teal">un seul système</strong> conforme pour {country.flag} {country.name}
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                <Link href="/signup">
                  <Button
                    size="lg"
                    className="min-h-[56px] text-lg px-10 w-full sm:w-auto bg-gradient-to-r from-preem-teal to-preem-teal-600 text-white hover:shadow-2xl hover:shadow-preem-teal/50 transition-all group"
                  >
                    Commencer gratuitement
                    <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </Link>
                <a href="https://wa.me/2250708786828?text=Bonjour%21%20Je%20souhaite%20voir%20une%20d%C3%A9mo%20de%20Preem%20HR" target="_blank" rel="noopener noreferrer">
                  <Button
                    size="lg"
                    variant="outline"
                    className="min-h-[56px] text-lg px-10 w-full sm:w-auto bg-transparent border-2 border-gray-600 text-white hover:bg-white/10 transition-all"
                  >
                    Voir la démo
                    <Zap className="ml-2 h-5 w-5" />
                  </Button>
                </a>
              </div>
              <p className="mt-6 text-sm text-gray-400 flex items-center justify-center gap-2">
                <CheckCircle className="h-4 w-4 text-preem-teal" />
                Pas de carte bancaire • Support WhatsApp en français • Web & Mobile
              </p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-16 max-w-4xl mx-auto">
              <div className="text-center p-6 rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10">
                <div className="text-3xl md:text-4xl font-bold text-white mb-2">80%</div>
                <div className="text-sm text-gray-400">Opérations éliminées</div>
              </div>
              <div className="text-center p-6 rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10">
                <div className="text-3xl md:text-4xl font-bold text-white mb-2">10 min</div>
                <div className="text-sm text-gray-400">Traitement de la paie</div>
              </div>
              <div className="text-center p-6 rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10">
                <div className="text-3xl md:text-4xl font-bold text-white mb-2">100%</div>
                <div className="text-sm text-gray-400">Conforme</div>
              </div>
              <div className="text-center p-6 rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10">
                <div className="text-3xl md:text-4xl font-bold text-white mb-2">3 pays</div>
                <div className="text-sm text-gray-400">CI, SN, BF</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pain Points Section - Before/After Visual */}
      <section className="container mx-auto px-4 py-20 md:py-28">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <Badge className="mb-4 bg-red-50 text-red-600 border-red-200 hover:bg-red-100 text-sm px-4 py-2">
              STOP AUX OPÉRATIONS MANUELLES
            </Badge>
            <h2 className="text-4xl md:text-5xl font-bold mb-6">
              Vous perdez des journées entières sur...
            </h2>
          </div>

          <div className="grid md:grid-cols-2 gap-8 mb-12">
            {/* Pain Points Column */}
            <div className="space-y-4">
              <div className="flex items-start gap-4 p-6 rounded-2xl bg-red-50 border-2 border-red-100">
                <AlertCircle className="h-6 w-6 text-red-600 flex-shrink-0 mt-1" />
                <div>
                  <h3 className="font-semibold text-lg mb-2 text-gray-900">Traiter les données du pointage</h3>
                  <p className="text-gray-600 text-sm">Saisir manuellement heures supplémentaires, absences, congés dans SAGE ou Excel</p>
                </div>
              </div>
              <div className="flex items-start gap-4 p-6 rounded-2xl bg-red-50 border-2 border-red-100">
                <AlertCircle className="h-6 w-6 text-red-600 flex-shrink-0 mt-1" />
                <div>
                  <h3 className="font-semibold text-lg mb-2 text-gray-900">Gérer les variables de paie</h3>
                  <p className="text-gray-600 text-sm">Primes, acomptes, déductions, personnes à charge - tout rentré à la main</p>
                </div>
              </div>
              <div className="flex items-start gap-4 p-6 rounded-2xl bg-red-50 border-2 border-red-100">
                <AlertCircle className="h-6 w-6 text-red-600 flex-shrink-0 mt-1" />
                <div>
                  <h3 className="font-semibold text-lg mb-2 text-gray-900">Paramétrer SAGE/Excel</h3>
                  <p className="text-gray-600 text-sm">Formules compliquées, erreurs de calcul, fichiers corrompus</p>
                </div>
              </div>
              <div className="flex items-start gap-4 p-6 rounded-2xl bg-red-50 border-2 border-red-100">
                <AlertCircle className="h-6 w-6 text-red-600 flex-shrink-0 mt-1" />
                <div>
                  <h3 className="font-semibold text-lg mb-2 text-gray-900">Générer manuellement les déclarations</h3>
                  <p className="text-gray-600 text-sm">{country.socialSecurity}, CMU, DGI, État 301 - Excel, erreurs, stress</p>
                </div>
              </div>
              <div className="flex items-start gap-4 p-6 rounded-2xl bg-red-50 border-2 border-red-100">
                <AlertCircle className="h-6 w-6 text-red-600 flex-shrink-0 mt-1" />
                <div>
                  <h3 className="font-semibold text-lg mb-2 text-gray-900">Gérer les documents</h3>
                  <p className="text-gray-600 text-sm">Bulletins de paie, certificats de travail, soldes de tout compte dispersés partout</p>
                </div>
              </div>
            </div>

            {/* Solution Column */}
            <div className="space-y-4">
              <div className="flex items-start gap-4 p-6 rounded-2xl bg-preem-teal/5 border-2 border-preem-teal/20">
                <CheckCircle className="h-6 w-6 text-preem-teal flex-shrink-0 mt-1" />
                <div>
                  <h3 className="font-semibold text-lg mb-2 text-gray-900">Pointage GPS automatique</h3>
                  <p className="text-gray-600 text-sm">Badgeage avec géolocalisation, heures sup calculées automatiquement, manager approuve en 1 clic</p>
                </div>
              </div>
              <div className="flex items-start gap-4 p-6 rounded-2xl bg-preem-purple/5 border-2 border-preem-purple/20">
                <CheckCircle className="h-6 w-6 text-preem-purple flex-shrink-0 mt-1" />
                <div>
                  <h3 className="font-semibold text-lg mb-2 text-gray-900">Variables centralisées</h3>
                  <p className="text-gray-600 text-sm">Primes, acomptes, parts fiscales gérés dans le système - intégration automatique à la paie</p>
                </div>
              </div>
              <div className="flex items-start gap-4 p-6 rounded-2xl bg-preem-gold/5 border-2 border-preem-gold/20">
                <CheckCircle className="h-6 w-6 text-preem-gold-600 flex-shrink-0 mt-1" />
                <div>
                  <h3 className="font-semibold text-lg mb-2 text-gray-900">Zéro configuration</h3>
                  <p className="text-gray-600 text-sm">Règles {country.taxSystem}, {country.socialSecurity} déjà paramétrées - cliquez "Calculer" et c&apos;est fait</p>
                </div>
              </div>
              <div className="flex items-start gap-4 p-6 rounded-2xl bg-preem-navy/5 border-2 border-preem-navy/20">
                <CheckCircle className="h-6 w-6 text-preem-navy flex-shrink-0 mt-1" />
                <div>
                  <h3 className="font-semibold text-lg mb-2 text-gray-900">Exports 1-clic</h3>
                  <p className="text-gray-600 text-sm">Appel {country.socialSecurity}, CMU, État 301 générés en Excel format officiel - prêts à soumettre</p>
                </div>
              </div>
              <div className="flex items-start gap-4 p-6 rounded-2xl bg-gradient-to-br from-preem-teal/5 to-preem-purple/5 border-2 border-preem-teal/20">
                <CheckCircle className="h-6 w-6 text-preem-teal flex-shrink-0 mt-1" />
                <div>
                  <h3 className="font-semibold text-lg mb-2 text-gray-900">Documents centralisés</h3>
                  <p className="text-gray-600 text-sm">Bulletins, contrats, certificats stockés en sécurité - accessibles depuis mobile</p>
                </div>
              </div>
            </div>
          </div>

          <div className="text-center p-8 rounded-2xl bg-gradient-to-r from-preem-teal/10 to-preem-purple/10 border-2 border-preem-teal/20">
            <h3 className="text-2xl font-bold mb-3 text-gray-900">
              Résultat: <span className="text-preem-teal">80% des opérations éliminées</span>
            </h3>
            <p className="text-lg text-gray-700">
              Ce qui prenait 2 jours prend maintenant 10 minutes
            </p>
          </div>
        </div>
      </section>

      {/* 4 Pillar Feature Sections - Each with Unique Design */}
      <GTAPillarSection countryCode={country.code} />
      <AdminHRPillarSection countryCode={country.code} />
      <TalentPillarSection countryCode={country.code} />
      <PayrollPillarSection country={country} />

      {/* Sophistication Showcase - Technical Excellence */}
      <section className="relative overflow-hidden bg-gray-900 py-20 md:py-28">
        {/* Gradient orbs */}
        <div className="absolute top-20 left-0 w-96 h-96 bg-preem-teal/20 rounded-full blur-3xl"></div>
        <div className="absolute bottom-20 right-0 w-96 h-96 bg-preem-purple/20 rounded-full blur-3xl"></div>

        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <Badge className="mb-4 bg-white/10 text-white border-white/20 hover:bg-white/20 text-sm px-4 py-2">
                SOLUTION SOPHISTIQUÉE
              </Badge>
              <h2 className="text-4xl md:text-5xl font-bold mb-6 text-white">
                Conçu pour RH productifs, cool et modernes
              </h2>
              <p className="text-xl text-gray-300 max-w-3xl mx-auto">
                Web & Mobile. Multi-pays. Sécurisé. Rapide même en 3G.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              {/* Web & Mobile */}
              <Card className="border-2 border-white/10 bg-white/5 backdrop-blur-sm hover:bg-white/10 transition-all">
                <CardHeader>
                  <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-xl bg-preem-teal/20">
                    <Smartphone className="h-7 w-7 text-preem-teal" />
                  </div>
                  <CardTitle className="text-xl mb-2 text-white">Web & Mobile</CardTitle>
                  <CardDescription className="text-gray-300">
                    Gérez tout depuis votre téléphone
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3 text-sm text-gray-300">
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-preem-teal mt-0.5 flex-shrink-0" />
                      <span>Application web responsive (pas d&apos;app à télécharger)</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-preem-teal mt-0.5 flex-shrink-0" />
                      <span>Optimisé pour écrans 5&quot; (la majorité de vos employés)</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-preem-teal mt-0.5 flex-shrink-0" />
                      <span>Fonctionne hors ligne (synchronise après)</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-preem-teal mt-0.5 flex-shrink-0" />
                      <span>Rapide même sur 3G</span>
                    </li>
                  </ul>
                </CardContent>
              </Card>

              {/* Multi-Country */}
              <Card className="border-2 border-white/10 bg-white/5 backdrop-blur-sm hover:bg-white/10 transition-all">
                <CardHeader>
                  <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-xl bg-preem-purple/20">
                    <Globe className="h-7 w-7 text-preem-purple" />
                  </div>
                  <CardTitle className="text-xl mb-2 text-white">Multi-pays</CardTitle>
                  <CardDescription className="text-gray-300">
                    Un système pour toute l&apos;Afrique de l&apos;Ouest
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3 text-sm text-gray-300">
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-preem-purple mt-0.5 flex-shrink-0" />
                      <span>🇨🇮 Côte d&apos;Ivoire (ITS, CNPS)</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-preem-purple mt-0.5 flex-shrink-0" />
                      <span>🇸🇳 Sénégal (IRPP, IPRES)</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-preem-purple mt-0.5 flex-shrink-0" />
                      <span>🇧🇫 Burkina Faso (CNSS)</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-preem-purple mt-0.5 flex-shrink-0" />
                      <span>Base de données unique pour plusieurs bureaux</span>
                    </li>
                  </ul>
                </CardContent>
              </Card>

              {/* Security */}
              <Card className="border-2 border-white/10 bg-white/5 backdrop-blur-sm hover:bg-white/10 transition-all">
                <CardHeader>
                  <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-xl bg-preem-gold/20">
                    <Lock className="h-7 w-7 text-preem-gold-400" />
                  </div>
                  <CardTitle className="text-xl mb-2 text-white">Sécurité totale</CardTitle>
                  <CardDescription className="text-gray-300">
                    Vos données protégées comme une banque
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3 text-sm text-gray-300">
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-preem-gold-400 mt-0.5 flex-shrink-0" />
                      <span>Cryptage des données sensibles (RIB, CNI)</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-preem-gold-400 mt-0.5 flex-shrink-0" />
                      <span>Isolation multi-tenant (vos données sont VÔTRES)</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-preem-gold-400 mt-0.5 flex-shrink-0" />
                      <span>Rôles & permissions (RH, Manager, Employé)</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-preem-gold-400 mt-0.5 flex-shrink-0" />
                      <span>Audit logs (qui a fait quoi, quand)</span>
                    </li>
                  </ul>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Social Proof - Customer Testimonials */}
      <section className="bg-white py-20 md:py-28">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <Badge className="mb-4 bg-preem-teal/10 text-preem-teal border-preem-teal/20 hover:bg-preem-teal/20 text-sm px-4 py-2">
                ILS ONT CHOISI PREEM HR
              </Badge>
              <h2 className="text-4xl md:text-5xl font-bold mb-6 text-gray-900">
                Ce qu&apos;ils disent après 3 mois
              </h2>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              {/* Testimonial 1 */}
              <Card className="border-2 border-gray-100 hover:border-preem-teal/30 transition-all hover:shadow-xl">
                <CardHeader>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="h-14 w-14 rounded-full bg-gradient-to-br from-preem-teal to-preem-teal-600 flex items-center justify-center text-white font-bold text-xl">
                      MK
                    </div>
                    <div>
                      <p className="font-semibold text-lg text-gray-900">Marie K.</p>
                      <p className="text-sm text-gray-600">Boutique de mode, Abidjan</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="mb-4">
                    <div className="flex gap-1 mb-3">
                      {[...Array(5)].map((_, i) => (
                        <Award key={i} className="h-5 w-5 fill-preem-gold-400 text-preem-gold-400" />
                      ))}
                    </div>
                    <p className="text-gray-700 italic leading-relaxed">
                      &quot;Avant Preem HR, je passais <strong className="text-gray-900">8 heures par mois</strong> sur Excel. Maintenant, <strong className="text-preem-teal">10 minutes</strong>. Je ne stress e plus avant les contrôles CNPS.&quot;
                    </p>
                  </div>
                  <div className="pt-4 border-t border-gray-100">
                    <p className="text-sm text-gray-600">12 employés • 3 mois avec Preem HR</p>
                  </div>
                </CardContent>
              </Card>

              {/* Testimonial 2 */}
              <Card className="border-2 border-gray-100 hover:border-preem-purple/30 transition-all hover:shadow-xl">
                <CardHeader>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="h-14 w-14 rounded-full bg-gradient-to-br from-preem-purple to-preem-purple/80 flex items-center justify-center text-white font-bold text-xl">
                      KD
                    </div>
                    <div>
                      <p className="font-semibold text-lg text-gray-900">Kouadio D.</p>
                      <p className="text-sm text-gray-600">RH Logistique, Abidjan</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="mb-4">
                    <div className="flex gap-1 mb-3">
                      {[...Array(5)].map((_, i) => (
                        <Award key={i} className="h-5 w-5 fill-preem-gold-400 text-preem-gold-400" />
                      ))}
                    </div>
                    <p className="text-gray-700 italic leading-relaxed">
                      &quot;Le système ITS m&apos;a toujours stressé. Avec Preem HR, <strong className="text-preem-purple">tout est déjà configuré</strong>. Mon patron me demande &apos;comment tu fais si vite maintenant?&apos;&quot;
                    </p>
                  </div>
                  <div className="pt-4 border-t border-gray-100">
                    <p className="text-sm text-gray-600">45 employés • 6 mois avec Preem HR</p>
                  </div>
                </CardContent>
              </Card>

              {/* Testimonial 3 */}
              <Card className="border-2 border-gray-100 hover:border-preem-gold/30 transition-all hover:shadow-xl">
                <CardHeader>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="h-14 w-14 rounded-full bg-gradient-to-br from-preem-gold-500 to-preem-gold-600 flex items-center justify-center text-white font-bold text-xl">
                      AS
                    </div>
                    <div>
                      <p className="font-semibold text-lg text-gray-900">Aminata S.</p>
                      <p className="text-sm text-gray-600">CFO Société régionale</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="mb-4">
                    <div className="flex gap-1 mb-3">
                      {[...Array(5)].map((_, i) => (
                        <Award key={i} className="h-5 w-5 fill-preem-gold-400 text-preem-gold-400" />
                      ))}
                    </div>
                    <p className="text-gray-700 italic leading-relaxed">
                      &quot;3 bureaux en Afrique de l&apos;Ouest. Avant, 3 systèmes différents. Avec Preem HR, <strong className="text-preem-gold-600">un seul système</strong> qui connaît CNPS, IPRES, CNSS. Enfin!&quot;
                    </p>
                  </div>
                  <div className="pt-4 border-t border-gray-100">
                    <p className="text-sm text-gray-600">120 employés • 1 an avec Preem HR</p>
                  </div>
                </CardContent>
              </Card>
            </div>
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

      {/* Final CTA - Dark Sophisticated */}
      <section className="relative overflow-hidden bg-gradient-to-br from-gray-900 via-preem-navy to-gray-900 py-24 md:py-32">
        {/* Decorative elements */}
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-preem-teal/20 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-preem-purple/20 rounded-full blur-3xl"></div>

        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-4xl mx-auto text-center">
            <Badge className="mb-6 bg-preem-gold-500/20 text-preem-gold-300 border-preem-gold-500/30 hover:bg-preem-gold-500/30 text-sm px-4 py-2">
              REJOIGNEZ 150+ ENTREPRISES
            </Badge>
            <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 text-white leading-tight">
              Prêt à éliminer 80% des<br />
              opérations manuelles?
            </h2>
            <p className="text-xl md:text-2xl text-gray-300 mb-4">
              Créez votre compte maintenant. Sans carte bancaire.
            </p>
            <p className="text-lg text-gray-400 mb-10">
              Si vous n&apos;êtes pas convaincu, vous ne payez rien.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-12">
              <Link href="/signup">
                <Button
                  size="lg"
                  className="min-h-[64px] text-lg px-12 w-full sm:w-auto bg-gradient-to-r from-preem-teal to-preem-teal-600 text-white hover:shadow-2xl hover:shadow-preem-teal/50 transition-all group"
                >
                  Commencer gratuitement
                  <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>
              <a href="https://wa.me/2250708786828?text=Bonjour%21%20Je%20souhaite%20voir%20une%20d%C3%A9mo%20de%20Preem%20HR" target="_blank" rel="noopener noreferrer">
                <Button
                  size="lg"
                  variant="outline"
                  className="min-h-[64px] text-lg px-12 w-full sm:w-auto bg-transparent border-2 border-gray-600 text-white hover:bg-white/10 transition-all"
                >
                  Voir la démo
                  <Zap className="ml-2 h-5 w-5" />
                </Button>
              </a>
            </div>

            {/* Trust Grid */}
            <div className="grid md:grid-cols-3 gap-6 max-w-3xl mx-auto">
              <div className="flex flex-col items-center gap-3 p-6 rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10">
                <CheckCircle className="h-8 w-8 text-preem-teal" />
                <p className="font-semibold text-white">Sans carte bancaire</p>
                <p className="text-sm text-gray-400 text-center">Essai gratuit complet, aucun engagement</p>
              </div>
              <div className="flex flex-col items-center gap-3 p-6 rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10">
                <CheckCircle className="h-8 w-8 text-preem-teal" />
                <p className="font-semibold text-white">Support en français</p>
                <p className="text-sm text-gray-400 text-center">WhatsApp, email, téléphone - réponse rapide</p>
              </div>
              <div className="flex flex-col items-center gap-3 p-6 rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10">
                <CheckCircle className="h-8 w-8 text-preem-teal" />
                <p className="font-semibold text-white">Garantie zéro erreur</p>
                <p className="text-sm text-gray-400 text-center">Si Preem se trompe, on corrige et rembourse</p>
              </div>
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
                Système complet de gestion RH & Paie pour {country.name}
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
