/**
 * Shift Template Manager - CRUD interface for shift templates
 *
 * Design Pattern: Progressive Disclosure (HCI Principles)
 * - List all templates with visual indicators
 * - Quick actions (edit, delete, duplicate)
 * - Create/edit in dialog
 * - Large touch targets
 * - Color-coded templates
 */

'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Plus,
  Edit,
  Trash2,
  Clock,
  Moon,
  Sun,
  Calendar as CalendarIcon,
  Copy
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ShiftTemplate } from '@/lib/db/schema/shift-planning';

// ============================================
// Types
// ============================================

type ShiftTemplateManagerProps = {
  templates: ShiftTemplate[];
  onCreateTemplate: () => void;
  onEditTemplate: (template: ShiftTemplate) => void;
  onDeleteTemplate: (templateId: string) => Promise<void>;
  onDuplicateTemplate?: (template: ShiftTemplate) => void;
  isLoading?: boolean;
};

// ============================================
// Component
// ============================================

export function ShiftTemplateManager({
  templates,
  onCreateTemplate,
  onEditTemplate,
  onDeleteTemplate,
  onDuplicateTemplate,
  isLoading = false,
}: ShiftTemplateManagerProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (templateId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce modèle ?')) return;

    setDeletingId(templateId);
    try {
      await onDeleteTemplate(templateId);
    } finally {
      setDeletingId(null);
    }
  };

  // Group templates by type
  const groupedTemplates = templates.reduce((acc, template) => {
    if (!acc[template.shiftType]) {
      acc[template.shiftType] = [];
    }
    acc[template.shiftType].push(template);
    return acc;
  }, {} as Record<string, ShiftTemplate[]>);

  const shiftTypeLabels: Record<string, { label: string; icon: typeof Sun }> = {
    regular: { label: 'Quarts Réguliers', icon: Sun },
    night: { label: 'Quarts de Nuit', icon: Moon },
    weekend: { label: 'Quarts de Weekend', icon: CalendarIcon },
    holiday: { label: 'Quarts de Jour Férié', icon: CalendarIcon },
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Modèles de Quarts</h2>
          <p className="text-sm text-muted-foreground">
            Gérez les modèles de quarts réutilisables
          </p>
        </div>

        <Button onClick={onCreateTemplate} className="gap-2" disabled={isLoading}>
          <Plus className="h-4 w-4" />
          Nouveau Modèle
        </Button>
      </div>

      {/* Templates by Type */}
      {Object.entries(groupedTemplates).map(([type, typeTemplates]) => {
        const { label, icon: Icon } = shiftTypeLabels[type] || {
          label: type,
          icon: Clock,
        };

        return (
          <div key={type} className="space-y-3">
            <div className="flex items-center gap-2">
              <Icon className="h-5 w-5 text-muted-foreground" />
              <h3 className="text-lg font-semibold">{label}</h3>
              <Badge variant="secondary">{typeTemplates.length}</Badge>
            </div>

            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {typeTemplates.map((template) => (
                <TemplateCard
                  key={template.id}
                  template={template}
                  onEdit={() => onEditTemplate(template)}
                  onDelete={() => handleDelete(template.id)}
                  onDuplicate={onDuplicateTemplate ? () => onDuplicateTemplate(template) : undefined}
                  isDeleting={deletingId === template.id}
                />
              ))}
            </div>
          </div>
        );
      })}

      {/* Empty State */}
      {templates.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center space-y-4">
            <div className="flex justify-center">
              <div className="rounded-full bg-muted p-4">
                <Clock className="h-8 w-8 text-muted-foreground" />
              </div>
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-semibold">Aucun modèle de quart</h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                Créez des modèles réutilisables pour planifier rapidement les quarts de vos employés.
              </p>
            </div>
            <Button onClick={onCreateTemplate} className="gap-2">
              <Plus className="h-4 w-4" />
              Créer Votre Premier Modèle
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ============================================
// Template Card Component
// ============================================

type TemplateCardProps = {
  template: ShiftTemplate;
  onEdit: () => void;
  onDelete: () => void;
  onDuplicate?: () => void;
  isDeleting: boolean;
};

function TemplateCard({ template, onEdit, onDelete, onDuplicate, isDeleting }: TemplateCardProps) {
  const duration = parseFloat(template.durationHours || '0');
  const paidHours = parseFloat(template.paidHours || '0');
  const breakMinutes = template.breakMinutes || 0;

  return (
    <Card
      className={cn(
        'transition-all hover:shadow-lg',
        !template.isActive && 'opacity-60'
      )}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1 flex-1">
            {/* Template Name */}
            <div className="flex items-center gap-2">
              {template.color && (
                <div
                  className="w-4 h-4 rounded-full flex-shrink-0"
                  style={{ backgroundColor: template.color }}
                />
              )}
              <CardTitle className="text-lg">{template.name}</CardTitle>
            </div>

            {/* Code */}
            <Badge variant="outline" className="font-mono text-xs">
              {template.code}
            </Badge>
          </div>

          {/* Active Status */}
          {!template.isActive && (
            <Badge variant="secondary" className="text-xs">
              Inactif
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Time Details */}
        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Horaires:</span>
            <span className="font-medium">
              {template.startTime.slice(0, 5)} - {template.endTime.slice(0, 5)}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Durée totale:</span>
            <span className="font-medium">{duration}h</span>
          </div>

          {breakMinutes > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Pause:</span>
              <span className="font-medium">{breakMinutes} min</span>
            </div>
          )}

          <div className="flex items-center justify-between border-t pt-2">
            <span className="text-muted-foreground font-semibold">Heures payées:</span>
            <span className="font-bold text-lg">{paidHours}h</span>
          </div>
        </div>

        {/* Overtime Multiplier */}
        {template.overtimeMultiplier && parseFloat(template.overtimeMultiplier) > 1 && (
          <Badge variant="default" className="w-full justify-center">
            Majoration {(parseFloat(template.overtimeMultiplier) - 1) * 100}%
          </Badge>
        )}

        {/* Description */}
        {template.description && (
          <p className="text-xs text-muted-foreground line-clamp-2">
            {template.description}
          </p>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 pt-2 border-t">
          <Button
            variant="outline"
            size="sm"
            onClick={onEdit}
            className="flex-1 gap-2"
          >
            <Edit className="h-3 w-3" />
            Modifier
          </Button>

          {onDuplicate && (
            <Button
              variant="outline"
              size="sm"
              onClick={onDuplicate}
              className="gap-2"
            >
              <Copy className="h-3 w-3" />
            </Button>
          )}

          <Button
            variant="destructive"
            size="sm"
            onClick={onDelete}
            disabled={isDeleting}
            className="gap-2"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
