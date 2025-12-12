/**
 * Competency Assessment Dashboard
 *
 * Overview page for competency assessments showing:
 * - Quick actions (start self-assessment, view history)
 * - Pending assessments (manager reviews)
 * - Recent assessments
 * - Stats
 */

'use client';

import { useState } from 'react';
import Link from 'next/link';
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
  Target,
  ClipboardCheck,
  Clock,
  CheckCircle,
  Star,
  TrendingUp,
  Users,
  ChevronRight,
  PlayCircle,
  FileText,
} from 'lucide-react';

export default function AssessmentDashboardPage() {
  const [yearFilter, setYearFilter] = useState<string>('all');
  const currentYear = new Date().getFullYear();

  // Fetch skills (self-assessments)
  const { data: skillsData, isLoading: loadingSkills } = api.training.skills.list.useQuery({
    limit: 100,
  });

  // Fetch competencies (for count)
  const { data: competenciesData } = api.performance.competencies.list.useQuery({});

  const skills = skillsData?.data ?? [];
  const competencies = competenciesData ?? [];

  // Filter by year if needed
  const filteredSkills = yearFilter === 'all'
    ? skills
    : skills.filter(s => new Date(s.createdAt).getFullYear().toString() === yearFilter);

  // Compute stats
  const totalCompetencies = competencies.length;
  const assessedCompetencies = new Set(skills.map(s => s.linkedCompetencyId)).size;
  const coveragePercent = totalCompetencies > 0
    ? Math.round((assessedCompetencies / totalCompetencies) * 100)
    : 0;
  const avgLevel = skills.length > 0
    ? (skills.reduce((sum, s) => sum + s.proficiencyLevel, 0) / skills.length).toFixed(1)
    : '0';
  const validatedCount = skills.filter(s => s.isValidated).length;
  const pendingValidationCount = skills.filter(s => !s.isValidated).length;

  // Years for filter
  const availableYears = [...new Set(skills.map(s => new Date(s.createdAt).getFullYear()))].sort((a, b) => b - a);

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Target className="h-8 w-8 text-primary" />
            Évaluation des compétences
          </h1>
          <p className="text-muted-foreground mt-1">
            Évaluez vos compétences et suivez votre progression
          </p>
        </div>

        <Button asChild className="min-h-[48px]">
          <Link href="/competencies/assessment/self">
            <PlayCircle className="mr-2 h-5 w-5" />
            Démarrer une auto-évaluation
          </Link>
        </Button>
      </div>

      {/* Stats cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-primary/10 rounded-lg">
                <ClipboardCheck className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Compétences évaluées</p>
                <p className="text-2xl font-bold">{assessedCompetencies} / {totalCompetencies}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-amber-100 rounded-lg">
                <TrendingUp className="h-6 w-6 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Niveau moyen</p>
                <p className="text-2xl font-bold">{avgLevel} / 5</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-100 rounded-lg">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Validées</p>
                <p className="text-2xl font-bold">{validatedCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-100 rounded-lg">
                <Clock className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">En attente de validation</p>
                <p className="text-2xl font-bold">{pendingValidationCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Coverage progress */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Couverture des compétences</CardTitle>
          <CardDescription>
            Progression de votre auto-évaluation sur le référentiel
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span>{assessedCompetencies} compétences évaluées</span>
              <span className="font-medium">{coveragePercent}%</span>
            </div>
            <Progress value={coveragePercent} className="h-3" />
            {coveragePercent < 100 && (
              <p className="text-sm text-muted-foreground">
                Il reste {totalCompetencies - assessedCompetencies} compétences à évaluer
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Quick actions */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Link href="/competencies/assessment/self">
          <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-primary/10 rounded-lg">
                  <PlayCircle className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1">
                  <h3 className="font-medium">Auto-évaluation</h3>
                  <p className="text-sm text-muted-foreground">
                    Évaluez vos compétences
                  </p>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/competencies/skills">
          <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-100 rounded-lg">
                  <FileText className="h-6 w-6 text-blue-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-medium">Mes compétences</h3>
                  <p className="text-sm text-muted-foreground">
                    Voir mon inventaire
                  </p>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/competencies/gap-analysis">
          <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-amber-100 rounded-lg">
                  <TrendingUp className="h-6 w-6 text-amber-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-medium">Analyse des écarts</h3>
                  <p className="text-sm text-muted-foreground">
                    Identifier les besoins
                  </p>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Recent assessments */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <CardTitle>Évaluations récentes</CardTitle>
              <CardDescription>
                Vos dernières auto-évaluations
              </CardDescription>
            </div>
            <Select value={yearFilter} onValueChange={setYearFilter}>
              <SelectTrigger className="w-[150px] min-h-[44px]">
                <SelectValue placeholder="Année" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes</SelectItem>
                {availableYears.map((year) => (
                  <SelectItem key={year} value={year.toString()}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {loadingSkills ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : filteredSkills.length === 0 ? (
            <div className="py-12 text-center">
              <Target className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">Aucune évaluation</h3>
              <p className="text-muted-foreground mb-4">
                Commencez par évaluer vos compétences
              </p>
              <Button asChild>
                <Link href="/competencies/assessment/self">
                  <PlayCircle className="mr-2 h-4 w-4" />
                  Démarrer
                </Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredSkills.slice(0, 10).map((skill) => (
                <div
                  key={skill.id}
                  className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg"
                >
                  <div className="p-2 bg-background rounded-lg">
                    <Target className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{skill.skillName}</p>
                    <p className="text-xs text-muted-foreground">
                      {skill.skillCategory} • {new Date(skill.createdAt).toLocaleDateString('fr-FR')}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {/* Rating stars */}
                    <div className="flex gap-0.5">
                      {[1, 2, 3, 4, 5].map((level) => (
                        <Star
                          key={level}
                          className={`h-4 w-4 ${
                            level <= skill.proficiencyLevel
                              ? 'text-yellow-500 fill-yellow-500'
                              : 'text-muted'
                          }`}
                        />
                      ))}
                    </div>
                    {/* Validation status */}
                    <Badge
                      variant="outline"
                      className={skill.isValidated ? 'text-green-600' : 'text-amber-600'}
                    >
                      {skill.isValidated ? 'Validé' : 'En attente'}
                    </Badge>
                  </div>
                </div>
              ))}

              {filteredSkills.length > 10 && (
                <div className="text-center pt-4">
                  <Button variant="outline" asChild>
                    <Link href="/competencies/skills">
                      Voir toutes ({filteredSkills.length})
                      <ChevronRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Info card for managers */}
      <Card className="border-blue-200 bg-blue-50/50">
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Users className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h3 className="font-medium text-blue-900">Vous êtes manager ?</h3>
              <p className="text-sm text-blue-700 mt-1">
                Accédez à la page Performance pour valider les évaluations de votre équipe
                et conduire les entretiens d&apos;évaluation.
              </p>
              <Button variant="outline" size="sm" className="mt-3" asChild>
                <Link href="/performance">
                  Accéder à Performance
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
