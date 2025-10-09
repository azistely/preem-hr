/**
 * Workflow Template Card Component
 * Epic: Phase 4 - Visual Workflow Builder
 *
 * Displays a pre-built workflow template with icon, title, description.
 * Following HCI principles: Zero learning curve, task-oriented design.
 */

'use client';

import * as React from 'react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  FileText,
  Calendar,
  Users,
  TrendingUp,
  Bell,
  CheckCircle2,
  type LucideIcon,
} from 'lucide-react';

interface WorkflowTemplateCardProps {
  id: string;
  name: string;
  description?: string | null;
  category?: string | null;
  triggerType: string;
  actionCount: number;
  onUse: (templateId: string) => void;
  className?: string;
}

/**
 * Map trigger types to icons for visual recognition
 */
const triggerIcons: Record<string, LucideIcon> = {
  'contract.expiring': FileText,
  'employee.hired': Users,
  'employee.terminated': Users,
  'salary.changed': TrendingUp,
  'leave.approved': Calendar,
  'document.expiring': FileText,
  default: Bell,
};

/**
 * Map categories to colors for visual distinction
 */
const categoryColors: Record<string, string> = {
  contract_management: 'bg-blue-100 text-blue-800',
  payroll: 'bg-green-100 text-green-800',
  onboarding: 'bg-purple-100 text-purple-800',
  offboarding: 'bg-orange-100 text-orange-800',
  default: 'bg-gray-100 text-gray-800',
};

/**
 * Translate categories to French
 */
const categoryLabels: Record<string, string> = {
  contract_management: 'Gestion des contrats',
  payroll: 'Paie',
  onboarding: 'Intégration',
  offboarding: 'Départ',
  default: 'Général',
};

export function WorkflowTemplateCard({
  id,
  name,
  description,
  category,
  triggerType,
  actionCount,
  onUse,
  className,
}: WorkflowTemplateCardProps) {
  // Get icon based on trigger type
  const Icon = triggerIcons[triggerType] || triggerIcons.default;

  // Get category styling
  const categoryColor =
    categoryColors[category || ''] || categoryColors.default;
  const categoryLabel =
    categoryLabels[category || ''] || categoryLabels.default;

  return (
    <Card
      className={cn(
        'hover:shadow-md transition-shadow cursor-pointer',
        className
      )}
      onClick={() => onUse(id)}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Icon className="h-5 w-5 text-primary" aria-hidden="true" />
            </div>
            <div>
              <CardTitle className="text-lg">{name}</CardTitle>
              {category && (
                <Badge
                  variant="secondary"
                  className={cn('mt-1 text-xs', categoryColor)}
                >
                  {categoryLabel}
                </Badge>
              )}
            </div>
          </div>
        </div>
      </CardHeader>

      {description && (
        <CardContent className="pb-3">
          <CardDescription className="text-sm leading-relaxed">
            {description}
          </CardDescription>
        </CardContent>
      )}

      <CardFooter className="pt-3 border-t flex items-center justify-between">
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-1">
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            {actionCount} {actionCount === 1 ? 'action' : 'actions'}
          </span>
        </div>
        <Button
          size="sm"
          className="min-h-[44px]"
          onClick={(e) => {
            e.stopPropagation();
            onUse(id);
          }}
        >
          Utiliser ce modèle
        </Button>
      </CardFooter>
    </Card>
  );
}
