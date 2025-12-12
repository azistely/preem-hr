/**
 * Field Palette Component
 *
 * Draggable palette of available field types for the form builder.
 * Users can drag fields from the palette onto the form canvas.
 *
 * Features:
 * - Categorized field types
 * - Drag and drop support
 * - Field type previews
 * - Search/filter
 */

'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Type,
  AlignLeft,
  Hash,
  Calendar,
  Clock,
  ListFilter,
  CheckSquare,
  CircleDot,
  ToggleLeft,
  Star,
  SlidersHorizontal,
  User,
  Upload,
  FileText,
  Calculator,
  Heading,
  Text,
  Search,
  GripVertical,
} from 'lucide-react';
import type { FormFieldType } from '@/lib/db/schema/hr-forms';

// Field type categories
const fieldCategories = {
  basic: {
    label: 'Champs de base',
    description: 'Texte, nombres et dates',
  },
  selection: {
    label: 'Sélection',
    description: 'Listes et cases à cocher',
  },
  evaluation: {
    label: 'Évaluation',
    description: 'Notes et échelles',
  },
  advanced: {
    label: 'Avancé',
    description: 'Fichiers et calculs',
  },
  layout: {
    label: 'Mise en page',
    description: 'Titres et textes',
  },
};

// Field type definitions
const fieldTypes: {
  type: FormFieldType;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  category: keyof typeof fieldCategories;
}[] = [
  // Basic
  {
    type: 'text',
    label: 'Texte court',
    description: 'Une ligne de texte',
    icon: Type,
    category: 'basic',
  },
  {
    type: 'textarea',
    label: 'Texte long',
    description: 'Plusieurs lignes de texte',
    icon: AlignLeft,
    category: 'basic',
  },
  {
    type: 'number',
    label: 'Nombre',
    description: 'Valeur numérique',
    icon: Hash,
    category: 'basic',
  },
  {
    type: 'date',
    label: 'Date',
    description: 'Sélecteur de date',
    icon: Calendar,
    category: 'basic',
  },
  {
    type: 'datetime',
    label: 'Date et heure',
    description: 'Date avec heure',
    icon: Clock,
    category: 'basic',
  },

  // Selection
  {
    type: 'select',
    label: 'Liste déroulante',
    description: 'Choix unique dans une liste',
    icon: ListFilter,
    category: 'selection',
  },
  {
    type: 'multiselect',
    label: 'Choix multiples',
    description: 'Plusieurs choix possibles',
    icon: CheckSquare,
    category: 'selection',
  },
  {
    type: 'radio',
    label: 'Boutons radio',
    description: 'Choix exclusif visible',
    icon: CircleDot,
    category: 'selection',
  },
  {
    type: 'checkbox',
    label: 'Case à cocher',
    description: 'Oui/Non simple',
    icon: ToggleLeft,
    category: 'selection',
  },

  // Evaluation
  {
    type: 'rating',
    label: 'Notation',
    description: 'Échelle de 1 à 5 (étoiles)',
    icon: Star,
    category: 'evaluation',
  },
  {
    type: 'slider',
    label: 'Curseur',
    description: 'Valeur sur une échelle',
    icon: SlidersHorizontal,
    category: 'evaluation',
  },

  // Advanced
  {
    type: 'employee',
    label: 'Sélecteur employé',
    description: 'Choisir un employé',
    icon: User,
    category: 'advanced',
  },
  {
    type: 'file',
    label: 'Fichier',
    description: 'Upload de fichier',
    icon: Upload,
    category: 'advanced',
  },
  {
    type: 'rich_text',
    label: 'Texte enrichi',
    description: 'Formatage avancé',
    icon: FileText,
    category: 'advanced',
  },
  {
    type: 'computed',
    label: 'Champ calculé',
    description: 'Formule automatique',
    icon: Calculator,
    category: 'advanced',
  },

  // Layout
  {
    type: 'heading',
    label: 'Titre',
    description: 'Section de titre',
    icon: Heading,
    category: 'layout',
  },
  {
    type: 'paragraph',
    label: 'Paragraphe',
    description: 'Texte explicatif',
    icon: Text,
    category: 'layout',
  },
];

interface FieldPaletteProps {
  /** Callback when a field type is selected/dragged */
  onFieldSelect?: (fieldType: FormFieldType) => void;
  /** Currently selected field type for highlighting */
  selectedType?: FormFieldType | null;
  /** Disabled field types */
  disabledTypes?: FormFieldType[];
  /** Show only specific categories */
  categories?: (keyof typeof fieldCategories)[];
  /** Compact mode */
  compact?: boolean;
  /** Custom class name */
  className?: string;
}

export function FieldPalette({
  onFieldSelect,
  selectedType,
  disabledTypes = [],
  categories,
  compact = false,
  className,
}: FieldPaletteProps) {
  const [search, setSearch] = useState('');

  // Filter fields by search and categories
  const filteredFields = fieldTypes.filter((field) => {
    // Category filter
    if (categories && !categories.includes(field.category)) {
      return false;
    }
    // Search filter
    if (search) {
      const query = search.toLowerCase();
      return (
        field.label.toLowerCase().includes(query) ||
        field.description.toLowerCase().includes(query)
      );
    }
    return true;
  });

  // Group by category
  const groupedFields = filteredFields.reduce((acc, field) => {
    if (!acc[field.category]) {
      acc[field.category] = [];
    }
    acc[field.category].push(field);
    return acc;
  }, {} as Record<string, typeof fieldTypes>);

  // Handle field click
  const handleFieldClick = (fieldType: FormFieldType) => {
    if (!disabledTypes.includes(fieldType)) {
      onFieldSelect?.(fieldType);
    }
  };

  // Handle drag start
  const handleDragStart = (e: React.DragEvent, fieldType: FormFieldType) => {
    e.dataTransfer.setData('fieldType', fieldType);
    e.dataTransfer.effectAllowed = 'copy';
  };

  return (
    <Card className={cn('h-full', className)}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Champs disponibles</CardTitle>
        {/* Search */}
        <div className="relative mt-2">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-9"
          />
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <ScrollArea className="h-[calc(100vh-300px)] px-4 pb-4">
          {Object.entries(groupedFields).map(([category, fields]) => (
            <div key={category} className="mb-6 last:mb-0">
              {/* Category header */}
              <div className="mb-3">
                <h4 className="text-sm font-medium text-foreground">
                  {fieldCategories[category as keyof typeof fieldCategories]?.label}
                </h4>
                {!compact && (
                  <p className="text-xs text-muted-foreground">
                    {fieldCategories[category as keyof typeof fieldCategories]?.description}
                  </p>
                )}
              </div>

              {/* Fields */}
              <div className="space-y-2">
                {fields.map((field) => {
                  const Icon = field.icon;
                  const isDisabled = disabledTypes.includes(field.type);
                  const isSelected = selectedType === field.type;

                  return (
                    <div
                      key={field.type}
                      draggable={!isDisabled}
                      onClick={() => handleFieldClick(field.type)}
                      onDragStart={(e) => handleDragStart(e, field.type)}
                      className={cn(
                        'flex items-center gap-3 p-2 rounded-lg border transition-all',
                        'cursor-grab active:cursor-grabbing',
                        isDisabled && 'opacity-50 cursor-not-allowed',
                        isSelected && 'border-primary bg-primary/5',
                        !isDisabled && !isSelected && 'hover:border-primary/50 hover:bg-muted/50'
                      )}
                    >
                      {/* Drag handle */}
                      <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0" />

                      {/* Icon */}
                      <div className={cn(
                        'p-1.5 rounded-md',
                        isSelected ? 'bg-primary/10' : 'bg-muted'
                      )}>
                        <Icon className={cn(
                          'h-4 w-4',
                          isSelected ? 'text-primary' : 'text-muted-foreground'
                        )} />
                      </div>

                      {/* Label & description */}
                      <div className="flex-1 min-w-0">
                        <p className={cn(
                          'text-sm font-medium truncate',
                          isSelected && 'text-primary'
                        )}>
                          {field.label}
                        </p>
                        {!compact && (
                          <p className="text-xs text-muted-foreground truncate">
                            {field.description}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Empty state */}
          {Object.keys(groupedFields).length === 0 && (
            <div className="py-8 text-center">
              <Search className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">
                Aucun champ trouvé
              </p>
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

export { fieldTypes, fieldCategories };
export default FieldPalette;
