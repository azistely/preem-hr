/**
 * QuickAddTemplate Component
 *
 * Browse and add salary components from Smart Templates
 * Features:
 * - 3-tier compliance badges (🔒/⚙️/🎨)
 * - One-click add for locked/freeform templates
 * - Customization dialog for configurable templates
 * - Grouped by compliance level
 */

'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Lock, Settings2, Palette, Plus, Check } from 'lucide-react';
import { CustomizationDialog } from './customization-dialog';
import type { SalaryComponentTemplate } from '@/features/employees/types/salary-components';

interface QuickAddTemplateProps {
  countryCode: string;
  onTemplateAdded?: () => void;
}

export function QuickAddTemplate({ countryCode, onTemplateAdded }: QuickAddTemplateProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<SalaryComponentTemplate | null>(null);
  const [addedTemplates, setAddedTemplates] = useState<Set<string>>(new Set());

  // Fetch templates
  const { data: templates, isLoading } = trpc.salaryComponents.getComponentTemplates.useQuery({
    countryCode,
    popularOnly: false,
  });

  // Add from template mutation
  const addFromTemplate = trpc.salaryComponents.addFromTemplate.useMutation({
    onSuccess: (data) => {
      setAddedTemplates((prev) => new Set(prev).add(data.templateCode || ''));
      onTemplateAdded?.();
    },
  });

  const handleQuickAdd = (template: SalaryComponentTemplate) => {
    const complianceLevel = (template as any).complianceLevel || 'freeform';

    // Locked and freeform templates: add immediately
    if (complianceLevel === 'locked' || complianceLevel === 'freeform') {
      addFromTemplate.mutate({
        templateCode: template.code,
      });
    } else {
      // Configurable: show customization dialog
      setSelectedTemplate(template);
    }
  };

  const handleCustomizationComplete = () => {
    setSelectedTemplate(null);
    onTemplateAdded?.();
  };

  // Group templates by compliance level
  const groupedTemplates = templates?.reduce(
    (acc, template) => {
      const level = (template as any).complianceLevel || 'freeform';
      if (!acc[level]) acc[level] = [];
      acc[level].push(template);
      return acc;
    },
    {} as Record<string, SalaryComponentTemplate[]>
  );

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!templates || templates.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Aucun modèle disponible pour ce pays
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="space-y-6">
        {/* Locked Templates (Mandatory) */}
        {groupedTemplates?.locked && groupedTemplates.locked.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-destructive" />
              <h3 className="text-lg font-semibold">Obligatoires (Convention Collective)</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Composants requis par la loi. Ils ne peuvent pas être modifiés.
            </p>
            <div className="grid gap-3">
              {groupedTemplates.locked.map((template) => (
                <TemplateCard
                  key={template.id}
                  template={template}
                  complianceLevel="locked"
                  onAdd={handleQuickAdd}
                  isAdded={addedTemplates.has(template.code)}
                  isAdding={addFromTemplate.isPending}
                />
              ))}
            </div>
          </div>
        )}

        {/* Configurable Templates (Within Legal Bounds) */}
        {groupedTemplates?.configurable && groupedTemplates.configurable.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Settings2 className="h-5 w-5 text-primary" />
              <h3 className="text-lg font-semibold">Configurables (limites légales)</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Vous pouvez ajuster ces composants dans les limites fixées par la loi.
            </p>
            <div className="grid gap-3">
              {groupedTemplates.configurable.map((template) => (
                <TemplateCard
                  key={template.id}
                  template={template}
                  complianceLevel="configurable"
                  onAdd={handleQuickAdd}
                  isAdded={addedTemplates.has(template.code)}
                  isAdding={addFromTemplate.isPending}
                />
              ))}
            </div>
          </div>
        )}

        {/* Freeform Templates (Full Flexibility) */}
        {groupedTemplates?.freeform && groupedTemplates.freeform.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Palette className="h-5 w-5 text-muted-foreground" />
              <h3 className="text-lg font-semibold">Personnalisés (exemples)</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Composants libres que vous pouvez personnaliser entièrement.
            </p>
            <div className="grid gap-3">
              {groupedTemplates.freeform.map((template) => (
                <TemplateCard
                  key={template.id}
                  template={template}
                  complianceLevel="freeform"
                  onAdd={handleQuickAdd}
                  isAdded={addedTemplates.has(template.code)}
                  isAdding={addFromTemplate.isPending}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Customization Dialog */}
      {selectedTemplate && (
        <CustomizationDialog
          template={selectedTemplate}
          countryCode={countryCode}
          open={!!selectedTemplate}
          onOpenChange={(open) => !open && setSelectedTemplate(null)}
          onComplete={handleCustomizationComplete}
        />
      )}
    </>
  );
}

// ============================================================================
// Template Card Component
// ============================================================================

interface TemplateCardProps {
  template: SalaryComponentTemplate;
  complianceLevel: 'locked' | 'configurable' | 'freeform';
  onAdd: (template: SalaryComponentTemplate) => void;
  isAdded: boolean;
  isAdding: boolean;
}

function TemplateCard({
  template,
  complianceLevel,
  onAdd,
  isAdded,
  isAdding,
}: TemplateCardProps) {
  const name = (template.name as Record<string, string>).fr || 'Sans nom';
  const description = template.description;
  const legalReference = (template as any).legalReference;

  const complianceIcons = {
    locked: <Lock className="h-4 w-4" />,
    configurable: <Settings2 className="h-4 w-4" />,
    freeform: <Palette className="h-4 w-4" />,
  };

  const complianceLabels = {
    locked: 'Obligatoire',
    configurable: 'Configurable',
    freeform: 'Libre',
  };

  const complianceVariants = {
    locked: 'destructive' as const,
    configurable: 'default' as const,
    freeform: 'secondary' as const,
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 space-y-1">
            <div className="flex items-center gap-2">
              <CardTitle className="text-base">{name}</CardTitle>
              <Badge variant={complianceVariants[complianceLevel]} className="gap-1">
                {complianceIcons[complianceLevel]}
                {complianceLabels[complianceLevel]}
              </Badge>
            </div>
            {description && (
              <CardDescription className="text-sm">{description}</CardDescription>
            )}
            {legalReference && (
              <p className="text-xs text-muted-foreground">
                Référence: {legalReference}
              </p>
            )}
          </div>
          <Button
            onClick={() => onAdd(template)}
            disabled={isAdded || isAdding}
            size="sm"
            className="min-h-[44px]"
          >
            {isAdded ? (
              <>
                <Check className="mr-2 h-4 w-4" />
                Ajouté
              </>
            ) : (
              <>
                <Plus className="mr-2 h-4 w-4" />
                {complianceLevel === 'configurable' ? 'Configurer' : 'Ajouter'}
              </>
            )}
          </Button>
        </div>
      </CardHeader>
    </Card>
  );
}
