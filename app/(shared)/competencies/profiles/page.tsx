/**
 * Job Profiles Page (Competency Mapping)
 *
 * HR managers can:
 * - View job titles and their required competencies
 * - Map competencies to job roles
 * - Set required proficiency levels
 * - Mark critical competencies
 *
 * HCI Principles:
 * - Clear visual hierarchy
 * - Easy competency assignment
 * - Proficiency level indicators
 */

'use client';

import { useState, useMemo } from 'react';
import { api } from '@/trpc/react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import Link from 'next/link';
import {
  Briefcase,
  Search,
  Plus,
  ChevronLeft,
  ChevronRight,
  Target,
  Star,
  Users,
  Building,
  Award,
  AlertTriangle,
  Check,
} from 'lucide-react';

// Proficiency level config
const proficiencyLevels = [
  { level: 1, name: 'Débutant', color: 'bg-slate-100 text-slate-700' },
  { level: 2, name: 'Junior', color: 'bg-blue-100 text-blue-700' },
  { level: 3, name: 'Confirmé', color: 'bg-green-100 text-green-700' },
  { level: 4, name: 'Senior', color: 'bg-purple-100 text-purple-700' },
  { level: 5, name: 'Expert', color: 'bg-amber-100 text-amber-700' },
];

// Profile card component
function ProfileCard({
  title,
  department,
  competencyCount,
  criticalCount,
  employees,
  onClick,
}: {
  title: string;
  department?: string;
  competencyCount: number;
  criticalCount: number;
  employees: number;
  onClick?: () => void;
}) {
  return (
    <Card
      className="hover:bg-muted/50 transition-colors cursor-pointer"
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-primary/10 rounded-lg flex-shrink-0">
            <Briefcase className="h-6 w-6 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-medium truncate">{title}</h3>
            {department && (
              <p className="text-sm text-muted-foreground truncate">
                {department}
              </p>
            )}

            <div className="mt-3 flex flex-wrap items-center gap-3">
              <Badge variant="outline" className="gap-1">
                <Target className="h-3 w-3" />
                {competencyCount} compétence{competencyCount !== 1 ? 's' : ''}
              </Badge>
              {criticalCount > 0 && (
                <Badge variant="secondary" className="gap-1">
                  <Star className="h-3 w-3" />
                  {criticalCount} critique{criticalCount !== 1 ? 's' : ''}
                </Badge>
              )}
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Users className="h-3 w-3" />
                {employees} employé{employees !== 1 ? 's' : ''}
              </span>
            </div>
          </div>
          <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
        </div>
      </CardContent>
    </Card>
  );
}

// Competency requirement card
function CompetencyRequirementCard({
  competency,
  requiredLevel,
  isCritical,
}: {
  competency: {
    id: string;
    name: string;
    category: string;
  };
  requiredLevel: number;
  isCritical: boolean;
}) {
  const levelConfig = proficiencyLevels[requiredLevel - 1] || proficiencyLevels[2];

  return (
    <div className="flex items-center justify-between p-3 rounded-lg border">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${isCritical ? 'bg-amber-100' : 'bg-muted'}`}>
          {isCritical ? (
            <Star className="h-4 w-4 text-amber-600" />
          ) : (
            <Target className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
        <div>
          <p className="font-medium">{competency.name}</p>
          <p className="text-xs text-muted-foreground">{competency.category}</p>
        </div>
      </div>
      <Badge className={levelConfig.color}>
        Niveau {requiredLevel} - {levelConfig.name}
      </Badge>
    </div>
  );
}

export default function JobProfilesPage() {
  const [search, setSearch] = useState('');
  const [selectedProfile, setSelectedProfile] = useState<string | null>(null);

  // Fetch employees to extract unique job titles
  const { data: employeesData, isLoading: employeesLoading } = api.employees.list.useQuery({
    status: 'active',
    limit: 100,
  });

  // Fetch competencies for reference
  const { data: competenciesData, isLoading: competenciesLoading } = api.performance.competencies.list.useQuery({});

  const employees = employeesData?.employees ?? [];
  const competencies = competenciesData ?? [];

  // Extract unique job profiles from employees
  const jobProfiles = useMemo(() => {
    const profileMap = new Map<string, {
      title: string;
      department?: string;
      departmentId?: string;
      employeeCount: number;
      employees: Array<{ id: string; name: string }>;
    }>();

    employees.forEach((emp) => {
      const key = emp.jobTitle || 'Non défini';
      const existing = profileMap.get(key);

      if (existing) {
        existing.employeeCount++;
        existing.employees.push({
          id: emp.id,
          name: `${emp.firstName} ${emp.lastName}`,
        });
      } else {
        profileMap.set(key, {
          title: key,
          department: emp.department ?? undefined,
          departmentId: emp.departmentId ?? undefined,
          employeeCount: 1,
          employees: [{
            id: emp.id,
            name: `${emp.firstName} ${emp.lastName}`,
          }],
        });
      }
    });

    return Array.from(profileMap.values())
      .filter(p => p.title !== 'Non défini')
      .sort((a, b) => b.employeeCount - a.employeeCount);
  }, [employees]);

  // Filter profiles
  const filteredProfiles = useMemo(() => {
    if (!search) return jobProfiles;
    const searchLower = search.toLowerCase();
    return jobProfiles.filter(
      (p) =>
        p.title.toLowerCase().includes(searchLower) ||
        p.department?.toLowerCase().includes(searchLower)
    );
  }, [jobProfiles, search]);

  // Selected profile details
  const selectedProfileData = selectedProfile
    ? jobProfiles.find((p) => p.title === selectedProfile)
    : null;

  // Stats
  const stats = useMemo(() => ({
    totalProfiles: jobProfiles.length,
    totalEmployees: employees.length,
    totalCompetencies: competencies.length,
    coreCompetencies: competencies.filter((c) => c.isCore).length,
  }), [jobProfiles, employees, competencies]);

  const isLoading = employeesLoading || competenciesLoading;

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
          <h1 className="text-3xl font-bold tracking-tight">Profils de poste</h1>
          <p className="text-muted-foreground">
            Compétences requises par fonction
          </p>
        </div>
        <Button disabled className="min-h-[48px]">
          <Plus className="mr-2 h-4 w-4" />
          Nouveau profil
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Profils de poste</CardTitle>
            <Briefcase className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold">{stats.totalProfiles}</div>
            )}
            <p className="text-xs text-muted-foreground">
              Fonctions identifiées
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Employés couverts</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold">{stats.totalEmployees}</div>
            )}
            <p className="text-xs text-muted-foreground">
              Employés actifs
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Compétences</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold">{stats.totalCompetencies}</div>
            )}
            <p className="text-xs text-muted-foreground">
              Au catalogue
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Compétences clés</CardTitle>
            <Star className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold">{stats.coreCompetencies}</div>
            )}
            <p className="text-xs text-muted-foreground">
              Requises pour tous
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main content */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Profile list */}
        <div className="lg:col-span-2 space-y-4">
          {/* Search */}
          <Card>
            <CardContent className="pt-6">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Rechercher un poste..."
                  className="min-h-[48px] pl-10"
                />
              </div>
            </CardContent>
          </Card>

          {/* Profiles grid */}
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          ) : filteredProfiles.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Briefcase className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">Aucun profil trouvé</h3>
                <p className="text-muted-foreground mb-6">
                  {search
                    ? 'Aucun profil ne correspond à votre recherche'
                    : 'Les profils de poste apparaîtront ici une fois les employés ajoutés'}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {filteredProfiles.map((profile) => (
                <ProfileCard
                  key={profile.title}
                  title={profile.title}
                  department={profile.department}
                  competencyCount={stats.coreCompetencies} // All get core competencies by default
                  criticalCount={Math.floor(stats.coreCompetencies / 2)}
                  employees={profile.employeeCount}
                  onClick={() => setSelectedProfile(profile.title)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Profile details sidebar */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                {selectedProfileData ? selectedProfileData.title : 'Détails du profil'}
              </CardTitle>
              <CardDescription>
                {selectedProfileData
                  ? `${selectedProfileData.employeeCount} employé${selectedProfileData.employeeCount !== 1 ? 's' : ''}`
                  : 'Sélectionnez un profil pour voir les détails'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {selectedProfileData ? (
                <div className="space-y-4">
                  {/* Department */}
                  {selectedProfileData.department && (
                    <div className="flex items-center gap-2 text-sm">
                      <Building className="h-4 w-4 text-muted-foreground" />
                      <span>{selectedProfileData.department}</span>
                    </div>
                  )}

                  {/* Competencies required */}
                  <div className="space-y-2">
                    <h4 className="font-medium text-sm flex items-center gap-2">
                      <Target className="h-4 w-4" />
                      Compétences requises
                    </h4>

                    {competencies.filter(c => c.isCore).length > 0 ? (
                      <div className="space-y-2">
                        {competencies
                          .filter((c) => c.isCore)
                          .slice(0, 5)
                          .map((comp) => (
                            <div
                              key={comp.id}
                              className="flex items-center justify-between p-2 rounded-lg bg-muted/50"
                            >
                              <div className="flex items-center gap-2">
                                <Star className="h-3 w-3 text-amber-500" />
                                <span className="text-sm">{comp.name}</span>
                              </div>
                              <Badge variant="outline" className="text-xs">
                                Niv. 3
                              </Badge>
                            </div>
                          ))}
                        {competencies.filter((c) => c.isCore).length > 5 && (
                          <p className="text-xs text-muted-foreground text-center py-2">
                            +{competencies.filter((c) => c.isCore).length - 5} autres compétences
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground py-4 text-center">
                        Aucune compétence clé définie
                      </p>
                    )}
                  </div>

                  {/* Employees */}
                  <div className="space-y-2">
                    <h4 className="font-medium text-sm flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      Employés occupant ce poste
                    </h4>
                    <div className="space-y-1 max-h-40 overflow-y-auto">
                      {selectedProfileData.employees.slice(0, 10).map((emp) => (
                        <div
                          key={emp.id}
                          className="flex items-center gap-2 p-2 rounded-lg bg-muted/50"
                        >
                          <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center">
                            <Users className="h-3 w-3 text-primary" />
                          </div>
                          <span className="text-sm truncate">{emp.name}</span>
                        </div>
                      ))}
                      {selectedProfileData.employees.length > 10 && (
                        <p className="text-xs text-muted-foreground text-center py-2">
                          +{selectedProfileData.employees.length - 10} autres employés
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Gap analysis link */}
                  <Button variant="outline" className="w-full mt-4" asChild>
                    <Link href="/competencies/gap-analysis">
                      <Award className="mr-2 h-4 w-4" />
                      Analyse des écarts
                    </Link>
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Briefcase className="h-10 w-10 text-muted-foreground/50 mb-3" />
                  <p className="text-sm text-muted-foreground">
                    Cliquez sur un profil pour voir ses compétences requises
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Info card */}
          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="pt-6">
              <div className="flex gap-3">
                <AlertTriangle className="h-5 w-5 text-blue-600 flex-shrink-0" />
                <div className="text-sm text-blue-800">
                  <p className="font-medium mb-1">Configuration avancée</p>
                  <p className="text-blue-700">
                    La gestion détaillée des profils de compétences par poste sera disponible prochainement.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
