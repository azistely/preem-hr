/**
 * Competency Gap Analysis Page
 *
 * Visualizes the gap between required competencies and current levels:
 * - Spider/radar chart visualization
 * - Gap summary by employee or team
 * - Training recommendations
 * - Development priorities
 *
 * HCI Principles:
 * - Visual gap representation
 * - Actionable recommendations
 * - Progressive disclosure of details
 */

'use client';

import { useState, useMemo } from 'react';
import { api } from '@/trpc/react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import Link from 'next/link';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  ChevronLeft,
  Target,
  AlertTriangle,
  CheckCircle,
  Award,
  BookOpen,
  Users,
  User,
  ArrowRight,
  Lightbulb,
  GraduationCap,
} from 'lucide-react';

// Gap status configuration
const gapStatusConfig = {
  exceeds: { label: 'Dépasse', color: 'bg-green-100 text-green-800', icon: TrendingUp },
  meets: { label: 'Conforme', color: 'bg-blue-100 text-blue-800', icon: CheckCircle },
  developing: { label: 'En développement', color: 'bg-amber-100 text-amber-800', icon: Minus },
  gap: { label: 'Écart', color: 'bg-red-100 text-red-800', icon: TrendingDown },
};

// Proficiency levels
const proficiencyLevels = [
  { level: 1, name: 'Débutant' },
  { level: 2, name: 'Junior' },
  { level: 3, name: 'Confirmé' },
  { level: 4, name: 'Senior' },
  { level: 5, name: 'Expert' },
];

// Gap bar component
function GapBar({
  currentLevel,
  requiredLevel,
  compact = false,
}: {
  currentLevel: number;
  requiredLevel: number;
  compact?: boolean;
}) {
  const gap = currentLevel - requiredLevel;
  const percentage = (currentLevel / 5) * 100;
  const requiredPercentage = (requiredLevel / 5) * 100;

  return (
    <div className={`space-y-1 ${compact ? '' : 'w-full'}`}>
      <div className="relative h-2 w-full bg-muted rounded-full overflow-hidden">
        {/* Required level indicator */}
        <div
          className="absolute top-0 bottom-0 border-r-2 border-primary z-10"
          style={{ left: `${requiredPercentage}%` }}
        />
        {/* Current level bar */}
        <div
          className={`absolute top-0 bottom-0 left-0 rounded-full ${
            gap >= 0 ? 'bg-green-500' : 'bg-amber-500'
          }`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      {!compact && (
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Niveau actuel: {currentLevel}</span>
          <span>Requis: {requiredLevel}</span>
        </div>
      )}
    </div>
  );
}

// Gap summary card
function GapSummaryCard({
  title,
  value,
  icon: Icon,
  color,
  description,
}: {
  title: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  description: string;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold">{value}</p>
            <p className="text-xs text-muted-foreground mt-1">{description}</p>
          </div>
          <div className={`p-3 rounded-full ${color}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Training recommendation card
function TrainingRecommendation({
  competency,
  currentLevel,
  requiredLevel,
}: {
  competency: string;
  currentLevel: number;
  requiredLevel: number;
}) {
  const gap = requiredLevel - currentLevel;

  return (
    <div className="flex items-center justify-between p-4 rounded-lg border">
      <div className="flex items-center gap-4">
        <div className="p-2 bg-amber-100 rounded-lg">
          <Lightbulb className="h-5 w-5 text-amber-600" />
        </div>
        <div>
          <p className="font-medium">{competency}</p>
          <p className="text-sm text-muted-foreground">
            {gap === 1 ? '+1 niveau requis' : `+${gap} niveaux requis`}
          </p>
        </div>
      </div>
      <Button variant="outline" size="sm" asChild>
        <Link href="/training/catalog">
          <GraduationCap className="mr-2 h-4 w-4" />
          Formations
        </Link>
      </Button>
    </div>
  );
}

export default function GapAnalysisPage() {
  const [viewMode, setViewMode] = useState<'individual' | 'team'>('individual');
  const [selectedEmployee, setSelectedEmployee] = useState<string>('all');

  // Fetch employees
  const { data: employeesData, isLoading: employeesLoading } = api.employees.list.useQuery({
    status: 'active',
    limit: 100,
  });

  // Fetch competencies
  const { data: competenciesData, isLoading: competenciesLoading } = api.performance.competencies.list.useQuery({});

  // Fetch skills (employee competency assessments)
  const { data: skillsData, isLoading: skillsLoading } = api.training.skills.list.useQuery({
    employeeId: selectedEmployee !== 'all' ? selectedEmployee : undefined,
    limit: 100,
  });

  const employees = employeesData?.employees ?? [];
  const competencies = competenciesData ?? [];
  const skills = skillsData?.data ?? [];

  // Calculate gap analysis
  const gapAnalysis = useMemo(() => {
    const coreCompetencies = competencies.filter((c) => c.isCore);
    const requiredLevel = 3; // Default required level

    // Build skill map
    const skillMap = new Map<string, Map<string, number>>();
    skills.forEach((skill) => {
      if (!skill.employeeId) return;
      if (!skillMap.has(skill.employeeId)) {
        skillMap.set(skill.employeeId, new Map());
      }
      // Match by name or linked competency ID
      if (skill.linkedCompetencyId) {
        skillMap.get(skill.employeeId)!.set(skill.linkedCompetencyId, skill.proficiencyLevel);
      }
      skillMap.get(skill.employeeId)!.set(skill.skillName, skill.proficiencyLevel);
    });

    // Calculate gaps per competency
    const competencyGaps = coreCompetencies.map((comp) => {
      let totalCurrentLevel = 0;
      let assessedCount = 0;
      let gapCount = 0;
      let meetsCount = 0;
      let exceedsCount = 0;

      employees.forEach((emp) => {
        const empSkills = skillMap.get(emp.id);
        const level = empSkills?.get(comp.id) || empSkills?.get(comp.name) || 0;

        if (level > 0) {
          totalCurrentLevel += level;
          assessedCount++;

          if (level >= requiredLevel + 1) exceedsCount++;
          else if (level >= requiredLevel) meetsCount++;
          else gapCount++;
        }
      });

      const avgLevel = assessedCount > 0 ? totalCurrentLevel / assessedCount : 0;
      const gap = requiredLevel - avgLevel;

      return {
        competency: comp,
        requiredLevel,
        avgCurrentLevel: Math.round(avgLevel * 10) / 10,
        assessedCount,
        gapCount,
        meetsCount,
        exceedsCount,
        gap: Math.round(gap * 10) / 10,
        status:
          avgLevel >= requiredLevel + 1
            ? 'exceeds'
            : avgLevel >= requiredLevel
            ? 'meets'
            : avgLevel >= requiredLevel - 1
            ? 'developing'
            : 'gap',
      };
    });

    // Overall stats
    const totalGaps = competencyGaps.filter((g) => g.status === 'gap').length;
    const totalMeets = competencyGaps.filter((g) => g.status === 'meets' || g.status === 'exceeds').length;
    const totalDeveloping = competencyGaps.filter((g) => g.status === 'developing').length;
    const avgGap =
      competencyGaps.length > 0
        ? competencyGaps.reduce((acc, g) => acc + g.gap, 0) / competencyGaps.length
        : 0;

    return {
      competencyGaps,
      stats: {
        totalCompetencies: coreCompetencies.length,
        totalGaps,
        totalMeets,
        totalDeveloping,
        avgGap: Math.round(avgGap * 10) / 10,
        assessedEmployees: skillMap.size,
        totalEmployees: employees.length,
      },
    };
  }, [competencies, skills, employees]);

  const isLoading = employeesLoading || competenciesLoading || skillsLoading;

  // Training recommendations (competencies with gaps)
  const recommendations = gapAnalysis.competencyGaps
    .filter((g) => g.status === 'gap' || g.status === 'developing')
    .sort((a, b) => b.gap - a.gap)
    .slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/competencies">
            <ChevronLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight">Analyse des écarts</h1>
          <p className="text-muted-foreground">
            Écart entre compétences requises et niveaux actuels
          </p>
        </div>
        <Select value={viewMode} onValueChange={(v) => setViewMode(v as 'individual' | 'team')}>
          <SelectTrigger className="w-[180px] min-h-[48px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="team">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Vue équipe
              </div>
            </SelectItem>
            <SelectItem value="individual">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4" />
                Vue individuelle
              </div>
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <GapSummaryCard
          title="Compétences analysées"
          value={gapAnalysis.stats.totalCompetencies}
          icon={Target}
          color="bg-blue-100 text-blue-600"
          description="Compétences clés évaluées"
        />
        <GapSummaryCard
          title="Conformes"
          value={gapAnalysis.stats.totalMeets}
          icon={CheckCircle}
          color="bg-green-100 text-green-600"
          description="Niveaux atteints ou dépassés"
        />
        <GapSummaryCard
          title="En développement"
          value={gapAnalysis.stats.totalDeveloping}
          icon={TrendingUp}
          color="bg-amber-100 text-amber-600"
          description="Proche du niveau requis"
        />
        <GapSummaryCard
          title="Écarts identifiés"
          value={gapAnalysis.stats.totalGaps}
          icon={AlertTriangle}
          color="bg-red-100 text-red-600"
          description="Nécessitent une action"
        />
      </div>

      {/* Main content */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Gap analysis table */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Analyse par compétence</CardTitle>
              <CardDescription>
                Comparaison entre niveaux requis et niveaux moyens actuels
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : gapAnalysis.competencyGaps.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Target className="h-12 w-12 text-muted-foreground/50 mb-4" />
                  <h3 className="text-lg font-medium mb-2">Aucune compétence à analyser</h3>
                  <p className="text-muted-foreground max-w-sm">
                    Définissez des compétences clés pour commencer l&apos;analyse des écarts
                  </p>
                  <Button variant="link" asChild className="mt-4">
                    <Link href="/competencies">Gérer les compétences</Link>
                  </Button>
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Compétence</TableHead>
                        <TableHead>Niveau moyen</TableHead>
                        <TableHead>Requis</TableHead>
                        <TableHead>Écart</TableHead>
                        <TableHead>Statut</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {gapAnalysis.competencyGaps.map((item) => {
                        const statusConfig = gapStatusConfig[item.status as keyof typeof gapStatusConfig];
                        const StatusIcon = statusConfig.icon;

                        return (
                          <TableRow key={item.competency.id}>
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <div className="p-2 bg-primary/10 rounded-lg">
                                  <Target className="h-4 w-4 text-primary" />
                                </div>
                                <div>
                                  <p className="font-medium">{item.competency.name}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {item.assessedCount} évaluation{item.assessedCount !== 1 ? 's' : ''}
                                  </p>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{item.avgCurrentLevel || '—'}</span>
                                {item.avgCurrentLevel > 0 && (
                                  <span className="text-xs text-muted-foreground">
                                    / 5
                                  </span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{item.requiredLevel}</Badge>
                            </TableCell>
                            <TableCell>
                              {item.gap !== 0 ? (
                                <span className={item.gap > 0 ? 'text-red-600' : 'text-green-600'}>
                                  {item.gap > 0 ? `-${item.gap}` : `+${Math.abs(item.gap)}`}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">0</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge className={`gap-1 ${statusConfig.color}`}>
                                <StatusIcon className="h-3 w-3" />
                                {statusConfig.label}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Recommendations sidebar */}
        <div className="space-y-4">
          {/* Coverage stats */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Couverture des évaluations</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span>Employés évalués</span>
                    <span className="font-medium">
                      {gapAnalysis.stats.assessedEmployees} / {gapAnalysis.stats.totalEmployees}
                    </span>
                  </div>
                  <Progress
                    value={
                      gapAnalysis.stats.totalEmployees > 0
                        ? (gapAnalysis.stats.assessedEmployees / gapAnalysis.stats.totalEmployees) * 100
                        : 0
                    }
                  />
                </div>

                {gapAnalysis.stats.assessedEmployees < gapAnalysis.stats.totalEmployees && (
                  <div className="flex items-center gap-2 text-sm text-amber-600">
                    <AlertTriangle className="h-4 w-4" />
                    <span>
                      {gapAnalysis.stats.totalEmployees - gapAnalysis.stats.assessedEmployees} employé
                      {gapAnalysis.stats.totalEmployees - gapAnalysis.stats.assessedEmployees !== 1 ? 's' : ''} non évalué
                      {gapAnalysis.stats.totalEmployees - gapAnalysis.stats.assessedEmployees !== 1 ? 's' : ''}
                    </span>
                  </div>
                )}

                <Button variant="outline" className="w-full" asChild>
                  <Link href="/competencies/assessment">
                    <Target className="mr-2 h-4 w-4" />
                    Lancer une évaluation
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Recommendations */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Lightbulb className="h-5 w-5 text-amber-500" />
                Recommandations
              </CardTitle>
              <CardDescription>
                Formations suggérées pour combler les écarts
              </CardDescription>
            </CardHeader>
            <CardContent>
              {recommendations.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <CheckCircle className="h-10 w-10 text-green-500 mb-3" />
                  <p className="font-medium text-green-700">Aucun écart critique</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Toutes les compétences sont au niveau requis
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {recommendations.map((rec) => (
                    <div
                      key={rec.competency.id}
                      className="p-3 rounded-lg border bg-amber-50 border-amber-200"
                    >
                      <div className="flex items-start gap-3">
                        <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm">{rec.competency.name}</p>
                          <p className="text-xs text-muted-foreground">
                            Niveau actuel: {rec.avgCurrentLevel} → Requis: {rec.requiredLevel}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}

                  <Button variant="default" className="w-full mt-4" asChild>
                    <Link href="/training/catalog">
                      <BookOpen className="mr-2 h-4 w-4" />
                      Voir les formations
                    </Link>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick links */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Actions rapides</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button variant="outline" className="w-full justify-start" asChild>
                <Link href="/competencies/profiles">
                  <Users className="mr-2 h-4 w-4" />
                  Profils de poste
                </Link>
              </Button>
              <Button variant="outline" className="w-full justify-start" asChild>
                <Link href="/competencies/skills">
                  <Award className="mr-2 h-4 w-4" />
                  Inventaire des compétences
                </Link>
              </Button>
              <Button variant="outline" className="w-full justify-start" asChild>
                <Link href="/training/requests/new">
                  <GraduationCap className="mr-2 h-4 w-4" />
                  Demander une formation
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
