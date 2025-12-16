/**
 * Training Effectiveness Dashboard
 *
 * Shows training effectiveness metrics based on Kirkpatrick evaluations.
 * - Overall satisfaction, learning, application, and business impact
 * - Performance by course category
 * - Top/bottom performing courses
 * - Pending evaluations summary
 */

'use client';

import { useState } from 'react';
import { api } from '@/trpc/react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { format, startOfMonth, endOfMonth, startOfYear, endOfYear, subMonths } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Smile,
  BookOpen,
  Briefcase,
  Target,
  AlertCircle,
  ChevronRight,
  Users,
  ClipboardCheck,
  Star,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import Link from 'next/link';
import { KIRKPATRICK_LEVELS, type KirkpatrickLevel } from '@/features/training/types/evaluation.types';

// Level icons and colors
const levelConfig: Record<KirkpatrickLevel, { icon: React.ReactNode; color: string; bg: string }> = {
  1: { icon: <Smile className="h-5 w-5" />, color: 'text-blue-600', bg: 'bg-blue-100 dark:bg-blue-900' },
  2: { icon: <BookOpen className="h-5 w-5" />, color: 'text-purple-600', bg: 'bg-purple-100 dark:bg-purple-900' },
  3: { icon: <Briefcase className="h-5 w-5" />, color: 'text-orange-600', bg: 'bg-orange-100 dark:bg-orange-900' },
  4: { icon: <BarChart3 className="h-5 w-5" />, color: 'text-green-600', bg: 'bg-green-100 dark:bg-green-900' },
};

// Period options
type PeriodOption = 'current_month' | 'last_month' | 'last_3_months' | 'current_year' | 'last_year';

const periodOptions: { value: PeriodOption; label: string }[] = [
  { value: 'current_month', label: 'Ce mois' },
  { value: 'last_month', label: 'Mois dernier' },
  { value: 'last_3_months', label: '3 derniers mois' },
  { value: 'current_year', label: 'Cette année' },
  { value: 'last_year', label: 'Année dernière' },
];

function getPeriodDates(period: PeriodOption): { startDate: Date; endDate: Date } {
  const now = new Date();
  switch (period) {
    case 'current_month':
      return { startDate: startOfMonth(now), endDate: endOfMonth(now) };
    case 'last_month':
      const lastMonth = subMonths(now, 1);
      return { startDate: startOfMonth(lastMonth), endDate: endOfMonth(lastMonth) };
    case 'last_3_months':
      return { startDate: startOfMonth(subMonths(now, 2)), endDate: endOfMonth(now) };
    case 'current_year':
      return { startDate: startOfYear(now), endDate: endOfYear(now) };
    case 'last_year':
      const lastYear = new Date(now.getFullYear() - 1, 0, 1);
      return { startDate: startOfYear(lastYear), endDate: endOfYear(lastYear) };
  }
}

export default function TrainingEffectivenessPage() {
  const [period, setPeriod] = useState<PeriodOption>('last_3_months');

  const { startDate, endDate } = getPeriodDates(period);

  // Fetch dashboard data
  const { data: dashboard, isLoading, error } = api.training.evaluations.getEffectivenessDashboard.useQuery({
    startDate: format(startDate, 'yyyy-MM-dd'),
    endDate: format(endDate, 'yyyy-MM-dd'),
  });

  if (isLoading) {
    return (
      <div className="container mx-auto py-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-48 mt-2" />
          </div>
          <Skeleton className="h-10 w-48" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-6">
        <Card>
          <CardContent className="py-12 text-center">
            <AlertCircle className="h-12 w-12 mx-auto text-destructive mb-4" />
            <h3 className="text-lg font-medium mb-2">Erreur de chargement</h3>
            <p className="text-muted-foreground">
              Impossible de charger les données d'efficacité.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const summary = dashboard?.summary || {
    totalSessions: 0,
    totalParticipants: 0,
    averageSatisfaction: 0,
    averageLearning: 0,
    averageApplication: 0,
    averageImpact: 0,
    overallEffectiveness: 0,
  };

  const pendingEvaluations = dashboard?.pendingEvaluations || {
    level1: 0,
    level2: 0,
    level3: 0,
    level4: 0,
  };

  const totalPending = pendingEvaluations.level1 + pendingEvaluations.level2 + pendingEvaluations.level3 + pendingEvaluations.level4;

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-primary" />
            Efficacité des Formations
          </h1>
          <p className="text-muted-foreground">
            Analyse basée sur le modèle Kirkpatrick (4 niveaux)
          </p>
        </div>

        <Select value={period} onValueChange={(v) => setPeriod(v as PeriodOption)}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Période" />
          </SelectTrigger>
          <SelectContent>
            {periodOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Period info */}
      <div className="text-sm text-muted-foreground">
        Période: {format(startDate, 'dd MMMM yyyy', { locale: fr })} - {format(endDate, 'dd MMMM yyyy', { locale: fr })}
      </div>

      {/* Summary stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          title="Sessions"
          value={summary.totalSessions.toString()}
          icon={<Target className="h-5 w-5" />}
          color="bg-blue-100 dark:bg-blue-900 text-blue-600"
          subtitle={`${summary.totalParticipants} participants`}
        />
        <SummaryCard
          title="Efficacité globale"
          value={`${summary.overallEffectiveness.toFixed(1)}/5`}
          icon={<Star className="h-5 w-5" />}
          color="bg-primary/10 text-primary"
          subtitle={getEffectivenessLabel(summary.overallEffectiveness)}
          progress={summary.overallEffectiveness * 20}
        />
        <SummaryCard
          title="Satisfaction (N1)"
          value={`${summary.averageSatisfaction.toFixed(1)}/5`}
          icon={<Smile className="h-5 w-5" />}
          color="bg-blue-100 dark:bg-blue-900 text-blue-600"
          progress={summary.averageSatisfaction * 20}
        />
        <SummaryCard
          title="Évaluations en attente"
          value={totalPending.toString()}
          icon={<ClipboardCheck className="h-5 w-5" />}
          color={totalPending > 0 ? 'bg-yellow-100 dark:bg-yellow-900 text-yellow-600' : 'bg-green-100 dark:bg-green-900 text-green-600'}
          subtitle={totalPending > 0 ? 'À compléter' : 'Tout est à jour'}
        />
      </div>

      {/* Kirkpatrick levels breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Scores par niveau Kirkpatrick</CardTitle>
          <CardDescription>
            Mesure de l'efficacité à chaque étape du processus de formation
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {([1, 2, 3, 4] as KirkpatrickLevel[]).map((level) => {
              const config = levelConfig[level];
              const levelInfo = KIRKPATRICK_LEVELS[level];
              const scores = {
                1: summary.averageSatisfaction,
                2: summary.averageLearning,
                3: summary.averageApplication,
                4: summary.averageImpact,
              };
              const score = scores[level];
              const pending = {
                1: pendingEvaluations.level1,
                2: pendingEvaluations.level2,
                3: pendingEvaluations.level3,
                4: pendingEvaluations.level4,
              }[level];

              return (
                <div key={level} className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className={`p-2.5 rounded-lg ${config.bg}`}>
                      <div className={config.color}>{config.icon}</div>
                    </div>
                    <div>
                      <p className="font-medium">Niveau {level}</p>
                      <p className="text-sm text-muted-foreground">{levelInfo.name}</p>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-bold">{score.toFixed(1)}</span>
                      <span className="text-muted-foreground">/ 5</span>
                    </div>
                    <Progress value={score * 20} className="h-2 mt-2" />
                  </div>

                  <p className="text-xs text-muted-foreground">
                    {levelInfo.timing}
                  </p>

                  {pending > 0 && (
                    <Badge variant="secondary" className="text-yellow-600">
                      {pending} en attente
                    </Badge>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Tabs for category breakdown and top courses */}
      <Tabs defaultValue="categories" className="space-y-4">
        <TabsList>
          <TabsTrigger value="categories">Par catégorie</TabsTrigger>
          <TabsTrigger value="top">Meilleures formations</TabsTrigger>
        </TabsList>

        <TabsContent value="categories">
          <Card>
            <CardHeader>
              <CardTitle>Performance par catégorie</CardTitle>
              <CardDescription>
                Score moyen par type de formation
              </CardDescription>
            </CardHeader>
            <CardContent>
              {dashboard?.byCategory && dashboard.byCategory.length > 0 ? (
                <div className="space-y-4">
                  {dashboard.byCategory.map((cat) => (
                    <div key={cat.category} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{cat.categoryLabel}</p>
                          <p className="text-sm text-muted-foreground">
                            {cat.sessionCount} session{cat.sessionCount > 1 ? 's' : ''} • {cat.participantCount} participant{cat.participantCount > 1 ? 's' : ''}
                          </p>
                        </div>
                        <div className="text-right">
                          <span className="text-lg font-bold">{cat.averageScore.toFixed(1)}</span>
                          <span className="text-muted-foreground">/5</span>
                        </div>
                      </div>
                      <Progress value={cat.averageScore * 20} className="h-2" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  Aucune donnée disponible pour cette période
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="top">
          <Card>
            <CardHeader>
              <CardTitle>Top des formations</CardTitle>
              <CardDescription>
                Formations les mieux notées sur la période
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <TrendingUp className="h-10 w-10 mx-auto mb-3 opacity-50" />
                <p>Le classement des formations sera disponible prochainement</p>
                <p className="text-sm mt-1">Les données seront agrégées une fois les évaluations complétées</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Pending evaluations by level */}
      {totalPending > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-yellow-600" />
              Évaluations en attente
            </CardTitle>
            <CardDescription>
              Rappels d'évaluations à compléter par les participants ou managers
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {([1, 2, 3, 4] as KirkpatrickLevel[]).map((level) => {
                const config = levelConfig[level];
                const levelInfo = KIRKPATRICK_LEVELS[level];
                const count = {
                  1: pendingEvaluations.level1,
                  2: pendingEvaluations.level2,
                  3: pendingEvaluations.level3,
                  4: pendingEvaluations.level4,
                }[level];

                if (count === 0) return null;

                return (
                  <div key={level} className="p-4 rounded-lg border">
                    <div className="flex items-center gap-3 mb-2">
                      <div className={`p-2 rounded-lg ${config.bg}`}>
                        <div className={config.color}>{config.icon}</div>
                      </div>
                      <div>
                        <p className="font-medium">Niveau {level}</p>
                        <p className="text-sm text-muted-foreground">{levelInfo.name}</p>
                      </div>
                    </div>
                    <p className="text-2xl font-bold">{count}</p>
                    <p className="text-sm text-muted-foreground">en attente</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {levelInfo.evaluator}
                    </p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// =============================================================================
// HELPER COMPONENTS
// =============================================================================

interface SummaryCardProps {
  title: string;
  value: string;
  icon: React.ReactNode;
  color: string;
  subtitle?: string;
  progress?: number;
}

function SummaryCard({ title, value, icon, color, subtitle, progress }: SummaryCardProps) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center gap-4">
          <div className={`p-3 rounded-lg ${color}`}>
            {icon}
          </div>
          <div className="flex-1">
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold">{value}</p>
            {subtitle && (
              <p className="text-xs text-muted-foreground">{subtitle}</p>
            )}
          </div>
        </div>
        {progress !== undefined && (
          <Progress value={progress} className="h-1.5 mt-4" />
        )}
      </CardContent>
    </Card>
  );
}

function ScoreBadge({ score }: { score: number }) {
  const color =
    score >= 4 ? 'text-green-600' :
    score >= 3 ? 'text-yellow-600' :
    'text-red-600';

  return (
    <span className={`font-medium ${color}`}>
      {score > 0 ? score.toFixed(1) : '-'}
    </span>
  );
}

function getEffectivenessLabel(score: number): string {
  if (score >= 4.5) return 'Excellent';
  if (score >= 4) return 'Très bien';
  if (score >= 3.5) return 'Bien';
  if (score >= 3) return 'Satisfaisant';
  if (score >= 2) return 'À améliorer';
  return 'Insuffisant';
}
