/**
 * Category Badge Component
 *
 * HCI Principles Applied:
 * - Pattern 5: Status with Visual + Text (icon + label)
 * - Pattern 7: Country-Specific Labels (friendly names)
 * - Cognitive Load Minimization (show essential, hide details)
 *
 * Displays employee category in profile/list views with:
 * - Category icon
 * - Friendly label (not technical codes)
 * - Optional coefficient display
 * - Tooltip with details
 */

'use client';

import { trpc } from '@/lib/trpc';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Briefcase,
  HardHat,
  Users,
  GraduationCap,
  Crown,
  Building2,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface CategoryBadgeProps {
  employeeId: string;
  showCoefficient?: boolean;
  showTooltip?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

// Icon mapping by category (HCI: Visual + Text pattern)
const categoryIcons = {
  A1: HardHat, // Ouvrier non qualifié
  A2: HardHat, // Ouvrier qualifié
  B1: Users, // Employé
  B2: Users, // Employé qualifié
  C: GraduationCap, // Agent de maîtrise
  D: Briefcase, // Cadre
  E: Crown, // Cadre supérieur
  F: Building2, // Directeur
};

// Color mapping by category
const categoryColors = {
  A1: 'secondary',
  A2: 'secondary',
  B1: 'default',
  B2: 'default',
  C: 'outline',
  D: 'outline',
  E: 'outline',
  F: 'outline',
} as const;

export function CategoryBadge({
  employeeId,
  showCoefficient = false,
  showTooltip = true,
  size = 'md',
  className,
}: CategoryBadgeProps) {
  const { data: employeeCategory, isLoading } =
    trpc.employeeCategories.getEmployeeCategory.useQuery({
      employeeId,
    });

  if (isLoading) {
    return <Skeleton className="h-6 w-24" />;
  }

  if (!employeeCategory) {
    return (
      <Badge variant="secondary" className={className}>
        Non défini
      </Badge>
    );
  }

  const { category } = employeeCategory;
  const Icon = categoryIcons[category.category as keyof typeof categoryIcons] || Briefcase;
  const variant = categoryColors[category.category as keyof typeof categoryColors] || 'default';

  // Size classes
  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5 gap-1',
    md: 'text-sm px-2.5 py-1 gap-1.5',
    lg: 'text-base px-3 py-1.5 gap-2',
  };

  const iconSizes = {
    sm: 'h-3 w-3',
    md: 'h-3.5 w-3.5',
    lg: 'h-4 w-4',
  };

  const badgeContent = (
    <Badge
      variant={variant}
      className={`${sizeClasses[size]} ${className} min-h-[28px]`}
    >
      <Icon className={iconSizes[size]} />
      <span>{category.labelFr}</span>
      {showCoefficient && (
        <span className="text-muted-foreground">
          ({employeeCategory.coefficient})
        </span>
      )}
    </Badge>
  );

  if (!showTooltip) {
    return badgeContent;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{badgeContent}</TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <div className="space-y-2">
            <div>
              <p className="font-semibold">{category.labelFr}</p>
              <p className="text-xs text-muted-foreground">
                Catégorie {category.category}
              </p>
            </div>

            <div className="space-y-1 text-sm">
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Coefficient:</span>
                <span className="font-medium">
                  {employeeCategory.coefficient}
                </span>
              </div>

              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Plage:</span>
                <span className="font-medium">
                  {category.minCoefficient}-{category.maxCoefficient}
                </span>
              </div>

              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Préavis:</span>
                <span className="font-medium">
                  {category.noticePeriodDays} jours
                </span>
              </div>
            </div>

            {category.notes && (
              <div className="pt-2 border-t">
                <p className="text-xs text-muted-foreground">
                  <strong>Exemples:</strong> {category.notes}
                </p>
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * Lightweight version without data fetching
 * Use when you already have the category data
 */
export function CategoryBadgeStatic({
  category,
  coefficient,
  size = 'md',
  showCoefficient = false,
  className,
}: {
  category: string;
  coefficient?: number;
  size?: 'sm' | 'md' | 'lg';
  showCoefficient?: boolean;
  className?: string;
}) {
  const Icon = categoryIcons[category as keyof typeof categoryIcons] || Briefcase;
  const variant = categoryColors[category as keyof typeof categoryColors] || 'default';

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5 gap-1',
    md: 'text-sm px-2.5 py-1 gap-1.5',
    lg: 'text-base px-3 py-1.5 gap-2',
  };

  const iconSizes = {
    sm: 'h-3 w-3',
    md: 'h-3.5 w-3.5',
    lg: 'h-4 w-4',
  };

  return (
    <Badge
      variant={variant}
      className={`${sizeClasses[size]} ${className} min-h-[28px]`}
    >
      <Icon className={iconSizes[size]} />
      <span>{category}</span>
      {showCoefficient && coefficient && (
        <span className="text-muted-foreground">({coefficient})</span>
      )}
    </Badge>
  );
}
