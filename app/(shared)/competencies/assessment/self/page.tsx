/**
 * Competency Self-Assessment Page
 *
 * Self-assessment wizard for employees to evaluate their competencies.
 * - Select competencies from catalog
 * - Rate proficiency levels
 * - Provide evidence/notes
 * - Submit for manager validation
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/trpc/react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
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
  ChevronRight,
  ChevronLeft,
  Check,
  Star,
  Zap,
  Users,
  Briefcase,
  BookOpen,
  Send,
  Info,
} from 'lucide-react';
import { toast } from 'sonner';

// Proficiency level config
const proficiencyLevels = [
  { level: 1, name: 'Débutant', description: 'Connaissances de base, nécessite une supervision' },
  { level: 2, name: 'Junior', description: 'Capable d\'appliquer avec un peu de guidance' },
  { level: 3, name: 'Intermédiaire', description: 'Autonome dans les situations courantes' },
  { level: 4, name: 'Confirmé', description: 'Expert, peut former les autres' },
  { level: 5, name: 'Expert', description: 'Référence, innove et définit les standards' },
];

// Category icons
const categoryIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  technique: Zap,
  comportementale: Users,
  metier: Briefcase,
  leadership: BookOpen,
  default: Target,
};

// Assessment item type
interface AssessmentItem {
  competencyId: string;
  competencyName: string;
  competencyCode: string;
  category: string;
  currentLevel: number;
  targetLevel?: number;
  notes: string;
}

// Rating component
function ProficiencyRating({
  value,
  onChange,
  showLabels = true,
}: {
  value: number;
  onChange: (level: number) => void;
  showLabels?: boolean;
}) {
  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        {proficiencyLevels.map((level) => (
          <button
            key={level.level}
            type="button"
            onClick={() => onChange(level.level)}
            className={`flex-1 p-3 rounded-lg border-2 transition-all ${
              level.level === value
                ? 'border-primary bg-primary/10'
                : 'border-muted hover:border-primary/50'
            }`}
          >
            <div className="text-center">
              <div className={`text-lg font-bold ${level.level === value ? 'text-primary' : ''}`}>
                {level.level}
              </div>
              {showLabels && (
                <div className="text-xs text-muted-foreground mt-1">{level.name}</div>
              )}
            </div>
          </button>
        ))}
      </div>
      {value > 0 && (
        <div className="p-3 bg-muted/50 rounded-lg">
          <p className="text-sm font-medium">{proficiencyLevels[value - 1].name}</p>
          <p className="text-xs text-muted-foreground">{proficiencyLevels[value - 1].description}</p>
        </div>
      )}
    </div>
  );
}

export default function AssessmentPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [selectedCompetencies, setSelectedCompetencies] = useState<string[]>([]);
  const [assessments, setAssessments] = useState<AssessmentItem[]>([]);
  const [currentAssessmentIndex, setCurrentAssessmentIndex] = useState(0);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  const utils = api.useUtils();

  // Fetch competencies catalog
  const { data: competenciesData, isLoading: loadingCompetencies } = api.performance.competencies.list.useQuery({
    category: categoryFilter !== 'all' ? categoryFilter : undefined,
  });

  // Fetch categories
  const { data: categories } = api.performance.competencies.getCategories.useQuery();

  // Create skill mutation (to save self-assessments as skills)
  const createSkill = api.training.skills.create.useMutation({
    onError: (error) => {
      toast.error(error.message || 'Erreur lors de l\'enregistrement');
    },
  });

  const competencies = competenciesData ?? [];

  // Initialize assessments when competencies are selected
  useEffect(() => {
    if (step === 2 && selectedCompetencies.length > 0) {
      const newAssessments = selectedCompetencies.map((compId) => {
        const comp = competencies.find((c) => c.id === compId);
        return {
          competencyId: compId,
          competencyName: comp?.name || '',
          competencyCode: comp?.code || '',
          category: comp?.category || '',
          currentLevel: 0,
          notes: '',
        };
      });
      setAssessments(newAssessments);
      setCurrentAssessmentIndex(0);
    }
  }, [step, selectedCompetencies, competencies]);

  const toggleCompetency = (id: string) => {
    setSelectedCompetencies((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  };

  const updateAssessment = (index: number, updates: Partial<AssessmentItem>) => {
    setAssessments((prev) =>
      prev.map((a, i) => (i === index ? { ...a, ...updates } : a))
    );
  };

  const handleSubmit = async () => {
    // Validate all assessments have a level
    const incomplete = assessments.filter((a) => a.currentLevel === 0);
    if (incomplete.length > 0) {
      toast.error(`${incomplete.length} compétence(s) non évaluée(s)`);
      return;
    }

    try {
      // Save each assessment as a skill
      for (const assessment of assessments) {
        await createSkill.mutateAsync({
          skillName: assessment.competencyName,
          skillCategory: assessment.category,
          proficiencyLevel: assessment.currentLevel,
          source: 'self_declared',
          evidenceNotes: assessment.notes || undefined,
          linkedCompetencyId: assessment.competencyId,
        });
      }

      toast.success('Auto-évaluation enregistrée avec succès');
      utils.training.skills.list.invalidate();
      router.push('/competencies/skills');
    } catch {
      // Error already handled in mutation
    }
  };

  const currentAssessment = assessments[currentAssessmentIndex];
  const progress = step === 1 ? 0 : step === 2
    ? ((currentAssessmentIndex + 1) / assessments.length) * 80 + 10
    : 100;

  // Step 1: Select competencies
  if (step === 1) {
    return (
      <div className="container mx-auto py-6 space-y-6 max-w-4xl">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">Auto-évaluation</h1>
          <p className="text-muted-foreground mt-1">
            Étape 1/3 : Sélectionnez les compétences à évaluer
          </p>
        </div>

        {/* Progress */}
        <Progress value={progress} className="h-2" />

        {/* Category filter */}
        <Card>
          <CardContent className="pt-6">
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full sm:w-[250px] min-h-[48px]">
                <SelectValue placeholder="Filtrer par catégorie" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes les catégories</SelectItem>
                {categories?.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* Competencies list */}
        {loadingCompetencies ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        ) : competencies.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Target className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">Aucune compétence disponible</h3>
              <p className="text-muted-foreground">
                Contactez les RH pour ajouter des compétences au catalogue
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {competencies.map((comp) => {
              const isSelected = selectedCompetencies.includes(comp.id);
              const CategoryIcon = categoryIcons[comp.category.toLowerCase()] || categoryIcons.default;

              return (
                <Card
                  key={comp.id}
                  className={`cursor-pointer transition-all ${
                    isSelected
                      ? 'border-primary bg-primary/5'
                      : 'hover:border-primary/50'
                  }`}
                  onClick={() => toggleCompetency(comp.id)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div
                        className={`p-2 rounded-lg ${
                          isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted'
                        }`}
                      >
                        {isSelected ? (
                          <Check className="h-5 w-5" />
                        ) : (
                          <CategoryIcon className="h-5 w-5" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium truncate">{comp.name}</h3>
                        <p className="text-xs text-muted-foreground">{comp.code}</p>
                        <Badge variant="outline" className="text-xs mt-1">
                          {comp.category}
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Selection summary and next button */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <p className="font-medium">
                  {selectedCompetencies.length} compétence(s) sélectionnée(s)
                </p>
                <p className="text-sm text-muted-foreground">
                  Sélectionnez au moins 1 compétence pour continuer
                </p>
              </div>
              <Button
                onClick={() => setStep(2)}
                disabled={selectedCompetencies.length === 0}
                className="min-h-[48px] w-full sm:w-auto"
              >
                Continuer
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Step 2: Rate each competency
  if (step === 2 && currentAssessment) {
    const CategoryIcon = categoryIcons[currentAssessment.category.toLowerCase()] || categoryIcons.default;

    return (
      <div className="container mx-auto py-6 space-y-6 max-w-2xl">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">Auto-évaluation</h1>
          <p className="text-muted-foreground mt-1">
            Étape 2/3 : Évaluez votre niveau ({currentAssessmentIndex + 1}/{assessments.length})
          </p>
        </div>

        {/* Progress */}
        <Progress value={progress} className="h-2" />

        {/* Current competency */}
        <Card>
          <CardHeader>
            <div className="flex items-start gap-4">
              <div className="p-3 bg-primary/10 rounded-lg">
                <CategoryIcon className="h-6 w-6 text-primary" />
              </div>
              <div>
                <CardTitle>{currentAssessment.competencyName}</CardTitle>
                <CardDescription>
                  {currentAssessment.competencyCode} • {currentAssessment.category}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Rating */}
            <div className="space-y-3">
              <Label className="text-base">Quel est votre niveau actuel ?</Label>
              <ProficiencyRating
                value={currentAssessment.currentLevel}
                onChange={(level) => updateAssessment(currentAssessmentIndex, { currentLevel: level })}
              />
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes">
                Preuves / Exemples (optionnel)
              </Label>
              <Textarea
                id="notes"
                placeholder="Décrivez des exemples concrets de projets ou réalisations qui démontrent ce niveau..."
                value={currentAssessment.notes}
                onChange={(e) => updateAssessment(currentAssessmentIndex, { notes: e.target.value })}
                className="min-h-[100px]"
              />
              <p className="text-xs text-muted-foreground">
                <Info className="h-3 w-3 inline mr-1" />
                Les preuves aident à la validation par votre manager
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Navigation */}
        <div className="flex justify-between gap-4">
          <Button
            variant="outline"
            onClick={() => {
              if (currentAssessmentIndex > 0) {
                setCurrentAssessmentIndex((prev) => prev - 1);
              } else {
                setStep(1);
              }
            }}
            className="min-h-[48px]"
          >
            <ChevronLeft className="mr-2 h-4 w-4" />
            Précédent
          </Button>

          <Button
            onClick={() => {
              if (currentAssessmentIndex < assessments.length - 1) {
                setCurrentAssessmentIndex((prev) => prev + 1);
              } else {
                setStep(3);
              }
            }}
            disabled={currentAssessment.currentLevel === 0}
            className="min-h-[48px]"
          >
            {currentAssessmentIndex < assessments.length - 1 ? (
              <>
                Suivant
                <ChevronRight className="ml-2 h-4 w-4" />
              </>
            ) : (
              <>
                Voir le récapitulatif
                <ChevronRight className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>
        </div>

        {/* Quick navigation dots */}
        <div className="flex justify-center gap-2">
          {assessments.map((_, index) => (
            <button
              key={index}
              type="button"
              onClick={() => setCurrentAssessmentIndex(index)}
              className={`w-3 h-3 rounded-full transition-colors ${
                index === currentAssessmentIndex
                  ? 'bg-primary'
                  : assessments[index].currentLevel > 0
                  ? 'bg-primary/50'
                  : 'bg-muted'
              }`}
            />
          ))}
        </div>
      </div>
    );
  }

  // Step 3: Review and submit
  return (
    <div className="container mx-auto py-6 space-y-6 max-w-2xl">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Auto-évaluation</h1>
        <p className="text-muted-foreground mt-1">
          Étape 3/3 : Vérifiez et soumettez
        </p>
      </div>

      {/* Progress */}
      <Progress value={100} className="h-2" />

      {/* Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Récapitulatif de votre auto-évaluation</CardTitle>
          <CardDescription>
            Vérifiez vos évaluations avant de soumettre
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {assessments.map((assessment, index) => {
            const CategoryIcon = categoryIcons[assessment.category.toLowerCase()] || categoryIcons.default;

            return (
              <div
                key={assessment.competencyId}
                className="flex items-center gap-4 p-3 bg-muted/50 rounded-lg"
              >
                <div className="p-2 bg-background rounded-lg">
                  <CategoryIcon className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{assessment.competencyName}</p>
                  <p className="text-xs text-muted-foreground">{assessment.category}</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((level) => (
                      <Star
                        key={level}
                        className={`h-4 w-4 ${
                          level <= assessment.currentLevel
                            ? 'text-yellow-500 fill-yellow-500'
                            : 'text-muted'
                        }`}
                      />
                    ))}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setCurrentAssessmentIndex(index);
                      setStep(2);
                    }}
                  >
                    Modifier
                  </Button>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex justify-between gap-4">
        <Button
          variant="outline"
          onClick={() => {
            setCurrentAssessmentIndex(assessments.length - 1);
            setStep(2);
          }}
          className="min-h-[48px]"
        >
          <ChevronLeft className="mr-2 h-4 w-4" />
          Modifier
        </Button>

        <Button
          onClick={handleSubmit}
          disabled={createSkill.isPending}
          className="min-h-[48px]"
        >
          <Send className="mr-2 h-4 w-4" />
          {createSkill.isPending ? 'Enregistrement...' : 'Soumettre l\'évaluation'}
        </Button>
      </div>
    </div>
  );
}
