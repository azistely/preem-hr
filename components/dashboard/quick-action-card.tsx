"use client";

import * as React from "react";
import Link from "next/link";
import { LucideIcon } from "lucide-react";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface QuickActionCardProps {
  icon: LucideIcon | React.ReactElement<any>;
  title: string;
  description: string;
  href?: string;
  onClick?: () => void;
  action?: string;
  badge?: number;
  variant?: 'primary' | 'warning' | 'default' | 'destructive';
  size?: 'default' | 'large';
  disabled?: boolean;
  className?: string;
  // Legacy props for backwards compatibility
  label?: string;
}

/**
 * Quick Action Card Component
 *
 * HCI-Compliant Design:
 * - Large touch targets (min 120px height for cards, 56px for primary CTAs)
 * - Clear visual hierarchy (icon + title + description + action)
 * - Task-oriented labels (action verbs, not system operations)
 * - Immediate visual feedback on interaction
 * - Mobile-first responsive design
 *
 * Usage:
 * <QuickActionCard
 *   icon={Play}
 *   title="Lancer la Paie"
 *   description="Octobre 2025"
 *   action="Démarrer"
 *   href="/payroll/new"
 *   variant="primary"
 *   size="large"
 * />
 */
export function QuickActionCard({
  icon,
  title,
  label, // Legacy support
  description,
  href,
  onClick,
  action = "Voir",
  badge,
  variant = 'default',
  size = 'default',
  disabled = false,
  className,
}: QuickActionCardProps) {
  const [isHovered, setIsHovered] = React.useState(false);

  // Support both new and legacy APIs
  const displayTitle = title || label || '';
  const Icon = typeof icon === 'function' ? icon : null;

  const variantStyles = {
    primary: "border-primary bg-primary/5 hover:bg-primary/10",
    warning: "border-yellow-500 bg-yellow-50 hover:bg-yellow-100 dark:bg-yellow-950 dark:hover:bg-yellow-900",
    destructive: "border-destructive bg-destructive/5 hover:bg-destructive/10",
    default: "border-border hover:bg-muted/50",
  };

  const iconColorStyles = {
    primary: "text-primary",
    warning: "text-yellow-600 dark:text-yellow-500",
    destructive: "text-destructive",
    default: "text-muted-foreground",
  };

  const buttonVariantMap = {
    primary: "default" as const,
    warning: "default" as const,
    destructive: "destructive" as const,
    default: "outline" as const,
  };

  const minHeight = size === 'large' ? 'min-h-[160px]' : 'min-h-[120px]';

  const cardContent = (
    <Card
      className={cn(
        "relative transition-all duration-200",
        href ? "cursor-pointer" : onClick ? "cursor-pointer" : "",
        disabled && "cursor-not-allowed opacity-50",
        variantStyles[variant],
        minHeight,
        "hover:shadow-md",
        className
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={!href && onClick ? onClick : undefined}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className={cn("transition-transform duration-200", isHovered && "scale-110")}>
            {Icon ? (
              <Icon className={cn(
                size === 'large' ? 'h-10 w-10' : 'h-8 w-8',
                iconColorStyles[variant]
              )} />
            ) : typeof icon === 'object' && React.isValidElement(icon) ? (
              React.cloneElement(icon, {
                className: cn(
                  size === 'large' ? 'h-10 w-10' : 'h-8 w-8',
                  iconColorStyles[variant],
                  (icon.props as any).className
                ),
              } as any)
            ) : null}
          </div>
          {badge !== undefined && badge > 0 && (
            <Badge variant={variant === 'warning' || variant === 'primary' ? 'default' : variant} className="animate-pulse">
              {badge}
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        <div className="space-y-1">
          <h3 className={cn(
            "font-semibold leading-tight",
            size === 'large' ? 'text-xl' : 'text-lg'
          )}>
            {displayTitle}
          </h3>
          {description && (
            <p className="text-sm text-muted-foreground leading-tight">
              {description}
            </p>
          )}
        </div>

        {(href || onClick) && (
          <Button
            variant={buttonVariantMap[variant]}
            size={size === 'large' ? 'lg' : 'default'}
            className={cn(
              "w-full transition-transform duration-200",
              size === 'large' && "min-h-[56px] text-base font-medium",
              isHovered && "scale-105"
            )}
            disabled={disabled}
            asChild={!!href}
          >
            <span>{action}</span>
          </Button>
        )}
      </CardContent>
    </Card>
  );

  if (href && !disabled) {
    return (
      <Link href={href} className="block focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded-lg">
        {cardContent}
      </Link>
    );
  }

  return cardContent;
}

/**
 * Grid Container for Quick Action Cards
 *
 * Responsive grid that adapts to screen size:
 * - Mobile: 1 column
 * - Tablet: 2 columns
 * - Desktop: 3 columns (or 4 for dense layouts)
 */
export function QuickActionsGrid({
  children,
  columns = 3,
  className,
}: {
  children: React.ReactNode;
  columns?: 2 | 3 | 4;
  className?: string;
}) {
  const gridCols = {
    2: 'md:grid-cols-2',
    3: 'md:grid-cols-2 lg:grid-cols-3',
    4: 'md:grid-cols-2 lg:grid-cols-4',
  };

  return (
    <div className={cn(
      "grid grid-cols-1 gap-6",
      gridCols[columns],
      className
    )}>
      {children}
    </div>
  );
}
