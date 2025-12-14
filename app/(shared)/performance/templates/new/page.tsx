'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/trpc/react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
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
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  ArrowLeft,
  Plus,
  Trash2,
  GripVertical,
  ChevronDown,
  ChevronRight,
  Save,
  Eye,
  Star,
  Type,
  AlignLeft,
  Hash,
  Calendar,
  ListOrdered,
  CheckSquare,
  SlidersHorizontal,
  Heading,
  FileText,
  Briefcase,
  Users,
  MoreHorizontal,
  Copy,
  Settings2,
} from 'lucide-react';
import type { FormFieldDefinition, FormDefinition, FormSectionDefinition, FormFieldType } from '@/lib/db/schema/hr-forms';
import { nanoid } from 'nanoid';

// Field type configuration
const FIELD_TYPES = [
  { type: 'rating', label: 'Note (étoiles)', icon: Star, description: 'Notation de 1 à 5 étoiles' },
  { type: 'text', label: 'Texte court', icon: Type, description: 'Réponse en une ligne' },
  { type: 'textarea', label: 'Texte long', icon: AlignLeft, description: 'Réponse multiligne' },
  { type: 'number', label: 'Nombre', icon: Hash, description: 'Valeur numérique' },
  { type: 'select', label: 'Liste déroulante', icon: ListOrdered, description: 'Choix unique' },
  { type: 'radio', label: 'Choix unique', icon: CheckSquare, description: 'Options avec boutons' },
  { type: 'slider', label: 'Curseur', icon: SlidersHorizontal, description: 'Valeur sur une échelle' },
  { type: 'heading', label: 'Titre de section', icon: Heading, description: 'Diviser le formulaire' },
  { type: 'paragraph', label: 'Texte explicatif', icon: FileText, description: 'Instructions ou contexte' },
] as const;

// Category labels
const CATEGORY_OPTIONS = [
  { value: 'self_evaluation', label: 'Auto-évaluation' },
  { value: 'manager_evaluation', label: 'Évaluation manager' },
  { value: '360_feedback', label: 'Feedback 360°' },
  { value: 'peer_review', label: 'Évaluation par les pairs' },
  { value: 'probation_review', label: "Évaluation période d'essai" },
  { value: 'quick_checkin', label: 'Point rapide' },
];

// Default field for each type
const getDefaultField = (type: string): FormFieldDefinition => {
  const base = {
    id: nanoid(8),
    type: type as FormFieldDefinition['type'],
    label: '',
    required: false,
    order: 0,
    width: 'full' as const,
  };

  switch (type) {
    case 'rating':
      return {
        ...base,
        label: 'Nouvelle question (note)',
        ratingConfig: { type: 'stars', scale: 5 },
      };
    case 'select':
    case 'radio':
      return {
        ...base,
        label: 'Nouvelle question (choix)',
        options: [
          { value: 'option1', label: 'Option 1' },
          { value: 'option2', label: 'Option 2' },
        ],
      };
    case 'slider':
      return {
        ...base,
        label: 'Nouvelle question (curseur)',
        sliderConfig: { min: 0, max: 100, step: 10 },
      };
    case 'heading':
      return {
        ...base,
        label: 'Nouvelle section',
      };
    case 'paragraph':
      return {
        ...base,
        label: 'Texte explicatif',
        placeholder: 'Entrez vos instructions ici...',
      };
    default:
      return {
        ...base,
        label: 'Nouvelle question',
      };
  }
};

export default function NewTemplatePage() {
  const router = useRouter();

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('self_evaluation');
  const [sections, setSections] = useState<FormSectionDefinition[]>([
    { id: nanoid(8), title: 'Performance', order: 0, collapsible: true },
  ]);
  const [fields, setFields] = useState<FormFieldDefinition[]>([]);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['section-0']));

  // Targeting
  const [targetDepartments, setTargetDepartments] = useState<string[]>([]);
  const [targetPositions, setTargetPositions] = useState<string[]>([]);

  // UI state
  const [editingField, setEditingField] = useState<FormFieldDefinition | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [showAddFieldDialog, setShowAddFieldDialog] = useState(false);
  const [addingToSection, setAddingToSection] = useState<string | null>(null);

  // Fetch departments and positions for targeting
  const { data: departments } = api.performance.departments.list.useQuery({ status: 'active' });
  const { data: positions } = api.positions.list.useQuery({});

  // Create mutation
  const createMutation = api.hrForms.templates.create.useMutation({
    onSuccess: () => {
      router.push('/performance/templates');
    },
  });

  // Add a new section
  const addSection = () => {
    const newSection: FormSectionDefinition = {
      id: nanoid(8),
      title: `Section ${sections.length + 1}`,
      order: sections.length,
      collapsible: true,
    };
    setSections([...sections, newSection]);
    setExpandedSections(new Set([...expandedSections, `section-${sections.length}`]));
  };

  // Update section
  const updateSection = (sectionId: string, updates: Partial<FormSectionDefinition>) => {
    setSections(sections.map(s => s.id === sectionId ? { ...s, ...updates } : s));
  };

  // Delete section
  const deleteSection = (sectionId: string) => {
    setSections(sections.filter(s => s.id !== sectionId));
    // Also remove fields in this section
    setFields(fields.filter(f => f.section !== sectionId));
  };

  // Add field to section
  const addFieldToSection = (type: string, sectionId: string) => {
    const sectionFields = fields.filter(f => f.section === sectionId);
    const newField = {
      ...getDefaultField(type),
      section: sectionId,
      order: sectionFields.length,
    };
    setFields([...fields, newField]);
    setShowAddFieldDialog(false);
    setAddingToSection(null);
    setEditingField(newField);
  };

  // Update field
  const updateField = (fieldId: string, updates: Partial<FormFieldDefinition>) => {
    setFields(fields.map(f => f.id === fieldId ? { ...f, ...updates } : f));
    if (editingField?.id === fieldId) {
      setEditingField({ ...editingField, ...updates });
    }
  };

  // Delete field
  const deleteField = (fieldId: string) => {
    setFields(fields.filter(f => f.id !== fieldId));
    if (editingField?.id === fieldId) {
      setEditingField(null);
    }
  };

  // Duplicate field
  const duplicateField = (field: FormFieldDefinition) => {
    const newField = {
      ...field,
      id: nanoid(8),
      label: `${field.label} (copie)`,
      order: (field.order ?? 0) + 0.5, // Will be reordered on save
    };
    setFields([...fields, newField].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)));
  };

  // Move field up/down
  const moveField = (fieldId: string, direction: 'up' | 'down') => {
    const fieldIndex = fields.findIndex(f => f.id === fieldId);
    if (fieldIndex === -1) return;

    const field = fields[fieldIndex];
    const sectionFields = fields.filter(f => f.section === field.section);
    const fieldIndexInSection = sectionFields.findIndex(f => f.id === fieldId);

    if (direction === 'up' && fieldIndexInSection > 0) {
      const prevField = sectionFields[fieldIndexInSection - 1];
      updateField(fieldId, { order: (prevField.order ?? 0) - 0.5 });
    } else if (direction === 'down' && fieldIndexInSection < sectionFields.length - 1) {
      const nextField = sectionFields[fieldIndexInSection + 1];
      updateField(fieldId, { order: (nextField.order ?? 0) + 0.5 });
    }

    // Reorder all fields in section
    const reordered = [...fields]
      .filter(f => f.section === field.section)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .map((f, i) => ({ ...f, order: i }));

    setFields([
      ...fields.filter(f => f.section !== field.section),
      ...reordered,
    ]);
  };

  // Save template
  const handleSave = () => {
    // Normalize field orders
    const normalizedFields = sections.flatMap((section, sIndex) => {
      return fields
        .filter(f => f.section === section.id)
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
        .map((f, fIndex) => ({
          ...f,
          order: sIndex * 1000 + fIndex,
        }));
    });

    const definition: FormDefinition = {
      version: '1.0',
      fields: normalizedFields,
      sections: sections.map((s, i) => ({ ...s, order: i })),
    };

    createMutation.mutate({
      name,
      description: description || undefined,
      module: 'performance',
      category,
      definition,
      targetDepartments: targetDepartments.length > 0 ? targetDepartments : undefined,
      targetPositions: targetPositions.length > 0 ? targetPositions : undefined,
    });
  };

  // Toggle section expand/collapse
  const toggleSection = (sectionKey: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(sectionKey)) {
      newExpanded.delete(sectionKey);
    } else {
      newExpanded.add(sectionKey);
    }
    setExpandedSections(newExpanded);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">Nouveau modèle d'évaluation</h1>
          <p className="text-muted-foreground">Créez un formulaire personnalisé pour vos évaluations</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowPreview(true)}>
            <Eye className="mr-2 h-4 w-4" />
            Aperçu
          </Button>
          <Button
            onClick={handleSave}
            disabled={!name || createMutation.isPending}
          >
            <Save className="mr-2 h-4 w-4" />
            {createMutation.isPending ? 'Enregistrement...' : 'Enregistrer'}
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left: Form Builder */}
        <div className="lg:col-span-2 space-y-6">
          {/* Basic Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Informations générales</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Nom du modèle *</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ex: Évaluation commerciaux 2025"
                    className="min-h-[44px]"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="category">Type d'évaluation</Label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger className="min-h-[44px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORY_OPTIONS.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Décrivez l'objectif de ce modèle..."
                  rows={2}
                />
              </div>
            </CardContent>
          </Card>

          {/* Sections & Fields */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Sections et questions</CardTitle>
              <Button variant="outline" size="sm" onClick={addSection}>
                <Plus className="mr-2 h-4 w-4" />
                Ajouter une section
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {sections.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Aucune section. Ajoutez-en une pour commencer.</p>
                </div>
              ) : (
                sections.map((section, sIndex) => {
                  const sectionKey = `section-${sIndex}`;
                  const sectionFields = fields
                    .filter(f => f.section === section.id)
                    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
                  const isExpanded = expandedSections.has(sectionKey);

                  return (
                    <Collapsible key={section.id} open={isExpanded}>
                      <div className="border rounded-lg">
                        <div className="flex items-center gap-2 p-3 bg-muted/50">
                          <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                          <CollapsibleTrigger
                            className="flex items-center gap-2 flex-1"
                            onClick={() => toggleSection(sectionKey)}
                          >
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                            <Input
                              value={section.title}
                              onChange={(e) => {
                                e.stopPropagation();
                                updateSection(section.id, { title: e.target.value });
                              }}
                              onClick={(e) => e.stopPropagation()}
                              className="h-8 font-medium bg-transparent border-0 focus-visible:ring-1"
                            />
                          </CollapsibleTrigger>
                          <Badge variant="secondary">{sectionFields.length} question(s)</Badge>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => {
                                setAddingToSection(section.id);
                                setShowAddFieldDialog(true);
                              }}>
                                <Plus className="mr-2 h-4 w-4" />
                                Ajouter une question
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => deleteSection(section.id)}
                                className="text-destructive"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Supprimer la section
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>

                        <CollapsibleContent>
                          <div className="p-3 space-y-2">
                            {sectionFields.length === 0 ? (
                              <div className="text-center py-4 text-sm text-muted-foreground border-2 border-dashed rounded-lg">
                                Aucune question dans cette section
                                <br />
                                <Button
                                  variant="link"
                                  size="sm"
                                  onClick={() => {
                                    setAddingToSection(section.id);
                                    setShowAddFieldDialog(true);
                                  }}
                                >
                                  + Ajouter une question
                                </Button>
                              </div>
                            ) : (
                              sectionFields.map((field) => (
                                <FieldItem
                                  key={field.id}
                                  field={field}
                                  isEditing={editingField?.id === field.id}
                                  onEdit={() => setEditingField(field)}
                                  onClose={() => setEditingField(null)}
                                  onDelete={() => deleteField(field.id)}
                                  onDuplicate={() => duplicateField(field)}
                                  onMoveUp={() => moveField(field.id, 'up')}
                                  onMoveDown={() => moveField(field.id, 'down')}
                                  onUpdate={(updates) => updateField(field.id, updates)}
                                />
                              ))
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              className="w-full border-2 border-dashed"
                              onClick={() => {
                                setAddingToSection(section.id);
                                setShowAddFieldDialog(true);
                              }}
                            >
                              <Plus className="mr-2 h-4 w-4" />
                              Ajouter une question
                            </Button>
                          </div>
                        </CollapsibleContent>
                      </div>
                    </Collapsible>
                  );
                })
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right: Targeting only (Field Editor is now inline) */}
        <div className="space-y-6">
          {/* Targeting */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="h-5 w-5" />
                Ciblage (optionnel)
              </CardTitle>
              <CardDescription>
                Limitez ce modèle à certains départements ou postes
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Department targeting */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Départements
                </Label>
                <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                  {departments?.map((dept: { id: string; name: string }) => (
                    <label key={dept.id} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={targetDepartments.includes(dept.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setTargetDepartments([...targetDepartments, dept.id]);
                          } else {
                            setTargetDepartments(targetDepartments.filter(d => d !== dept.id));
                          }
                        }}
                      />
                      {dept.name}
                    </label>
                  ))}
                  {!departments?.length && (
                    <span className="text-sm text-muted-foreground">Aucun département</span>
                  )}
                </div>
              </div>

              {/* Position targeting */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Briefcase className="h-4 w-4" />
                  Postes
                </Label>
                <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                  {positions?.slice(0, 20).map((pos: { id: string; title: string }) => (
                    <label key={pos.id} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={targetPositions.includes(pos.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setTargetPositions([...targetPositions, pos.id]);
                          } else {
                            setTargetPositions(targetPositions.filter(p => p !== pos.id));
                          }
                        }}
                      />
                      {pos.title}
                    </label>
                  ))}
                  {!positions?.length && (
                    <span className="text-sm text-muted-foreground">Aucun poste</span>
                  )}
                </div>
              </div>

              {(targetDepartments.length > 0 || targetPositions.length > 0) && (
                <div className="pt-2 border-t">
                  <p className="text-sm text-muted-foreground">
                    Ce modèle sera utilisé uniquement pour les employés correspondant aux critères ci-dessus.
                  </p>
                  <Button
                    variant="link"
                    size="sm"
                    className="p-0 h-auto"
                    onClick={() => {
                      setTargetDepartments([]);
                      setTargetPositions([]);
                    }}
                  >
                    Effacer le ciblage
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Add Field Dialog */}
      <Dialog open={showAddFieldDialog} onOpenChange={setShowAddFieldDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajouter une question</DialogTitle>
            <DialogDescription>
              Choisissez le type de question à ajouter
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-2">
            {FIELD_TYPES.map(({ type, label, icon: Icon, description }) => (
              <Button
                key={type}
                variant="outline"
                className="h-auto flex-col items-start p-4 text-left"
                onClick={() => addingToSection && addFieldToSection(type, addingToSection)}
              >
                <div className="flex items-center gap-2 w-full">
                  <Icon className="h-4 w-4" />
                  <span className="font-medium">{label}</span>
                </div>
                <span className="text-xs text-muted-foreground mt-1">{description}</span>
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Aperçu du formulaire</DialogTitle>
            <DialogDescription>{name || 'Sans titre'}</DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            {sections.map((section) => {
              const sectionFields = fields
                .filter(f => f.section === section.id)
                .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

              return (
                <div key={section.id} className="space-y-4">
                  <h3 className="font-semibold border-b pb-2">{section.title}</h3>
                  {sectionFields.map((field) => (
                    <PreviewField key={field.id} field={field} />
                  ))}
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Field Item in list - INLINE EXPANDABLE EDITOR
function FieldItem({
  field,
  isEditing,
  onEdit,
  onClose,
  onDelete,
  onDuplicate,
  onMoveUp,
  onMoveDown,
  onUpdate,
}: {
  field: FormFieldDefinition;
  isEditing: boolean;
  onEdit: () => void;
  onClose: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onUpdate: (updates: Partial<FormFieldDefinition>) => void;
}) {
  const typeConfig = FIELD_TYPES.find(t => t.type === field.type);
  const Icon = typeConfig?.icon ?? Type;

  return (
    <div className={`rounded-lg border transition-all ${isEditing ? 'border-primary shadow-sm' : 'hover:border-muted-foreground/30'}`}>
      {/* Header row - always visible */}
      <div
        className={`flex items-center gap-2 p-3 cursor-pointer ${isEditing ? 'bg-primary/5' : 'hover:bg-muted/30'}`}
        onClick={() => isEditing ? onClose() : onEdit()}
      >
        <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
        <Icon className="h-4 w-4 text-muted-foreground" />
        <span className="flex-1 text-sm font-medium truncate">
          {field.label || <span className="text-muted-foreground italic">Sans titre</span>}
        </span>
        {field.required && <Badge variant="destructive" className="text-xs">Requis</Badge>}

        {/* Visual hint to configure */}
        {!isEditing && !field.label && (
          <Badge variant="outline" className="text-xs text-orange-600 border-orange-300 bg-orange-50">
            <Settings2 className="h-3 w-3 mr-1" />
            Configurer
          </Badge>
        )}

        {isEditing ? (
          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={(e) => { e.stopPropagation(); onClose(); }}>
            Fermer
          </Button>
        ) : (
          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-primary" onClick={(e) => { e.stopPropagation(); onEdit(); }}>
            <Settings2 className="h-3 w-3 mr-1" />
            Modifier
          </Button>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <Button variant="ghost" size="icon" className="h-7 w-7">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onMoveUp(); }}>
              Monter
            </DropdownMenuItem>
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onMoveDown(); }}>
              Descendre
            </DropdownMenuItem>
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onDuplicate(); }}>
              <Copy className="mr-2 h-4 w-4" />
              Dupliquer
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              className="text-destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Supprimer
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Inline editor - shows when editing */}
      {isEditing && (
        <div className="p-4 pt-0 border-t bg-muted/20">
          <div className="pt-4 space-y-4">
            <InlineFieldEditor field={field} onChange={onUpdate} />
          </div>
        </div>
      )}
    </div>
  );
}

// Inline Field Editor - embedded directly in the field item
function InlineFieldEditor({
  field,
  onChange,
}: {
  field: FormFieldDefinition;
  onChange: (updates: Partial<FormFieldDefinition>) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Libellé de la question</Label>
        <Input
          value={field.label}
          onChange={(e) => onChange({ label: e.target.value })}
          className="min-h-[44px]"
        />
      </div>

      {field.type !== 'heading' && field.type !== 'paragraph' && (
        <div className="flex items-center justify-between">
          <Label htmlFor="required">Réponse obligatoire</Label>
          <Switch
            id="required"
            checked={field.required ?? false}
            onCheckedChange={(checked) => onChange({ required: checked })}
          />
        </div>
      )}

      {(field.type === 'text' || field.type === 'textarea' || field.type === 'paragraph') && (
        <div className="space-y-2">
          <Label>Texte d'aide / placeholder</Label>
          <Input
            value={field.placeholder ?? ''}
            onChange={(e) => onChange({ placeholder: e.target.value })}
            placeholder="Ex: Décrivez votre expérience..."
          />
        </div>
      )}

      {field.type === 'rating' && (
        <div className="space-y-2">
          <Label>Échelle de notation</Label>
          <Select
            value={String(field.ratingConfig?.scale ?? 5)}
            onValueChange={(val) => onChange({
              ratingConfig: { ...field.ratingConfig, scale: Number(val) as 3 | 5 | 7 | 10, type: 'stars' }
            })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="3">3 niveaux</SelectItem>
              <SelectItem value="5">5 niveaux</SelectItem>
              <SelectItem value="7">7 niveaux</SelectItem>
              <SelectItem value="10">10 niveaux</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {(field.type === 'select' || field.type === 'radio') && (
        <div className="space-y-2">
          <Label>Options</Label>
          {field.options?.map((opt, i) => (
            <div key={i} className="flex gap-2">
              <Input
                value={opt.label}
                onChange={(e) => {
                  const newOptions = [...(field.options ?? [])];
                  newOptions[i] = { ...opt, label: e.target.value, value: e.target.value.toLowerCase().replace(/\s+/g, '_') };
                  onChange({ options: newOptions });
                }}
                placeholder={`Option ${i + 1}`}
              />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  const newOptions = field.options?.filter((_, idx) => idx !== i);
                  onChange({ options: newOptions });
                }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const newOptions = [...(field.options ?? []), { value: '', label: '' }];
              onChange({ options: newOptions });
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            Ajouter une option
          </Button>
        </div>
      )}

      {field.type === 'slider' && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-2">
              <Label>Min</Label>
              <Input
                type="number"
                value={field.sliderConfig?.min ?? 0}
                onChange={(e) => onChange({
                  sliderConfig: { ...field.sliderConfig!, min: Number(e.target.value) }
                })}
              />
            </div>
            <div className="space-y-2">
              <Label>Max</Label>
              <Input
                type="number"
                value={field.sliderConfig?.max ?? 100}
                onChange={(e) => onChange({
                  sliderConfig: { ...field.sliderConfig!, max: Number(e.target.value) }
                })}
              />
            </div>
            <div className="space-y-2">
              <Label>Pas</Label>
              <Input
                type="number"
                value={field.sliderConfig?.step ?? 1}
                onChange={(e) => onChange({
                  sliderConfig: { ...field.sliderConfig!, step: Number(e.target.value) }
                })}
              />
            </div>
          </div>
        </div>
      )}

      <div className="space-y-2">
        <Label>Texte d'aide</Label>
        <Input
          value={field.helpText ?? ''}
          onChange={(e) => onChange({ helpText: e.target.value })}
          placeholder="Information supplémentaire pour l'utilisateur"
        />
      </div>
    </div>
  );
}

// Preview Field
function PreviewField({ field }: { field: FormFieldDefinition }) {
  if (field.type === 'heading') {
    return <h4 className="font-medium text-lg border-b pb-1">{field.label}</h4>;
  }

  if (field.type === 'paragraph') {
    return <p className="text-sm text-muted-foreground italic">{field.placeholder || field.label}</p>;
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
      {field.type === 'rating' && (
        <div className="flex gap-1">
          {Array.from({ length: field.ratingConfig?.scale ?? 5 }).map((_, i) => (
            <Star key={i} className="h-5 w-5 text-muted-foreground" />
          ))}
        </div>
      )}
      {(field.type === 'text' || field.type === 'number') && (
        <div className="h-10 w-full bg-muted rounded border" />
      )}
      {field.type === 'textarea' && (
        <div className="h-20 w-full bg-muted rounded border" />
      )}
      {(field.type === 'select' || field.type === 'radio') && (
        <div className="space-y-1">
          {field.options?.map((opt, i) => (
            <div key={i} className="flex items-center gap-2 text-sm">
              <div className="h-4 w-4 rounded-full border" />
              {opt.label}
            </div>
          ))}
        </div>
      )}
      {field.type === 'slider' && (
        <div className="h-2 w-full bg-muted rounded-full">
          <div className="h-full w-1/3 bg-primary rounded-full" />
        </div>
      )}
    </div>
  );
}
