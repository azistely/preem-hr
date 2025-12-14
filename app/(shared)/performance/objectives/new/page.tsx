/**
 * New Objective Page
 *
 * Dedicated page for creating a new objective.
 * HCI-compliant wizard-style form for low digital literacy users.
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/trpc/react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import {
  ArrowLeft,
  Target,
  Building,
  Users,
  User,
  Calendar,
  Hash,
  Percent,
  FileText,
  CheckCircle2,
  Briefcase,
} from 'lucide-react';
import { toast } from 'sonner';

// Level options
const levelOptions = [
  {
    value: 'company',
    label: 'Entreprise',
    description: 'Objectif stratégique pour toute l\'organisation',
    icon: Building,
    color: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  },
  {
    value: 'team',
    label: 'Équipe',
    description: 'Objectif collectif pour un département ou une équipe',
    icon: Users,
    color: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300',
  },
  {
    value: 'individual',
    label: 'Individuel',
    description: 'Objectif personnel pour un employé',
    icon: User,
    color: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  },
];

// Type options
const typeOptions = [
  {
    value: 'quantitative',
    label: 'Quantitatif',
    description: 'Objectif mesurable avec des chiffres',
    example: 'Ex: Atteindre 100M FCFA de CA',
  },
  {
    value: 'qualitative',
    label: 'Qualitatif',
    description: 'Objectif basé sur la qualité',
    example: 'Ex: Améliorer la satisfaction client',
  },
  {
    value: 'behavioral',
    label: 'Comportemental',
    description: 'Objectif lié au comportement',
    example: 'Ex: Développer le leadership',
  },
  {
    value: 'project',
    label: 'Projet',
    description: 'Objectif lié à un projet spécifique',
    example: 'Ex: Lancer le nouveau site web',
  },
];

export default function NewObjectivePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const cycleIdParam = searchParams.get('cycleId');
  const utils = api.useUtils();

  // Form state
  const [cycleId, setCycleId] = useState(cycleIdParam || '');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [objectiveLevel, setObjectiveLevel] = useState<'company' | 'team' | 'individual'>('individual');
  const [objectiveType, setObjectiveType] = useState<'quantitative' | 'qualitative' | 'behavioral' | 'project'>('quantitative');
  const [weight, setWeight] = useState('');
  const [targetValue, setTargetValue] = useState('');
  const [targetUnit, setTargetUnit] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  // Multi-select for team objectives
  const [selectedDepartmentIds, setSelectedDepartmentIds] = useState<string[]>([]);
  const [selectedPositionIds, setSelectedPositionIds] = useState<string[]>([]);

  // Fetch cycles
  const { data: cyclesData, isLoading: cyclesLoading } = api.performance.cycles.list.useQuery({
    status: 'active',
    limit: 50,
  });

  // Fetch employees (for individual objectives)
  const { data: employeesData, isLoading: employeesLoading } = api.employees.list.useQuery({
    status: 'active',
    limit: 100,
  });

  // Fetch departments (for team objectives)
  const { data: departmentsData, isLoading: departmentsLoading } = api.performance.departments.list.useQuery({
    status: 'active',
  });

  // Fetch positions (for team objectives)
  const { data: positionsData, isLoading: positionsLoading } = api.positions.list.useQuery({});

  // Create mutation
  const createObjective = api.performance.objectives.create.useMutation({
    onSuccess: () => {
      toast.success('Objectif créé avec succès !');
      utils.performance.getGuideStatus.invalidate();
      router.push(`/performance/objectives${cycleId ? `?cycleId=${cycleId}` : ''}`);
    },
    onError: (error) => {
      toast.error(error.message || 'Erreur lors de la création de l\'objectif');
    },
  });

  const cycles = cyclesData?.data ?? [];
  const employees = employeesData?.employees ?? [];
  const departmentsList = departmentsData ?? [];
  const positionsList = positionsData ?? [];

  // Set default cycle if only one active
  useEffect(() => {
    if (!cycleId && cycles.length === 1) {
      setCycleId(cycles[0].id);
    }
  }, [cycles, cycleId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!cycleId) {
      toast.error('Veuillez sélectionner un cycle d\'évaluation');
      return;
    }

    if (!title.trim()) {
      toast.error('Veuillez saisir un titre pour l\'objectif');
      return;
    }

    // Require employee for individual objectives
    if (objectiveLevel === 'individual' && !employeeId) {
      toast.error('Veuillez sélectionner un collaborateur pour l\'objectif individuel');
      return;
    }

    // Require at least one department OR position for team objectives
    if (objectiveLevel === 'team' && selectedDepartmentIds.length === 0 && selectedPositionIds.length === 0) {
      toast.error('Veuillez sélectionner au moins un département ou un poste pour l\'objectif d\'équipe');
      return;
    }

    createObjective.mutate({
      cycleId,
      title: title.trim(),
      description: description.trim() || undefined,
      objectiveLevel,
      objectiveType,
      weight: weight || undefined,
      targetValue: targetValue || undefined,
      targetUnit: targetUnit || undefined,
      dueDate: dueDate || undefined,
      employeeId: objectiveLevel === 'individual' && employeeId ? employeeId : undefined,
      targetDepartmentIds: objectiveLevel === 'team' && selectedDepartmentIds.length > 0 ? selectedDepartmentIds : undefined,
      targetPositionIds: objectiveLevel === 'team' && selectedPositionIds.length > 0 ? selectedPositionIds : undefined,
    });
  };

  const selectedLevel = levelOptions.find((l) => l.value === objectiveLevel);
  const LevelIcon = selectedLevel?.icon || Target;

  return (
    <div className="container mx-auto py-6 max-w-2xl">
      {/* Header */}
      <div className="mb-6">
        <Link
          href={`/performance/objectives${cycleIdParam ? `?cycleId=${cycleIdParam}` : ''}`}
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Retour aux objectifs
        </Link>
        <h1 className="text-3xl font-bold">Nouvel objectif</h1>
        <p className="text-muted-foreground mt-1">
          Définissez un nouvel objectif de performance
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Step 1: Select Cycle */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Cycle d'évaluation
            </CardTitle>
            <CardDescription>
              Sélectionnez le cycle auquel cet objectif est rattaché
            </CardDescription>
          </CardHeader>
          <CardContent>
            {cyclesLoading ? (
              <Skeleton className="h-12 w-full" />
            ) : cycles.length === 0 ? (
              <div className="text-center py-4">
                <p className="text-muted-foreground mb-4">
                  Aucun cycle d'évaluation actif
                </p>
                <Button asChild variant="outline">
                  <Link href="/performance/cycles/new">Créer un cycle</Link>
                </Button>
              </div>
            ) : (
              <Select value={cycleId} onValueChange={setCycleId}>
                <SelectTrigger className="min-h-[48px]">
                  <SelectValue placeholder="Choisir un cycle..." />
                </SelectTrigger>
                <SelectContent>
                  {cycles.map((cycle) => (
                    <SelectItem key={cycle.id} value={cycle.id}>
                      {cycle.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </CardContent>
        </Card>

        {/* Step 2: Select Level */}
        <Card>
          <CardHeader>
            <CardTitle>Niveau de l'objectif</CardTitle>
            <CardDescription>
              À quel niveau cet objectif s'applique-t-il ?
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3">
              {levelOptions.map((level) => {
                const Icon = level.icon;
                const isSelected = objectiveLevel === level.value;
                return (
                  <button
                    key={level.value}
                    type="button"
                    onClick={() => setObjectiveLevel(level.value as typeof objectiveLevel)}
                    className={`flex items-start gap-4 p-4 rounded-lg border-2 text-left transition-all min-h-[72px] ${
                      isSelected
                        ? 'border-primary bg-primary/5'
                        : 'border-muted hover:border-primary/50'
                    }`}
                  >
                    <div className={`p-2 rounded-lg ${level.color}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">{level.label}</p>
                      <p className="text-sm text-muted-foreground">
                        {level.description}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Step 2b: Select Departments and/or Positions (for team objectives) */}
        {objectiveLevel === 'team' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Cible de l'objectif d'équipe
              </CardTitle>
              <CardDescription>
                Sélectionnez les départements et/ou postes concernés par cet objectif.
                Tous les employés correspondants seront inclus.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Departments selection */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Building className="h-4 w-4 text-muted-foreground" />
                  <Label className="font-medium">Départements</Label>
                  {selectedDepartmentIds.length > 0 && (
                    <span className="text-xs text-muted-foreground">
                      ({selectedDepartmentIds.length} sélectionné{selectedDepartmentIds.length > 1 ? 's' : ''})
                    </span>
                  )}
                </div>
                {departmentsLoading ? (
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                ) : departmentsList.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Aucun département configuré
                  </p>
                ) : (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {departmentsList.map((dept) => {
                      const isChecked = selectedDepartmentIds.includes(dept.id);
                      return (
                        <label
                          key={dept.id}
                          className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                            isChecked
                              ? 'border-primary bg-primary/5'
                              : 'border-muted hover:border-primary/50'
                          }`}
                        >
                          <Checkbox
                            checked={isChecked}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedDepartmentIds([...selectedDepartmentIds, dept.id]);
                              } else {
                                setSelectedDepartmentIds(selectedDepartmentIds.filter(id => id !== dept.id));
                              }
                            }}
                          />
                          <span className="flex-1 text-sm">
                            {dept.name}
                            {dept.code && (
                              <span className="text-muted-foreground ml-1">
                                ({dept.code})
                              </span>
                            )}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Positions selection */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Briefcase className="h-4 w-4 text-muted-foreground" />
                  <Label className="font-medium">Postes</Label>
                  {selectedPositionIds.length > 0 && (
                    <span className="text-xs text-muted-foreground">
                      ({selectedPositionIds.length} sélectionné{selectedPositionIds.length > 1 ? 's' : ''})
                    </span>
                  )}
                </div>
                {positionsLoading ? (
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                ) : positionsList.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Aucun poste configuré
                  </p>
                ) : (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {positionsList.map((pos) => {
                      const isChecked = selectedPositionIds.includes(pos.id);
                      return (
                        <label
                          key={pos.id}
                          className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                            isChecked
                              ? 'border-primary bg-primary/5'
                              : 'border-muted hover:border-primary/50'
                          }`}
                        >
                          <Checkbox
                            checked={isChecked}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedPositionIds([...selectedPositionIds, pos.id]);
                              } else {
                                setSelectedPositionIds(selectedPositionIds.filter(id => id !== pos.id));
                              }
                            }}
                          />
                          <span className="flex-1 text-sm">
                            {pos.title}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Selection summary */}
              {(selectedDepartmentIds.length > 0 || selectedPositionIds.length > 0) && (
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-sm text-muted-foreground">
                    Cet objectif s'appliquera à tous les employés{' '}
                    {selectedDepartmentIds.length > 0 && selectedPositionIds.length > 0
                      ? 'des départements et postes sélectionnés'
                      : selectedDepartmentIds.length > 0
                        ? `de ${selectedDepartmentIds.length} département${selectedDepartmentIds.length > 1 ? 's' : ''}`
                        : `occupant ${selectedPositionIds.length} poste${selectedPositionIds.length > 1 ? 's' : ''}`
                    }.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Step 2c: Select Employee (for individual objectives) */}
        {objectiveLevel === 'individual' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Collaborateur concerné
              </CardTitle>
              <CardDescription>
                À qui est attribué cet objectif individuel ?
              </CardDescription>
            </CardHeader>
            <CardContent>
              {employeesLoading ? (
                <Skeleton className="h-12 w-full" />
              ) : (
                <Select value={employeeId} onValueChange={setEmployeeId}>
                  <SelectTrigger className="min-h-[48px]">
                    <SelectValue placeholder="Choisir un collaborateur..." />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.map((emp) => (
                      <SelectItem key={emp.id} value={emp.id}>
                        {emp.firstName} {emp.lastName}
                        {emp.jobTitle && (
                          <span className="text-muted-foreground ml-2">
                            — {emp.jobTitle}
                          </span>
                        )}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </CardContent>
          </Card>
        )}

        {/* Step 3: Select Type */}
        <Card>
          <CardHeader>
            <CardTitle>Type d'objectif</CardTitle>
            <CardDescription>
              Quel type d'objectif souhaitez-vous créer ?
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2">
              {typeOptions.map((type) => {
                const isSelected = objectiveType === type.value;
                return (
                  <button
                    key={type.value}
                    type="button"
                    onClick={() => setObjectiveType(type.value as typeof objectiveType)}
                    className={`flex flex-col p-4 rounded-lg border-2 text-left transition-all min-h-[100px] ${
                      isSelected
                        ? 'border-primary bg-primary/5'
                        : 'border-muted hover:border-primary/50'
                    }`}
                  >
                    <p className="font-medium">{type.label}</p>
                    <p className="text-sm text-muted-foreground mb-2">
                      {type.description}
                    </p>
                    <p className="text-xs text-muted-foreground/80 italic">
                      {type.example}
                    </p>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Step 4: Content */}
        <Card>
          <CardHeader>
            <div className={`inline-flex items-center gap-2 p-2 rounded-lg ${selectedLevel?.color} w-fit mb-2`}>
              <LevelIcon className="h-4 w-4" />
              <span className="text-sm font-medium">{selectedLevel?.label}</span>
            </div>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Détails de l'objectif
            </CardTitle>
            <CardDescription>
              Décrivez l'objectif de manière claire et précise
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">
                Titre de l'objectif <span className="text-destructive">*</span>
              </Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex: Augmenter le chiffre d'affaires de 20%"
                className="min-h-[48px]"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description (optionnel)</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Décrivez l'objectif en détail, les critères de réussite, etc."
                rows={4}
                className="min-h-[100px]"
              />
            </div>
          </CardContent>
        </Card>

        {/* Step 5: Metrics (for quantitative objectives) */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Hash className="h-5 w-5" />
              Mesure et échéance
            </CardTitle>
            <CardDescription>
              Définissez comment mesurer l'atteinte de l'objectif
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="weight" className="flex items-center gap-1">
                  <Percent className="h-3 w-3" />
                  Poids (%)
                </Label>
                <Input
                  id="weight"
                  type="number"
                  min="0"
                  max="100"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  placeholder="25"
                  className="min-h-[48px]"
                />
                <p className="text-xs text-muted-foreground">
                  Importance relative de l'objectif
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="targetValue">Valeur cible</Label>
                <Input
                  id="targetValue"
                  type="number"
                  min="0"
                  value={targetValue}
                  onChange={(e) => setTargetValue(e.target.value)}
                  placeholder="100"
                  className="min-h-[48px]"
                />
                <p className="text-xs text-muted-foreground">
                  {objectiveType === 'quantitative' ? 'Chiffre à atteindre' : 'Optionnel'}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="targetUnit">Unité</Label>
                <Input
                  id="targetUnit"
                  value={targetUnit}
                  onChange={(e) => setTargetUnit(e.target.value)}
                  placeholder="MFCFA, %, clients..."
                  className="min-h-[48px]"
                />
                <p className="text-xs text-muted-foreground">
                  Unité de mesure
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="dueDate" className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                Date d'échéance
              </Label>
              <Input
                id="dueDate"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="min-h-[48px] w-full sm:w-[250px]"
              />
              <p className="text-xs text-muted-foreground">
                Date limite pour atteindre l'objectif
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex gap-4 justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push(`/performance/objectives${cycleIdParam ? `?cycleId=${cycleIdParam}` : ''}`)}
            className="min-h-[48px]"
          >
            Annuler
          </Button>
          <Button
            type="submit"
            disabled={createObjective.isPending || !cycleId || !title.trim()}
            className="min-h-[48px] min-w-[150px]"
          >
            {createObjective.isPending ? (
              'Création en cours...'
            ) : (
              <>
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Créer l'objectif
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
