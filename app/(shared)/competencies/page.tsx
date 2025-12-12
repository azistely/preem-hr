/**
 * Competencies Dashboard Page
 *
 * Overview of competency management:
 * - Competency catalog
 * - Skills inventory
 * - Gap analysis overview
 * - Assessment status
 */

'use client';

import { useState } from 'react';
import Link from 'next/link';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Target,
  Search,
  Plus,
  ChevronRight,
  Zap,
  Award,
  TrendingUp,
  Users,
  BookOpen,
  Star,
  Edit,
} from 'lucide-react';
import { toast } from 'sonner';

// Category icons
const categoryIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  technique: Zap,
  comportementale: Users,
  metier: BookOpen,
  leadership: Award,
  default: Target,
};

// Competency card component
function CompetencyCard({
  competency,
  onEdit,
}: {
  competency: {
    id: string;
    code: string;
    name: string;
    description: string | null;
    category: string;
    isCore: boolean | null;
    proficiencyLevels: unknown;
  };
  onEdit?: () => void;
}) {
  const CategoryIcon = categoryIcons[competency.category.toLowerCase()] || categoryIcons.default;
  const levels = competency.proficiencyLevels as Array<{
    level: number;
    name: string;
    description: string;
  }> | null;

  return (
    <Card className="hover:bg-muted/50 transition-colors h-full">
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-primary/10 rounded-lg flex-shrink-0">
            <CategoryIcon className="h-6 w-6 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 mb-1">
              <div className="min-w-0">
                <h3 className="font-medium truncate">{competency.name}</h3>
                <p className="text-xs text-muted-foreground">{competency.code}</p>
              </div>
              <div className="flex gap-1 flex-shrink-0">
                {competency.isCore && (
                  <Badge variant="secondary" className="text-xs">
                    <Star className="h-3 w-3 mr-1" />
                    Clé
                  </Badge>
                )}
                {onEdit && (
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onEdit}>
                    <Edit className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>

            {competency.description && (
              <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                {competency.description}
              </p>
            )}

            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="text-xs">
                {competency.category}
              </Badge>
              {levels && (
                <span className="text-xs text-muted-foreground">
                  {levels.length} niveaux
                </span>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function CompetenciesPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  // Form state for create
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    description: '',
    category: 'technique',
    isCore: false,
  });

  const utils = api.useUtils();

  // Fetch competencies
  const { data: competenciesList, isLoading } = api.performance.competencies.list.useQuery({
    category: categoryFilter !== 'all' ? categoryFilter : undefined,
    search: searchQuery || undefined,
  });

  // Fetch categories
  const { data: categories } = api.performance.competencies.getCategories.useQuery();

  // Create mutation
  const createCompetency = api.performance.competencies.create.useMutation({
    onSuccess: () => {
      toast.success('Compétence créée avec succès');
      setShowCreateDialog(false);
      resetForm();
      utils.performance.competencies.list.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || 'Erreur lors de la création');
    },
  });

  const competencies = competenciesList ?? [];

  // Stats
  const totalCompetencies = competencies.length;
  const coreCompetencies = competencies.filter((c) => c.isCore).length;
  const categoryCount = new Set(competencies.map((c) => c.category)).size;

  const resetForm = () => {
    setFormData({
      code: '',
      name: '',
      description: '',
      category: 'technique',
      isCore: false,
    });
  };

  const handleCreate = () => {
    createCompetency.mutate({
      code: formData.code,
      name: formData.name,
      description: formData.description || undefined,
      category: formData.category,
      isCore: formData.isCore,
      proficiencyLevels: [
        { level: 1, name: 'Débutant', description: 'Connaissances de base' },
        { level: 2, name: 'Junior', description: 'Application avec supervision' },
        { level: 3, name: 'Intermédiaire', description: 'Autonomie complète' },
        { level: 4, name: 'Senior', description: 'Expertise et mentorat' },
        { level: 5, name: 'Expert', description: 'Référence et innovation' },
      ],
    });
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Compétences</h1>
          <p className="text-muted-foreground mt-1">
            Catalogue et évaluation des compétences
          </p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)} className="min-h-[48px]">
          <Plus className="mr-2 h-4 w-4" />
          Nouvelle compétence
        </Button>
      </div>

      {/* Quick actions */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Link href="/competencies/assessment">
          <Card className="hover:bg-muted/50 transition-colors cursor-pointer h-full">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-100 dark:bg-blue-900 rounded-lg">
                  <Target className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="font-medium">Auto-évaluation</p>
                  <p className="text-sm text-muted-foreground">
                    Évaluez vos compétences
                  </p>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground ml-auto" />
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/competencies/skills">
          <Card className="hover:bg-muted/50 transition-colors cursor-pointer h-full">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-purple-100 dark:bg-purple-900 rounded-lg">
                  <Zap className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <p className="font-medium">Mes compétences</p>
                  <p className="text-sm text-muted-foreground">
                    Inventaire personnel
                  </p>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground ml-auto" />
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/training/certifications">
          <Card className="hover:bg-muted/50 transition-colors cursor-pointer h-full">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-green-100 dark:bg-green-900 rounded-lg">
                  <Award className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="font-medium">Certifications</p>
                  <p className="text-sm text-muted-foreground">
                    Attestations et diplômes
                  </p>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground ml-auto" />
              </div>
            </CardContent>
          </Card>
        </Link>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-orange-100 dark:bg-orange-900 rounded-lg">
                <TrendingUp className="h-6 w-6 text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Catalogue</p>
                <p className="text-2xl font-bold">{totalCompetencies}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Stats summary */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Compétences clés</p>
                <p className="text-2xl font-bold">{coreCompetencies}</p>
              </div>
              <Star className="h-8 w-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Catégories</p>
                <p className="text-2xl font-bold">{categoryCount}</p>
              </div>
              <BookOpen className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total</p>
                <p className="text-2xl font-bold">{totalCompetencies}</p>
              </div>
              <Target className="h-8 w-8 text-primary" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher une compétence..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 min-h-[48px]"
              />
            </div>

            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full sm:w-[200px] min-h-[48px]">
                <SelectValue placeholder="Catégorie" />
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
          </div>
        </CardContent>
      </Card>

      {/* Competencies grid */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-36 w-full" />
          ))}
        </div>
      ) : competencies.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Target className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Aucune compétence</h3>
            <p className="text-muted-foreground mb-6">
              {searchQuery || categoryFilter !== 'all'
                ? 'Aucune compétence ne correspond à votre recherche'
                : 'Commencez par créer votre première compétence'}
            </p>
            <Button onClick={() => setShowCreateDialog(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Créer une compétence
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {competencies.map((competency) => (
            <CompetencyCard key={competency.id} competency={competency} />
          ))}
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Nouvelle compétence</DialogTitle>
            <DialogDescription>
              Ajoutez une compétence au catalogue
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="code">
                  Code <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="code"
                  placeholder="COMP-001"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  className="min-h-[48px]"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="category">Catégorie</Label>
                <Select
                  value={formData.category}
                  onValueChange={(v) => setFormData({ ...formData, category: v })}
                >
                  <SelectTrigger className="min-h-[48px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="technique">Technique</SelectItem>
                    <SelectItem value="comportementale">Comportementale</SelectItem>
                    <SelectItem value="metier">Métier</SelectItem>
                    <SelectItem value="leadership">Leadership</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">
                Nom <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                placeholder="Communication"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="min-h-[48px]"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Décrivez cette compétence..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="min-h-[80px]"
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isCore"
                checked={formData.isCore}
                onChange={(e) => setFormData({ ...formData, isCore: e.target.checked })}
                className="h-4 w-4"
              />
              <Label htmlFor="isCore" className="text-sm font-normal">
                Compétence clé (requise pour tous les postes)
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowCreateDialog(false);
                resetForm();
              }}
              className="min-h-[48px]"
            >
              Annuler
            </Button>
            <Button
              onClick={handleCreate}
              disabled={!formData.code || !formData.name || createCompetency.isPending}
              className="min-h-[48px]"
            >
              {createCompetency.isPending ? 'Création...' : 'Créer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
