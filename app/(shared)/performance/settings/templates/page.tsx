/**
 * Evaluation Templates Settings Page
 *
 * HR managers can configure evaluation form templates.
 * - View and manage evaluation templates
 * - Clone and customize templates
 * - Set default templates for cycles
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
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  FileText,
  Copy,
  Eye,
  Search,
  Settings,
  Star,
  Check,
  Clock,
  X,
  Smartphone,
  Tablet,
  Monitor,
} from 'lucide-react';
import { toast } from 'sonner';
import { FormPreview } from '@/components/hr-modules/forms/form-builder/preview-mode';
import type { FormDefinition } from '@/lib/db/schema/hr-forms';

// Category config
const categoryConfig: Record<string, { label: string; color: string }> = {
  self_evaluation: { label: 'Auto-évaluation', color: 'bg-blue-100 text-blue-700' },
  manager_evaluation: { label: 'Éval. manager', color: 'bg-green-100 text-green-700' },
  peer_feedback: { label: 'Feedback pair', color: 'bg-purple-100 text-purple-700' },
  '360_feedback': { label: '360°', color: 'bg-orange-100 text-orange-700' },
  training_feedback: { label: 'Éval. formation', color: 'bg-yellow-100 text-yellow-700' },
};

// Template card component
function TemplateCard({
  template,
  onClone,
  onPreview,
}: {
  template: {
    id: string;
    name: string;
    description: string | null;
    category: string | null;
    isSystem: boolean | null;
    isActive: boolean | null;
    version: number | null;
    createdAt: Date | null;
  };
  onClone: () => void;
  onPreview: () => void;
}) {
  const category = categoryConfig[template.category ?? ''] || { label: template.category, color: 'bg-muted' };

  return (
    <Card className="hover:border-primary/50 transition-colors">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <FileText className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                {template.name}
                {template.isSystem && (
                  <Badge variant="outline" className="text-xs">
                    <Star className="h-3 w-3 mr-1" />
                    Système
                  </Badge>
                )}
              </CardTitle>
              <CardDescription className="mt-1">
                Version {template.version ?? 1}
              </CardDescription>
            </div>
          </div>
          <Badge className={category.color}>{category.label}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {template.description && (
          <p className="text-sm text-muted-foreground line-clamp-2">
            {template.description}
          </p>
        )}

        <div className="flex items-center justify-between pt-2 border-t">
          <div className="flex items-center gap-2">
            {template.isActive ? (
              <Badge variant="secondary" className="text-xs">
                <Check className="h-3 w-3 mr-1" />
                Actif
              </Badge>
            ) : (
              <Badge variant="outline" className="text-xs">
                <Clock className="h-3 w-3 mr-1" />
                Inactif
              </Badge>
            )}
          </div>

          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={onPreview}>
              <Eye className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={onClone}>
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function TemplatesSettingsPage() {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);
  const [previewTemplateId, setPreviewTemplateId] = useState<string | null>(null);
  const [cloneSource, setCloneSource] = useState<{
    id: string;
    name: string;
  } | null>(null);

  // Form state
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formCategory, setFormCategory] = useState<string>('self_evaluation');

  const utils = api.useUtils();

  // Fetch templates
  const { data: templates, isLoading } = api.hrForms.templates.list.useQuery({
    module: 'performance',
    category: categoryFilter !== 'all' ? categoryFilter : undefined,
    search: search || undefined,
  });

  // Fetch template details for preview
  const { data: previewTemplate, isLoading: isLoadingPreview } = api.hrForms.templates.getById.useQuery(
    { id: previewTemplateId! },
    { enabled: !!previewTemplateId && showPreviewDialog }
  );

  // Clone template mutation
  const cloneTemplate = api.hrForms.templates.clone.useMutation({
    onSuccess: () => {
      toast.success('Modèle cloné avec succès');
      setShowCreateDialog(false);
      setCloneSource(null);
      resetForm();
      utils.hrForms.templates.list.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || 'Erreur lors du clonage');
    },
  });

  const resetForm = () => {
    setFormName('');
    setFormDescription('');
    setFormCategory('self_evaluation');
  };

  const handleClone = (template: { id: string; name: string }) => {
    setCloneSource(template);
    setFormName(`${template.name} (copie)`);
    setShowCreateDialog(true);
  };

  const handleCreateFromClone = () => {
    if (!cloneSource) return;

    if (!formName.trim()) {
      toast.error('Veuillez saisir un nom');
      return;
    }

    cloneTemplate.mutate({
      id: cloneSource.id,
      newName: formName,
    });
  };

  const handlePreview = (template: { id: string }) => {
    setPreviewTemplateId(template.id);
    setShowPreviewDialog(true);
  };

  const handleClosePreview = () => {
    setShowPreviewDialog(false);
    setPreviewTemplateId(null);
  };

  // Extract data
  const templatesList = templates?.data ?? [];

  // Stats
  const totalTemplates = templatesList.length;
  const systemTemplates = templatesList.filter((t) => t.isSystem).length;
  const activeTemplates = templatesList.filter((t) => t.isActive).length;

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Settings className="h-8 w-8 text-primary" />
            Modèles d&apos;évaluation
          </h1>
          <p className="text-muted-foreground mt-1">
            Gérez les formulaires d&apos;évaluation de performance
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalTemplates}</p>
                <p className="text-sm text-muted-foreground">Modèles total</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <Star className="h-5 w-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{systemTemplates}</p>
                <p className="text-sm text-muted-foreground">Modèles système</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <Check className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{activeTemplates}</p>
                <p className="text-sm text-muted-foreground">Actifs</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher un modèle..."
                className="min-h-[48px] pl-10"
              />
            </div>

            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="min-h-[48px] w-full sm:w-[200px]">
                <SelectValue placeholder="Catégorie" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes les catégories</SelectItem>
                {Object.entries(categoryConfig).map(([key, config]) => (
                  <SelectItem key={key} value={key}>
                    {config.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Templates grid */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-48 w-full" />
          ))}
        </div>
      ) : templatesList.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Aucun modèle trouvé</h3>
            <p className="text-muted-foreground">
              Les modèles système seront créés automatiquement
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {templatesList.map((template) => (
            <TemplateCard
              key={template.id}
              template={template}
              onClone={() => handleClone({ id: template.id, name: template.name })}
              onPreview={() => handlePreview({ id: template.id })}
            />
          ))}
        </div>
      )}

      {/* Clone dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Cloner le modèle</DialogTitle>
            <DialogDescription>
              Créez une copie personnalisable de &quot;{cloneSource?.name}&quot;
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nom du nouveau modèle *</Label>
              <Input
                id="name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Ex: Auto-évaluation personnalisée"
                className="min-h-[48px]"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Décrivez l'objectif de ce modèle..."
                className="min-h-[80px]"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowCreateDialog(false);
                setCloneSource(null);
                resetForm();
              }}
            >
              Annuler
            </Button>
            <Button
              onClick={handleCreateFromClone}
              disabled={cloneTemplate.isPending}
              className="min-h-[44px]"
            >
              <Copy className="mr-2 h-4 w-4" />
              {cloneTemplate.isPending ? 'Clonage...' : 'Cloner'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview dialog */}
      <Dialog open={showPreviewDialog} onOpenChange={setShowPreviewDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] p-0 overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-4 border-b">
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="flex items-center gap-2">
                  <Eye className="h-5 w-5 text-primary" />
                  Aperçu du formulaire
                </DialogTitle>
                <DialogDescription>
                  {previewTemplate?.name ?? 'Chargement...'}
                </DialogDescription>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleClosePreview}
                className="h-8 w-8"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-hidden">
            {isLoadingPreview ? (
              <div className="flex items-center justify-center h-96">
                <div className="text-center space-y-3">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
                  <p className="text-muted-foreground">Chargement du formulaire...</p>
                </div>
              </div>
            ) : previewTemplate?.definition ? (
              <FormPreview
                title={previewTemplate.name}
                description={previewTemplate.description ?? undefined}
                fields={(previewTemplate.definition as FormDefinition).fields}
                showSampleData
                className="border-0 shadow-none h-full"
              />
            ) : (
              <div className="flex items-center justify-center h-96">
                <div className="text-center space-y-3">
                  <FileText className="h-12 w-12 text-muted-foreground mx-auto" />
                  <p className="text-muted-foreground">Aucun champ défini dans ce modèle</p>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
