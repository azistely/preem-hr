/**
 * Onboarding Success Page
 *
 * Final celebration screen after completing 3-question onboarding.
 * Shows summary, checklist, and progressive feature discovery.
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/trpc/react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { ChecklistItem, FeatureCard } from '@/features/onboarding/components/progressive-feature-cards';
import { Sparkles, ArrowRight, FileText, LayoutDashboard } from 'lucide-react';

export default function OnboardingSuccessPage() {
  const router = useRouter();
  const [hasCompleted, setHasCompleted] = useState(false);

  // tRPC queries and mutations
  const completeOnboardingMutation = api.onboarding.completeOnboardingV2.useMutation();
  const { data: summary } = api.onboarding.getSummary.useQuery();
  const { data: user } = api.auth.me.useQuery();

  useEffect(() => {
    // Mark onboarding as complete (runs once on mount)
    if (!hasCompleted) {
      completeOnboardingMutation.mutate();
      setHasCompleted(true);
    }
  }, [hasCompleted, completeOnboardingMutation]);

  // Helper to get role-specific dashboard
  const getDashboardPath = () => {
    const role = user?.role || 'employee';
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
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 p-6">
      <div className="max-w-4xl mx-auto py-12">
        {/* Success Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-500 mb-4">
            <Sparkles className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold mb-2">
            Félicitations ! Votre système de paie est configuré 🎉
          </h1>
          <p className="text-lg text-muted-foreground">
            Vous êtes prêt à gérer votre paie comme un pro
          </p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card>
            <CardContent className="pt-6 text-center">
              <div className="text-4xl font-bold text-primary mb-1">
                {summary?.employeeCount || 1}
              </div>
              <div className="text-sm text-muted-foreground">
                Employé{(summary?.employeeCount || 1) > 1 ? 's' : ''} ajouté{(summary?.employeeCount || 1) > 1 ? 's' : ''}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6 text-center">
              <div className="text-4xl font-bold text-green-600 mb-1">
                ✓
              </div>
              <div className="text-sm text-muted-foreground">
                Entreprise configurée
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6 text-center">
              <div className="text-4xl font-bold text-blue-600 mb-1">
                ✓
              </div>
              <div className="text-sm text-muted-foreground">
                Prêt pour la paie
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Checklist */}
        <Card className="mb-8">
          <CardHeader>
            <h3 className="text-xl font-semibold">Ce que vous avez accompli :</h3>
          </CardHeader>
          <CardContent className="space-y-3">
            <ChecklistItem
              icon="🇨🇮"
              text="Pays et règles fiscales configurés automatiquement"
            />
            <ChecklistItem
              icon="🏢"
              text="Informations de l'entreprise enregistrées"
            />
            <ChecklistItem
              icon="👤"
              text="Premier employé créé avec calcul de paie complet"
            />
            <ChecklistItem
              icon="📅"
              text="Fréquence de paie configurée"
            />
            <ChecklistItem
              icon="✅"
              text="Système prêt pour votre première paie officielle"
            />
          </CardContent>
        </Card>

        {/* Primary Actions */}
        <div className="flex flex-col sm:flex-row gap-4 mb-8">
          <Button
            size="lg"
            className="flex-1 min-h-[56px]"
            onClick={() => router.push('/employees')}
          >
            <FileText className="w-5 h-5 mr-2" />
            Voir mes employés
          </Button>

          <Button
            size="lg"
            variant="outline"
            className="flex-1 min-h-[56px]"
            onClick={() => router.push(getDashboardPath())}
          >
            <LayoutDashboard className="w-5 h-5 mr-2" />
            Aller au tableau de bord
          </Button>
        </div>

        <Separator className="my-8" />

        {/* Progressive Feature Discovery */}
        <div className="mb-8">
          <h3 className="text-xl font-semibold mb-4">
            Découvrez d'autres fonctionnalités (optionnel)
          </h3>
          <p className="text-sm text-muted-foreground mb-6">
            Configurez ces fonctionnalités maintenant ou plus tard depuis le tableau de bord
          </p>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <FeatureCard
              icon="⏰"
              title="Heures travaillées"
              subtitle="Pour les heures sup"
              href="/settings/time-tracking"
            />
            <FeatureCard
              icon="🌴"
              title="Congés"
              subtitle="Gérer les absences"
              href="/settings/leave"
            />
            <FeatureCard
              icon="💰"
              title="Primes"
              subtitle="Bonus et indemnités"
              href="/settings/bonuses"
            />
            <FeatureCard
              icon="📊"
              title="Rapports"
              subtitle="Analytics de paie"
              href="/reports"
            />
          </div>
        </div>

        {/* Skip to Dashboard */}
        <div className="text-center">
          <Button
            variant="link"
            onClick={() => router.push(getDashboardPath())}
          >
            Passer et aller au tableau de bord
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>
    </div>
  );
}
