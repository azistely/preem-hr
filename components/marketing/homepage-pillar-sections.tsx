/**
 * Homepage Pillar Sections - 4 Sophisticated Feature Showcases
 *
 * Each pillar has a unique design showcasing real features
 */

import { Calendar, Users, FileText, TrendingUp, MapPin, Camera, DollarSign, Download, Target, Award, CheckCircle, Clock, Zap, BarChart3 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export function GTAPillarSection({ countryCode }: { countryCode: string }) {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-preem-teal-50 to-preem-teal-100 py-20 md:py-28">
      {/* Decorative elements */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-preem-teal/20 rounded-full blur-3xl"></div>

      <div className="container mx-auto px-4 relative z-10">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <Badge className="mb-4 bg-preem-teal text-white hover:bg-preem-teal-600 text-sm px-4 py-2">
              GESTION DES TEMPS (GTA)
            </Badge>
            <h2 className="text-4xl md:text-5xl font-bold mb-4 text-gray-900">
              Fini les feuilles Excel de pointage
            </h2>
            <p className="text-xl text-gray-700 max-w-3xl mx-auto">
              Badgeage GPS, heures supplémentaires calculées automatiquement, congés approuvés en 1 clic
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {/* Feature 1: GPS Clock In/Out */}
            <Card className="border-2 border-preem-teal/20 bg-white hover:shadow-xl transition-shadow">
              <CardHeader>
                <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-xl bg-preem-teal/10">
                  <MapPin className="h-7 w-7 text-preem-teal" />
                </div>
                <CardTitle className="text-xl mb-2">Pointage GPS</CardTitle>
                <CardDescription>
                  Badgeage avec géolocalisation et photo
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3 text-sm text-gray-600">
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-preem-teal mt-0.5 flex-shrink-0" />
                    <span>Employé badge depuis son téléphone</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-preem-teal mt-0.5 flex-shrink-0" />
                    <span>Géofencing - badge uniquement sur le site</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-preem-teal mt-0.5 flex-shrink-0" />
                    <span>Selfie de vérification</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-preem-teal mt-0.5 flex-shrink-0" />
                    <span>Fonctionne hors ligne (synchronise après)</span>
                  </li>
                </ul>
              </CardContent>
            </Card>

            {/* Feature 2: Overtime Auto-Calculation */}
            <Card className="border-2 border-preem-teal/20 bg-white hover:shadow-xl transition-shadow">
              <CardHeader>
                <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-xl bg-preem-teal/10">
                  <Clock className="h-7 w-7 text-preem-teal" />
                </div>
                <CardTitle className="text-xl mb-2">Heures sup automatiques</CardTitle>
                <CardDescription>
                  Calcul 115%, 150%, 175% - zéro erreur
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3 text-sm text-gray-600">
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-preem-teal mt-0.5 flex-shrink-0" />
                    <span>H41-46: +15% (Convention Collective)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-preem-teal mt-0.5 flex-shrink-0" />
                    <span>H46+: +50%</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-preem-teal mt-0.5 flex-shrink-0" />
                    <span>Nuit: +75%</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-preem-teal mt-0.5 flex-shrink-0" />
                    <span>Dimanche/Férié: +75%</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-preem-teal mt-0.5 flex-shrink-0" />
                    <span>Intégration auto à la paie</span>
                  </li>
                </ul>
              </CardContent>
            </Card>

            {/* Feature 3: Leave Management */}
            <Card className="border-2 border-preem-teal/20 bg-white hover:shadow-xl transition-shadow">
              <CardHeader>
                <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-xl bg-preem-teal/10">
                  <Calendar className="h-7 w-7 text-preem-teal" />
                </div>
                <CardTitle className="text-xl mb-2">Gestion des congés</CardTitle>
                <CardDescription>
                  Demande, approbation, soldes - tout dans le système
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3 text-sm text-gray-600">
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-preem-teal mt-0.5 flex-shrink-0" />
                    <span>Employé demande depuis son téléphone</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-preem-teal mt-0.5 flex-shrink-0" />
                    <span>Manager approuve en 1 clic</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-preem-teal mt-0.5 flex-shrink-0" />
                    <span>Soldes calculés automatiquement</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-preem-teal mt-0.5 flex-shrink-0" />
                    <span>Exclut les jours fériés</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-preem-teal mt-0.5 flex-shrink-0" />
                    <span>Prime ACP calculée à 1 an d&apos;ancienneté</span>
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </section>
  );
}

export function AdminHRPillarSection({ countryCode }: { countryCode: string }) {
  return (
    <section className="bg-white py-20 md:py-28">
      <div className="container mx-auto px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <Badge className="mb-4 bg-preem-purple text-white hover:bg-preem-purple/80 text-sm px-4 py-2">
              GESTION ADMINISTRATIVE RH
            </Badge>
            <h2 className="text-4xl md:text-5xl font-bold mb-4 text-gray-900">
              Digitalisez tous vos processus RH
            </h2>
            <p className="text-xl text-gray-700 max-w-3xl mx-auto">
              Dossiers employés, contrats, départs, documents - tout centralisé et sécurisé
            </p>
          </div>

          {/* Bento Grid Layout */}
          <div className="grid md:grid-cols-2 gap-6">
            {/* Large feature card - Contracts */}
            <Card className="md:row-span-2 border-2 border-preem-purple/20 bg-gradient-to-br from-preem-purple/5 to-white hover:shadow-xl transition-shadow">
              <CardHeader>
                <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-xl bg-preem-purple/10">
                  <FileText className="h-7 w-7 text-preem-purple" />
                </div>
                <CardTitle className="text-2xl mb-2">Gestion des contrats intelligente</CardTitle>
                <CardDescription>
                  CDI, CDD, CDDTI - conformité automatique
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 rounded-lg bg-white border border-preem-purple/10">
                  <h4 className="font-semibold text-sm mb-2 text-gray-900">Alertes de conformité CDD</h4>
                  <ul className="space-y-2 text-sm text-gray-600">
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-preem-purple mt-0.5 flex-shrink-0" />
                      <span>Alerte à 90, 60, 30 jours avant expiration</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-preem-purple mt-0.5 flex-shrink-0" />
                      <span>Vérifie max 2 renouvellements, 24 mois</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-preem-purple mt-0.5 flex-shrink-0" />
                      <span>Conversion auto en CDI après limite</span>
                    </li>
                  </ul>
                </div>
                <div className="p-4 rounded-lg bg-white border border-preem-purple/10">
                  <h4 className="font-semibold text-sm mb-2 text-gray-900">CDDTI - Travailleurs journaliers</h4>
                  <ul className="space-y-2 text-sm text-gray-600">
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-preem-purple mt-0.5 flex-shrink-0" />
                      <span>Paie journalière ou mensuelle (selon jours travaillés)</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-preem-purple mt-0.5 flex-shrink-0" />
                      <span>Max 12 mois, conversion auto après</span>
                    </li>
                  </ul>
                </div>
                <div className="p-4 rounded-lg bg-white border border-preem-purple/10">
                  <h4 className="font-semibold text-sm mb-2 text-gray-900">Génération de documents</h4>
                  <p className="text-sm text-gray-600">
                    Templates conformes, export PDF, signatures électroniques
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Employee Termination */}
            <Card className="border-2 border-preem-gold/20 bg-white hover:shadow-xl transition-shadow">
              <CardHeader>
                <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-xl bg-preem-gold/10">
                  <Award className="h-7 w-7 text-preem-gold-600" />
                </div>
                <CardTitle className="text-xl mb-2">Solde de Tout Compte</CardTitle>
                <CardDescription>
                  Calculé automatiquement selon Convention Collective
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-preem-gold-600 mt-0.5 flex-shrink-0" />
                    <span>Indemnité de licenciement (30-40% selon ancienneté)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-preem-gold-600 mt-0.5 flex-shrink-0" />
                    <span>Congés non pris payés</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-preem-gold-600 mt-0.5 flex-shrink-0" />
                    <span>Gratification (75% salaire catégoriel)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-preem-gold-600 mt-0.5 flex-shrink-0" />
                    <span>Docs auto: certificat travail, attestation CNPS</span>
                  </li>
                </ul>
              </CardContent>
            </Card>

            {/* Digital Employee Register */}
            <Card className="border-2 border-preem-navy/20 bg-white hover:shadow-xl transition-shadow">
              <CardHeader>
                <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-xl bg-preem-navy/10">
                  <Users className="h-7 w-7 text-preem-navy" />
                </div>
                <CardTitle className="text-xl mb-2">Registre du Personnel</CardTitle>
                <CardDescription>
                  Obligatoire pour inspecteur du travail - 100% digital
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-preem-navy mt-0.5 flex-shrink-0" />
                    <span>Entrées automatiques (embauche/départ)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-preem-navy mt-0.5 flex-shrink-0" />
                    <span>Numérotation séquentielle</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-preem-navy mt-0.5 flex-shrink-0" />
                    <span>Export PDF pour inspection</span>
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </section>
  );
}

export function TalentPillarSection({ countryCode }: { countryCode: string }) {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-preem-gold-50 to-preem-gold-100 py-20 md:py-28">
      {/* Decorative elements */}
      <div className="absolute bottom-0 left-0 w-64 h-64 bg-preem-gold/20 rounded-full blur-3xl"></div>

      <div className="container mx-auto px-4 relative z-10">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <Badge className="mb-4 bg-preem-gold-600 text-white hover:bg-preem-gold-700 text-sm px-4 py-2">
              GESTION DES TALENTS
            </Badge>
            <h2 className="text-4xl md:text-5xl font-bold mb-4 text-gray-900">
              Rémunération et avantages simplifiés
            </h2>
            <p className="text-xl text-gray-700 max-w-3xl mx-auto">
              Grilles salariales, primes, acomptes, avantages - tout géré dans le système
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {/* Compensation Management */}
            <div className="space-y-6">
              <Card className="border-2 border-preem-gold/20 bg-white hover:shadow-xl transition-shadow">
                <CardHeader>
                  <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-xl bg-preem-gold/10">
                    <DollarSign className="h-7 w-7 text-preem-gold-600" />
                  </div>
                  <CardTitle className="text-xl mb-2">Administration salariale</CardTitle>
                  <CardDescription>
                    Gérez les augmentations et composantes salariales
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3 text-sm text-gray-600">
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-preem-gold-600 mt-0.5 flex-shrink-0" />
                      <span>Historique des salaires avec dates effectives</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-preem-gold-600 mt-0.5 flex-shrink-0" />
                      <span>Grilles salariales par position</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-preem-gold-600 mt-0.5 flex-shrink-0" />
                      <span>Augmentations en masse (%, montant fixe)</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-preem-gold-600 mt-0.5 flex-shrink-0" />
                      <span>Composantes salariales personnalisables</span>
                    </li>
                  </ul>
                </CardContent>
              </Card>

              <Card className="border-2 border-preem-gold/20 bg-white hover:shadow-xl transition-shadow">
                <CardHeader>
                  <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-xl bg-preem-gold/10">
                    <Zap className="h-7 w-7 text-preem-gold-600" />
                  </div>
                  <CardTitle className="text-xl mb-2">Primes et bonuses</CardTitle>
                  <CardDescription>
                    Performance, objectifs, événements spéciaux
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3 text-sm text-gray-600">
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-preem-gold-600 mt-0.5 flex-shrink-0" />
                      <span>Primes ponctuelles ou récurrentes</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-preem-gold-600 mt-0.5 flex-shrink-0" />
                      <span>Workflow d&apos;approbation</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-preem-gold-600 mt-0.5 flex-shrink-0" />
                      <span>Intégration automatique à la paie</span>
                    </li>
                  </ul>
                </CardContent>
              </Card>
            </div>

            {/* Salary Advances */}
            <Card className="border-2 border-preem-gold/20 bg-gradient-to-br from-preem-gold/5 to-white hover:shadow-xl transition-shadow">
              <CardHeader>
                <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-xl bg-preem-gold/10">
                  <TrendingUp className="h-7 w-7 text-preem-gold-600" />
                </div>
                <CardTitle className="text-2xl mb-2">Acomptes sur salaire</CardTitle>
                <CardDescription>
                  Demande, approbation, remboursement - tout automatisé
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 rounded-lg bg-white border border-preem-gold/10">
                  <h4 className="font-semibold text-sm mb-2 text-gray-900">Workflow employé</h4>
                  <ul className="space-y-2 text-sm text-gray-600">
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-preem-gold-600 mt-0.5 flex-shrink-0" />
                      <span>Employé demande depuis son téléphone</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-preem-gold-600 mt-0.5 flex-shrink-0" />
                      <span>Validation automatique selon politique (max 50% salaire)</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-preem-gold-600 mt-0.5 flex-shrink-0" />
                      <span>Manager approuve en 1 clic</span>
                    </li>
                  </ul>
                </div>
                <div className="p-4 rounded-lg bg-white border border-preem-gold/10">
                  <h4 className="font-semibold text-sm mb-2 text-gray-900">Remboursement automatique</h4>
                  <ul className="space-y-2 text-sm text-gray-600">
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-preem-gold-600 mt-0.5 flex-shrink-0" />
                      <span>Déduction automatique sur prochaines paies</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-preem-gold-600 mt-0.5 flex-shrink-0" />
                      <span>Nombre de mensualités configurable</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-preem-gold-600 mt-0.5 flex-shrink-0" />
                      <span>Suivi du solde restant</span>
                    </li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </section>
  );
}

export function PayrollPillarSection({ country }: { country: { code: string; socialSecurity: string; taxSystem: string; name: string } }) {
  return (
    <section className="bg-white py-20 md:py-28">
      <div className="container mx-auto px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <Badge className="mb-4 bg-preem-navy text-white hover:bg-preem-navy/80 text-sm px-4 py-2">
              PAIE, CONFORMITÉ, REPORTING
            </Badge>
            <h2 className="text-4xl md:text-5xl font-bold mb-4 text-gray-900">
              Finissez la paie en 10 minutes
            </h2>
            <p className="text-xl text-gray-700 max-w-3xl mx-auto">
              Calcul automatique, déclarations {country.socialSecurity}/{country.taxSystem} en 1 clic, exports comptables
            </p>
          </div>

          {/* Feature Grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
            {/* Multi-Country Engine */}
            <Card className="border-2 border-preem-navy/20 bg-gradient-to-br from-preem-navy/5 to-white hover:shadow-xl transition-shadow">
              <CardHeader>
                <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-xl bg-preem-navy/10">
                  <Target className="h-7 w-7 text-preem-navy" />
                </div>
                <CardTitle className="text-xl mb-2">Multi-pays</CardTitle>
                <CardDescription>
                  CI, SN, BF - un seul système
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-preem-navy mt-0.5 flex-shrink-0" />
                    <span>Règles {country.taxSystem} automatiques</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-preem-navy mt-0.5 flex-shrink-0" />
                    <span>Cotisations {country.socialSecurity} exactes</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-preem-navy mt-0.5 flex-shrink-0" />
                    <span>SMIG vérifié par pays</span>
                  </li>
                </ul>
              </CardContent>
            </Card>

            {/* CNPS Declarations */}
            <Card className="border-2 border-preem-teal/20 bg-white hover:shadow-xl transition-shadow">
              <CardHeader>
                <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-xl bg-preem-teal/10">
                  <Download className="h-7 w-7 text-preem-teal" />
                </div>
                <CardTitle className="text-xl mb-2">Déclarations {country.socialSecurity}</CardTitle>
                <CardDescription>
                  Excel format officiel - prêt à soumettre
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-preem-teal mt-0.5 flex-shrink-0" />
                    <span>10 colonnes format {country.socialSecurity}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-preem-teal mt-0.5 flex-shrink-0" />
                    <span>Classification auto (Mensuel/Journalier)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-preem-teal mt-0.5 flex-shrink-0" />
                    <span>Branches 1234 calculées</span>
                  </li>
                </ul>
              </CardContent>
            </Card>

            {/* Tax Declarations */}
            <Card className="border-2 border-preem-purple/20 bg-white hover:shadow-xl transition-shadow">
              <CardHeader>
                <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-xl bg-preem-purple/10">
                  <FileText className="h-7 w-7 text-preem-purple" />
                </div>
                <CardTitle className="text-xl mb-2">État 301 & {country.taxSystem}</CardTitle>
                <CardDescription>
                  Déclaration fiscale mensuelle
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-preem-purple mt-0.5 flex-shrink-0" />
                    <span>6 tranches {country.taxSystem} calculées</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-preem-purple mt-0.5 flex-shrink-0" />
                    <span>Parts fiscales selon situation familiale</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-preem-purple mt-0.5 flex-shrink-0" />
                    <span>Total mensuel agrégé</span>
                  </li>
                </ul>
              </CardContent>
            </Card>

            {/* Bank Transfers */}
            <Card className="border-2 border-preem-gold/20 bg-white hover:shadow-xl transition-shadow">
              <CardHeader>
                <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-xl bg-preem-gold/10">
                  <DollarSign className="h-7 w-7 text-preem-gold-600" />
                </div>
                <CardTitle className="text-xl mb-2">Virements bancaires</CardTitle>
                <CardDescription>
                  Format RIB - prêt pour la banque
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-preem-gold-600 mt-0.5 flex-shrink-0" />
                    <span>Code banque, guichet, n° compte, clé RIB</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-preem-gold-600 mt-0.5 flex-shrink-0" />
                    <span>Montant net par employé</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-preem-gold-600 mt-0.5 flex-shrink-0" />
                    <span>Référence auto-générée</span>
                  </li>
                </ul>
              </CardContent>
            </Card>

            {/* Payslips */}
            <Card className="border-2 border-preem-teal/20 bg-white hover:shadow-xl transition-shadow">
              <CardHeader>
                <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-xl bg-preem-teal/10">
                  <FileText className="h-7 w-7 text-preem-teal" />
                </div>
                <CardTitle className="text-xl mb-2">Bulletins de paie</CardTitle>
                <CardDescription>
                  PDF conformes Convention Collective
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-preem-teal mt-0.5 flex-shrink-0" />
                    <span>Brut → Net détaillé</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-preem-teal mt-0.5 flex-shrink-0" />
                    <span>Cumuls annuels (YTD)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-preem-teal mt-0.5 flex-shrink-0" />
                    <span>Génération en masse</span>
                  </li>
                </ul>
              </CardContent>
            </Card>

            {/* Accounting Export */}
            <Card className="border-2 border-preem-navy/20 bg-white hover:shadow-xl transition-shadow">
              <CardHeader>
                <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-xl bg-preem-navy/10">
                  <BarChart3 className="h-7 w-7 text-preem-navy" />
                </div>
                <CardTitle className="text-xl mb-2">Export comptable</CardTitle>
                <CardDescription>
                  Écritures pour votre logiciel comptable
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-preem-navy mt-0.5 flex-shrink-0" />
                    <span>Plan comptable mapping</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-preem-navy mt-0.5 flex-shrink-0" />
                    <span>Débit/Crédit par compte</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-preem-navy mt-0.5 flex-shrink-0" />
                    <span>Excel/CSV ready</span>
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>

          {/* Highlight Banner */}
          <div className="p-8 rounded-2xl bg-gradient-to-r from-preem-navy via-preem-navy to-preem-teal text-white text-center">
            <h3 className="text-2xl md:text-3xl font-bold mb-3">
              Tout ce que vous faisiez en 2 jours, maintenant en 10 minutes
            </h3>
            <p className="text-lg text-gray-200">
              Cliquez "Calculer la paie" → Vérifiez → Téléchargez les bulletins → Payez. C&apos;est fait.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
