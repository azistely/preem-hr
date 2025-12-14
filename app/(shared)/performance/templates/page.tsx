'use client';

import { useState } from 'react';
import Link from 'next/link';
import { api } from '@/trpc/react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Plus,
  Search,
  FileText,
  Copy,
  Eye,
  Pencil,
  MoreHorizontal,
  Building2,
  Users,
  Briefcase,
  Star,
  CheckCircle2,
  Lock,
  Trash2,
} from 'lucide-react';
import type { FormDefinition } from '@/lib/db/schema/hr-forms';

// Type for template from API
interface Template {
  id: string;
  name: string;
  description: string | null;
  category: string;
  isSystem: boolean;
  isActive: boolean;
  definition: FormDefinition;
  targetDepartments: string[] | null;
  targetPositions: string[] | null;
  updatedAt: Date;
}

// Category labels in French
const CATEGORY_LABELS: Record<string, string> = {
  self_evaluation: 'Auto-évaluation',
  manager_evaluation: 'Évaluation manager',
  '360_feedback': 'Feedback 360°',
  peer_review: 'Évaluation par les pairs',
  probation_review: "Évaluation période d'essai",
  quick_checkin: 'Point rapide',
};

export default function TemplatesPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'system' | 'custom'>('all');
  const [previewTemplate, setPreviewTemplate] = useState<Template | null>(null);

  // Fetch templates
  const { data: templatesData, isLoading, refetch } = api.hrForms.templates.list.useQuery({
    module: 'performance',
    search: searchQuery || undefined,
    limit: 100,
  });

  // Clone mutation
  const cloneMutation = api.hrForms.templates.clone.useMutation({
    onSuccess: () => {
      refetch();
    },
  });

  // Delete mutation
  const deleteMutation = api.hrForms.templates.delete.useMutation({
    onSuccess: () => {
      refetch();
    },
  });

  // Filter templates based on tab
  const templates = (templatesData?.data ?? []) as Template[];
  const filteredTemplates = templates.filter((t: Template) => {
    if (activeTab === 'system') return t.isSystem;
    if (activeTab === 'custom') return !t.isSystem;
    return true;
  });

  // Group templates
  const systemTemplates = templates.filter((t: Template) => t.isSystem);
  const customTemplates = templates.filter((t: Template) => !t.isSystem);

  const handleDuplicate = (template: Template) => {
    cloneMutation.mutate({
      id: template.id,
      newName: `${template.name} (copie)`,
    });
  };

  const handleDelete = (template: Template) => {
    if (confirm(`Supprimer le modèle "${template.name}" ?`)) {
      deleteMutation.mutate({ id: template.id });
    }
  };

  // Count fields in template
  const getFieldCount = (def: FormDefinition) => {
    return def.fields?.filter((f) => f.type !== 'heading' && f.type !== 'paragraph').length ?? 0;
  };

  // Get targeting info
  const getTargetingBadges = (template: Template) => {
    const badges: { icon: React.ElementType; label: string }[] = [];
    if (template.targetDepartments?.length) {
      badges.push({
        icon: Building2,
        label: `${template.targetDepartments.length} département(s)`,
      });
    }
    if (template.targetPositions?.length) {
      badges.push({
        icon: Briefcase,
        label: `${template.targetPositions.length} poste(s)`,
      });
    }
    return badges;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Modèles d'évaluation</h1>
          <p className="text-muted-foreground">
            Gérez les formulaires utilisés pour les évaluations de performance
          </p>
        </div>
        <Link href="/performance/templates/new">
          <Button className="min-h-[44px]">
            <Plus className="mr-2 h-4 w-4" />
            Nouveau modèle
          </Button>
        </Link>
      </div>

      {/* Search and Tabs */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher un modèle..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 min-h-[44px]"
          />
        </div>
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
          <TabsList>
            <TabsTrigger value="all">Tous ({templates.length})</TabsTrigger>
            <TabsTrigger value="system">Système ({systemTemplates.length})</TabsTrigger>
            <TabsTrigger value="custom">Personnalisés ({customTemplates.length})</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Templates Grid */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-4 w-48 mt-2" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-4 w-24" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredTemplates.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="font-semibold mb-2">Aucun modèle trouvé</h3>
            <p className="text-muted-foreground text-center mb-4">
              {searchQuery
                ? `Aucun résultat pour "${searchQuery}"`
                : 'Créez votre premier modèle personnalisé'}
            </p>
            <Link href="/performance/templates/new">
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Créer un modèle
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredTemplates.map((template: Template) => (
            <TemplateCard
              key={template.id}
              template={template}
              onPreview={() => setPreviewTemplate(template)}
              onDuplicate={() => handleDuplicate(template)}
              onDelete={() => handleDelete(template)}
              getFieldCount={getFieldCount}
              getTargetingBadges={getTargetingBadges}
            />
          ))}
        </div>
      )}

      {/* Preview Dialog */}
      <Dialog open={!!previewTemplate} onOpenChange={() => setPreviewTemplate(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Aperçu: {previewTemplate?.name}
            </DialogTitle>
            <DialogDescription>
              {previewTemplate?.description ?? 'Aucune description'}
            </DialogDescription>
          </DialogHeader>
          {previewTemplate && (
            <TemplatePreview template={previewTemplate} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Template Card Component
function TemplateCard({
  template,
  onPreview,
  onDuplicate,
  onDelete,
  getFieldCount,
  getTargetingBadges,
}: {
  template: Template;
  onPreview: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  getFieldCount: (def: FormDefinition) => number;
  getTargetingBadges: (t: Template) => { icon: React.ElementType; label: string }[];
}) {
  const fieldCount = getFieldCount(template.definition);
  const targetingBadges = getTargetingBadges(template);

  return (
    <Card className="relative group hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="text-base flex items-center gap-2">
              {template.isSystem && <Lock className="h-4 w-4 text-muted-foreground" />}
              {template.name}
            </CardTitle>
            <Badge variant="outline" className="text-xs">
              {CATEGORY_LABELS[template.category] ?? template.category}
            </Badge>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onPreview}>
                <Eye className="mr-2 h-4 w-4" />
                Aperçu
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onDuplicate}>
                <Copy className="mr-2 h-4 w-4" />
                Dupliquer
              </DropdownMenuItem>
              {!template.isSystem && (
                <>
                  <DropdownMenuItem asChild>
                    <Link href={`/performance/templates/${template.id}/edit`}>
                      <Pencil className="mr-2 h-4 w-4" />
                      Modifier
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={onDelete}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Supprimer
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
          {template.description ?? 'Aucune description'}
        </p>
        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <FileText className="h-3 w-3" />
            {fieldCount} question{fieldCount > 1 ? 's' : ''}
          </span>
          {targetingBadges.map(({ icon: Icon, label }, i) => (
            <span key={i} className="flex items-center gap-1">
              <Icon className="h-3 w-3" />
              {label}
            </span>
          ))}
          {template.isSystem && (
            <Badge variant="secondary" className="text-xs">
              Modèle système
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// Template Preview Component
function TemplatePreview({ template }: { template: Template }) {
  const { definition } = template;
  const sections = definition.sections ?? [];
  const fields = definition.fields ?? [];

  // Group fields by section
  const fieldsBySection: Record<string, typeof fields> = {};
  const noSectionFields: typeof fields = [];

  fields.forEach((field) => {
    if (field.section) {
      if (!fieldsBySection[field.section]) {
        fieldsBySection[field.section] = [];
      }
      fieldsBySection[field.section].push(field);
    } else {
      noSectionFields.push(field);
    }
  });

  return (
    <div className="space-y-6 py-4">
      {/* Unsectioned fields */}
      {noSectionFields.length > 0 && (
        <div className="space-y-4">
          {noSectionFields.map((field) => (
            <PreviewField key={field.id} field={field} />
          ))}
        </div>
      )}

      {/* Sectioned fields */}
      {sections.map((section) => (
        <div key={section.id} className="space-y-4">
          <div className="border-b pb-2">
            <h4 className="font-semibold flex items-center gap-2">
              {section.title}
              {section.description && (
                <span className="text-sm font-normal text-muted-foreground">
                  - {section.description}
                </span>
              )}
            </h4>
          </div>
          <div className="space-y-4 pl-4">
            {fieldsBySection[section.id]?.map((field) => (
              <PreviewField key={field.id} field={field} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// Preview individual field
function PreviewField({ field }: { field: FormDefinition['fields'][0] }) {
  const getFieldTypeLabel = () => {
    switch (field.type) {
      case 'rating':
        return (
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((i) => (
              <Star key={i} className="h-4 w-4 text-muted-foreground" />
            ))}
          </div>
        );
      case 'text':
        return <div className="h-8 w-full bg-muted rounded border" />;
      case 'textarea':
        return <div className="h-20 w-full bg-muted rounded border" />;
      case 'select':
      case 'radio':
        return (
          <div className="space-y-1">
            {field.options?.slice(0, 3).map((opt, i) => (
              <div key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="h-3 w-3 rounded-full border" />
                {opt.label}
              </div>
            ))}
            {(field.options?.length ?? 0) > 3 && (
              <span className="text-xs text-muted-foreground">
                +{(field.options?.length ?? 0) - 3} autres options
              </span>
            )}
          </div>
        );
      case 'slider':
        return (
          <div className="h-2 w-full bg-muted rounded-full">
            <div className="h-full w-1/2 bg-primary rounded-full" />
          </div>
        );
      case 'heading':
        return null;
      case 'paragraph':
        return <p className="text-sm text-muted-foreground italic">{field.placeholder}</p>;
      default:
        return <div className="h-8 w-full bg-muted rounded border" />;
    }
  };

  if (field.type === 'heading') {
    return (
      <h5 className="font-medium text-lg border-b pb-1">{field.label}</h5>
    );
  }

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium flex items-center gap-1">
        {field.label}
        {field.required && <span className="text-destructive">*</span>}
      </label>
      {field.helpText && (
        <p className="text-xs text-muted-foreground">{field.helpText}</p>
      )}
      {getFieldTypeLabel()}
    </div>
  );
}
