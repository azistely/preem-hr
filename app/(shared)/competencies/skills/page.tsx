/**
 * Skills Inventory Page
 *
 * Personal skills inventory for employees.
 * - View declared skills with proficiency levels
 * - Add new skills
 * - Request validation
 */

'use client';

import { useState } from 'react';
import { api } from '@/trpc/react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
import { Progress } from '@/components/ui/progress';
import {
  Plus,
  Zap,
  Search,
  CheckCircle2,
  Clock,
  Star,
  Code,
  Briefcase,
  Users,
  BookOpen,
  Edit,
} from 'lucide-react';
import { toast } from 'sonner';

// Proficiency level labels
const proficiencyLabels: Record<number, string> = {
  1: 'Débutant',
  2: 'Junior',
  3: 'Intermédiaire',
  4: 'Confirmé',
  5: 'Expert',
};

// Source labels
const sourceLabels: Record<string, string> = {
  self_declared: 'Auto-déclaré',
  assessment: 'Évaluation',
  training: 'Formation',
  certification: 'Certification',
};

// Category icons
const categoryIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  technique: Code,
  soft_skills: Users,
  metier: Briefcase,
  langue: BookOpen,
  default: Zap,
};

// Skill card component
function SkillCard({
  skill,
  onEdit,
}: {
  skill: {
    id: string;
    skillName: string;
    skillCategory: string | null;
    proficiencyLevel: number;
    source: string;
    evidenceNotes: string | null;
    isValidated: boolean | null;
  };
  onEdit: () => void;
}) {
  const CategoryIcon = categoryIcons[skill.skillCategory?.toLowerCase() || ''] || categoryIcons.default;

  return (
    <Card className="hover:bg-muted/50 transition-colors">
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-primary/10 rounded-lg flex-shrink-0">
            <CategoryIcon className="h-5 w-5 text-primary" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="min-w-0">
                <h3 className="font-medium truncate">{skill.skillName}</h3>
                {skill.skillCategory && (
                  <p className="text-xs text-muted-foreground">{skill.skillCategory}</p>
                )}
              </div>
              <div className="flex gap-1 flex-shrink-0">
                {skill.isValidated ? (
                  <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 text-xs">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Validé
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="text-xs">
                    <Clock className="h-3 w-3 mr-1" />
                    En attente
                  </Badge>
                )}
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onEdit}>
                  <Edit className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Proficiency level */}
            <div className="mb-2">
              <div className="flex justify-between text-xs text-muted-foreground mb-1">
                <span>Niveau de maîtrise</span>
                <span>{proficiencyLabels[skill.proficiencyLevel]}</span>
              </div>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((level) => (
                  <div
                    key={level}
                    className={`h-2 flex-1 rounded-full ${
                      level <= skill.proficiencyLevel
                        ? 'bg-primary'
                        : 'bg-muted'
                    }`}
                  />
                ))}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="text-xs">
                {sourceLabels[skill.source] || skill.source}
              </Badge>
            </div>

            {skill.evidenceNotes && (
              <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                {skill.evidenceNotes}
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function SkillsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingSkill, setEditingSkill] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    skillName: '',
    skillCategory: 'technique',
    proficiencyLevel: 3,
    source: 'self_declared' as 'self_declared' | 'assessment' | 'training' | 'certification',
    evidenceNotes: '',
  });

  const utils = api.useUtils();

  // Fetch skills (for current employee - no employeeId means current user)
  const { data: skillsData, isLoading } = api.training.skills.list.useQuery({
    skillCategory: categoryFilter !== 'all' ? categoryFilter : undefined,
    limit: 100,
  });

  // Create mutation
  const createSkill = api.training.skills.create.useMutation({
    onSuccess: () => {
      toast.success('Compétence ajoutée avec succès');
      setShowCreateDialog(false);
      resetForm();
      utils.training.skills.list.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || 'Erreur lors de l\'ajout');
    },
  });

  // Update mutation
  const updateSkill = api.training.skills.update.useMutation({
    onSuccess: () => {
      toast.success('Compétence mise à jour');
      setEditingSkill(null);
      resetForm();
      utils.training.skills.list.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || 'Erreur lors de la mise à jour');
    },
  });

  const skills = skillsData?.data ?? [];

  // Filter by search
  const filteredSkills = skills.filter((skill) => {
    if (!searchQuery) return true;
    return skill.skillName.toLowerCase().includes(searchQuery.toLowerCase());
  });

  // Stats
  const totalSkills = skills.length;
  const validatedCount = skills.filter((s) => s.isValidated).length;
  const expertCount = skills.filter((s) => s.proficiencyLevel >= 4).length;

  // Category counts
  const categories = [...new Set(skills.map((s) => s.skillCategory).filter(Boolean))];

  const resetForm = () => {
    setFormData({
      skillName: '',
      skillCategory: 'technique',
      proficiencyLevel: 3,
      source: 'self_declared',
      evidenceNotes: '',
    });
  };

  const handleCreate = () => {
    if (!formData.skillName.trim()) {
      toast.error('Veuillez saisir le nom de la compétence');
      return;
    }

    createSkill.mutate({
      skillName: formData.skillName,
      skillCategory: formData.skillCategory || undefined,
      proficiencyLevel: formData.proficiencyLevel,
      source: formData.source,
      evidenceNotes: formData.evidenceNotes || undefined,
    });
  };

  const handleEdit = (skill: typeof skills[0]) => {
    setFormData({
      skillName: skill.skillName,
      skillCategory: skill.skillCategory || 'technique',
      proficiencyLevel: skill.proficiencyLevel,
      source: skill.source as typeof formData.source,
      evidenceNotes: skill.evidenceNotes || '',
    });
    setEditingSkill(skill.id);
  };

  const handleUpdate = () => {
    if (!editingSkill) return;

    updateSkill.mutate({
      id: editingSkill,
      proficiencyLevel: formData.proficiencyLevel,
      evidenceNotes: formData.evidenceNotes || undefined,
    });
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Mes compétences</h1>
          <p className="text-muted-foreground mt-1">
            Inventaire de vos compétences et savoir-faire
          </p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)} className="min-h-[48px]">
          <Plus className="mr-2 h-4 w-4" />
          Ajouter une compétence
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-primary/10 rounded-lg">
                <Zap className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total compétences</p>
                <p className="text-2xl font-bold">{totalSkills}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-100 dark:bg-green-900 rounded-lg">
                <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400" />
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
              <div className="p-3 bg-yellow-100 dark:bg-yellow-900 rounded-lg">
                <Star className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Niveau expert</p>
                <p className="text-2xl font-bold">{expertCount}</p>
              </div>
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
                <SelectItem value="technique">Technique</SelectItem>
                <SelectItem value="soft_skills">Soft Skills</SelectItem>
                <SelectItem value="metier">Métier</SelectItem>
                <SelectItem value="langue">Langue</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Skills grid */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-44 w-full" />
          ))}
        </div>
      ) : filteredSkills.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Zap className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Aucune compétence</h3>
            <p className="text-muted-foreground mb-6">
              {searchQuery
                ? 'Aucune compétence ne correspond à votre recherche'
                : 'Commencez par déclarer vos compétences'}
            </p>
            <Button onClick={() => setShowCreateDialog(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Ajouter une compétence
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredSkills.map((skill) => (
            <SkillCard key={skill.id} skill={skill} onEdit={() => handleEdit(skill)} />
          ))}
        </div>
      )}

      {/* Create/Edit dialog */}
      <Dialog
        open={showCreateDialog || !!editingSkill}
        onOpenChange={(open) => {
          if (!open) {
            setShowCreateDialog(false);
            setEditingSkill(null);
            resetForm();
          }
        }}
      >
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              {editingSkill ? 'Modifier la compétence' : 'Ajouter une compétence'}
            </DialogTitle>
            <DialogDescription>
              {editingSkill
                ? 'Mettez à jour votre niveau de maîtrise'
                : 'Déclarez une nouvelle compétence à votre profil'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="skillName">
                Nom de la compétence <span className="text-destructive">*</span>
              </Label>
              <Input
                id="skillName"
                placeholder="Ex: Python, Excel, Gestion de projet"
                value={formData.skillName}
                onChange={(e) => setFormData({ ...formData, skillName: e.target.value })}
                disabled={!!editingSkill}
                className="min-h-[48px]"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Catégorie</Label>
                <Select
                  value={formData.skillCategory}
                  onValueChange={(v) => setFormData({ ...formData, skillCategory: v })}
                  disabled={!!editingSkill}
                >
                  <SelectTrigger className="min-h-[48px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="technique">Technique</SelectItem>
                    <SelectItem value="soft_skills">Soft Skills</SelectItem>
                    <SelectItem value="metier">Métier</SelectItem>
                    <SelectItem value="langue">Langue</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Source</Label>
                <Select
                  value={formData.source}
                  onValueChange={(v) => setFormData({ ...formData, source: v as typeof formData.source })}
                  disabled={!!editingSkill}
                >
                  <SelectTrigger className="min-h-[48px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="self_declared">Auto-déclaré</SelectItem>
                    <SelectItem value="assessment">Évaluation</SelectItem>
                    <SelectItem value="training">Formation</SelectItem>
                    <SelectItem value="certification">Certification</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Niveau de maîtrise</Label>
              <div className="space-y-3">
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Débutant</span>
                  <span className="font-medium text-foreground">
                    {proficiencyLabels[formData.proficiencyLevel]}
                  </span>
                  <span>Expert</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={5}
                  value={formData.proficiencyLevel}
                  onChange={(e) => setFormData({ ...formData, proficiencyLevel: parseInt(e.target.value) })}
                  className="w-full h-2 bg-muted rounded-full appearance-none cursor-pointer"
                />
                <div className="flex justify-between">
                  {[1, 2, 3, 4, 5].map((level) => (
                    <button
                      key={level}
                      type="button"
                      onClick={() => setFormData({ ...formData, proficiencyLevel: level })}
                      className={`w-8 h-8 rounded-full text-sm font-medium transition-colors ${
                        level <= formData.proficiencyLevel
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-muted-foreground hover:bg-muted/80'
                      }`}
                    >
                      {level}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="evidenceNotes">Notes / Preuves</Label>
              <Textarea
                id="evidenceNotes"
                placeholder="Décrivez votre expérience avec cette compétence..."
                value={formData.evidenceNotes}
                onChange={(e) => setFormData({ ...formData, evidenceNotes: e.target.value })}
                className="min-h-[80px]"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowCreateDialog(false);
                setEditingSkill(null);
                resetForm();
              }}
              className="min-h-[48px]"
            >
              Annuler
            </Button>
            <Button
              onClick={editingSkill ? handleUpdate : handleCreate}
              disabled={
                (!editingSkill && !formData.skillName.trim()) ||
                createSkill.isPending ||
                updateSkill.isPending
              }
              className="min-h-[48px]"
            >
              {(createSkill.isPending || updateSkill.isPending)
                ? 'Enregistrement...'
                : editingSkill
                ? 'Mettre à jour'
                : 'Ajouter'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
