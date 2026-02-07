/**
 * Automation Hub Page (Option A: Task-Oriented Single Entry Point)
 * Epic: 09-EPIC-WORKFLOW-AUTOMATION.md
 * HCI Compliance: docs/HCI-DESIGN-PRINCIPLES.md
 *
 * DESIGN PRINCIPLES:
 * - Task-oriented design (user goals, not system operations)
 * - Zero learning curve (instant understanding, no jargon)
 * - Progressive disclosure (essential info first, details on demand)
 * - French business language (no technical terms)
 *
 * BEFORE: 4 technical menu items (Workflows, Alerts, Batch Operations, Events)
 * AFTER: 1 task-oriented hub with clear user outcomes
 */

'use client';

import { useRouter } from 'next/navigation';
import { api } from '@/trpc/react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Sparkles,
  Bell,
  Zap,
  Clock,
  Calendar,
  AlertTriangle,
  FileText,
  Users,
  ArrowRight,
  CheckCircle2,
  TrendingUp,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { QuickActions } from '@/components/automation/quick-actions';

/**
 * Task-oriented automation cards
 * Each card describes a USER GOAL, not a technical feature
 */
const automationCards = [
  {
    id: 'reminders',
    icon: Bell,
    title: 'Rappels automatiques',
    description: 'Recevez des notifications avant les dates importantes',
    examples: [
      'Fin de contrat dans 30 jours',
      'Renouvellement de documents',
      'Période de paie mensuelle',
    ],
    href: '/automation/reminders',
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    dataKey: 'alerts', // Maps to existing /alerts page
  },
  {
    id: 'bulk-actions',
    icon: Zap,
    title: 'Actions groupées',
    description: 'Modifiez plusieurs employés en même temps',
    examples: [
      'Augmentation collective de salaire',
      'Changement de département',
      'Génération de documents en masse',
    ],
    href: '/automation/bulk-actions',
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
    dataKey: 'batchOperations', // Maps to existing /batch-operations page
  },
  {
    id: 'auto-rules',
    icon: Clock,
    title: 'Règles intelligentes',
    description: 'Automatisez vos tâches répétitives',
    examples: [
      'Renouvellement automatique des contrats',
      'Calcul de paie au prorata',
      'Notifications d\'onboarding',
    ],
    href: '/automation/rules',
    color: 'text-green-600',
    bgColor: 'bg-green-50',
    dataKey: 'workflows', // Maps to existing /workflows page
  },
  {
    id: 'activity',
    icon: TrendingUp,
    title: 'Suivi d\'activité',
    description: 'Consultez l\'historique de toutes les actions automatisées',
    examples: [
      'Opérations terminées',
      'Alertes traitées',
      'Événements système',
    ],
    href: '/automation/history',
    color: 'text-orange-600',
    bgColor: 'bg-orange-50',
    dataKey: 'activity', // Maps to existing /events page
  },
];

export default function AutomationHubPage() {
  const router = useRouter();

  // Fetch summary data for all automation features
  const { data: alertsSummary, isLoading: alertsLoading } = api.alerts.getSummary.useQuery(undefined, {
    retry: false,
  });
  const { data: batchSummary, isLoading: batchLoading } = api.batchOperations.getStats.useQuery(undefined, {
    retry: false,
  });
  // Workflows API doesn't have a getStats endpoint, so we'll fetch the list and derive stats
  const { data: workflowsList, isLoading: workflowsLoading } = api.workflows.list.useQuery(
    { limit: 100 },
    { retry: false }
  );

  const isLoading = alertsLoading || batchLoading || workflowsLoading;

  // Calculate stats for each card (handle different API response structures)
  const getCardStats = (dataKey: string) => {
    switch (dataKey) {
      case 'alerts': {
        const activeCount = alertsSummary?.summary?.urgent || 0;
        const total = alertsSummary?.summary?.total || 0;
        return {
          active: activeCount,
          total,
          status: activeCount
            ? `${activeCount} active${activeCount > 1 ? 's' : ''}`
            : 'Aucune alerte active',
        };
      }
      case 'batchOperations': {
        const runningCount = batchSummary?.byStatus?.find((s: any) => s.status === 'running')?.count || 0;
        const total = batchSummary?.total || 0;
        return {
          active: runningCount,
          total,
          status: runningCount
            ? `${runningCount} en cours`
            : 'Aucune opération en cours',
        };
      }
      case 'workflows': {
        // Count active workflows from the list
        const activeCount = workflowsList?.workflows?.filter((w: any) => w.status === 'active').length || 0;
        const total = workflowsList?.workflows?.length || 0;
        return {
          active: activeCount,
          total,
          status: activeCount
            ? `${activeCount} règle${activeCount > 1 ? 's' : ''} active${activeCount > 1 ? 's' : ''}`
            : 'Aucune règle configurée',
        };
      }
      case 'activity':
        return {
          active: 0,
          total: 0,
          status: 'Voir l\'historique complet',
        };
      default:
        return { active: 0, total: 0, status: '' };
    }
  };

  return (
    <div className="container mx-auto max-w-6xl py-8 px-4 pb-24 md:pb-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-3">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-lg bg-primary/10">
              <Sparkles className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Automatisations</h1>
              <p className="text-muted-foreground mt-1">
                Gagnez du temps sur vos tâches RH répétitives
              </p>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="md:pt-2">
            <QuickActions variant="header" />
          </div>
        </div>

        {/* Quick Stats Summary */}
        {!isLoading && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6">
            <Card className="border-primary/20">
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Alertes actives</p>
                    <p className="text-2xl font-bold">{getCardStats('alerts').active}</p>
                  </div>
                  <Bell className="h-5 w-5 text-blue-600" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-primary/20">
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Opérations actives</p>
                    <p className="text-2xl font-bold">{getCardStats('batchOperations').active}</p>
                  </div>
                  <Zap className="h-5 w-5 text-purple-600" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-primary/20">
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Règles actives</p>
                    <p className="text-2xl font-bold">{getCardStats('workflows').active}</p>
                  </div>
                  <Clock className="h-5 w-5 text-green-600" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Heures économisées</p>
                    <p className="text-2xl font-bold">
                      {Math.round(
                        (getCardStats('alerts').total * 0.1 +
                          getCardStats('batchOperations').total * 2 +
                          getCardStats('workflows').total * 5) /
                          10
                      )}
                      h
                    </p>
                  </div>
                  <CheckCircle2 className="h-5 w-5 text-primary" />
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {isLoading && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-20" />
            ))}
          </div>
        )}
      </div>

      {/* Main Automation Cards */}
      <div className="grid gap-6 md:grid-cols-2">
        {automationCards.map((card) => {
          const Icon = card.icon;
          const stats = getCardStats(card.dataKey);
          const hasActiveItems = stats.active > 0;

          return (
            <Card
              key={card.id}
              className="group hover:shadow-lg transition-all duration-200 cursor-pointer border-2 hover:border-primary/30"
              onClick={() => router.push(card.href)}
            >
              <CardHeader className="pb-4">
                <div className="flex items-start justify-between mb-3">
                  <div className={`p-3 rounded-lg ${card.bgColor}`}>
                    <Icon className={`h-6 w-6 ${card.color}`} />
                  </div>
                  {hasActiveItems && (
                    <Badge variant="default" className="gap-1.5">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
                      </span>
                      {stats.active}
                    </Badge>
                  )}
                </div>

                <CardTitle className="text-xl group-hover:text-primary transition-colors">
                  {card.title}
                </CardTitle>
                <CardDescription className="text-sm">
                  {card.description}
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Examples */}
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase">
                    Exemples d'utilisation:
                  </p>
                  <ul className="space-y-1.5">
                    {card.examples.map((example, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-sm text-muted-foreground">
                        <CheckCircle2 className="h-4 w-4 text-primary/60 mt-0.5 flex-shrink-0" />
                        <span>{example}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Status & CTA */}
                <div className="flex items-center justify-between pt-3 border-t">
                  <div className={`text-sm ${hasActiveItems ? 'font-medium text-primary' : 'text-muted-foreground'}`}>
                    {isLoading ? (
                      <Skeleton className="h-4 w-32" />
                    ) : (
                      stats.status
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1.5 group-hover:gap-2.5 transition-all min-h-[36px]"
                  >
                    Gérer
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Getting Started Section (if no automation configured) */}
      {!isLoading &&
        !getCardStats('alerts').total &&
        !getCardStats('batchOperations').total &&
        !getCardStats('workflows').total && (
          <Card className="mt-8 border-2 border-dashed border-primary/30 bg-primary/5">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-primary/10">
                  <Sparkles className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-lg">Commencez à automatiser</CardTitle>
                  <CardDescription>
                    Aucune automatisation configurée pour le moment
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 md:grid-cols-3">
                <Button
                  variant="outline"
                  className="justify-start h-auto py-3 px-4"
                  onClick={() => router.push('/automation/reminders')}
                >
                  <div className="flex items-start gap-3 text-left">
                    <Bell className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-sm">Créer un rappel</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Fin de contrat, documents...
                      </p>
                    </div>
                  </div>
                </Button>

                <Button
                  variant="outline"
                  className="justify-start h-auto py-3 px-4"
                  onClick={() => router.push('/automation/rules')}
                >
                  <div className="flex items-start gap-3 text-left">
                    <Clock className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-sm">Configurer une règle</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Automatisez vos workflows
                      </p>
                    </div>
                  </div>
                </Button>

                <Button
                  variant="outline"
                  className="justify-start h-auto py-3 px-4"
                  onClick={() => router.push('/employees')}
                >
                  <div className="flex items-start gap-3 text-left">
                    <Users className="h-5 w-5 text-purple-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-sm">Sélectionner des employés</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Pour une action groupée
                      </p>
                    </div>
                  </div>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

      {/* Mobile FAB for Quick Actions */}
      <div className="md:hidden">
        <QuickActions variant="fab" />
      </div>

      {/* Help Section */}
      <Card className="mt-8 bg-muted/50">
        <CardHeader>
          <CardTitle className="text-base">Comment ça marche ?</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-3">
            <div className="flex gap-3">
              <div className="flex-shrink-0">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                  1
                </div>
              </div>
              <div>
                <h4 className="font-medium mb-1">Configurez vos règles</h4>
                <p className="text-sm text-muted-foreground">
                  Définissez quand et comment vous voulez être notifié ou automatiser une action
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="flex-shrink-0">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                  2
                </div>
              </div>
              <div>
                <h4 className="font-medium mb-1">Le système surveille</h4>
                <p className="text-sm text-muted-foreground">
                  Jamana surveille automatiquement vos données et déclenche les actions au bon moment
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="flex-shrink-0">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                  3
                </div>
              </div>
              <div>
                <h4 className="font-medium mb-1">Vous êtes alerté</h4>
                <p className="text-sm text-muted-foreground">
                  Recevez des notifications et prenez des décisions en un clic
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
