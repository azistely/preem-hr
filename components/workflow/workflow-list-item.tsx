/**
 * Workflow List Item Component
 * Epic: Phase 4 - Visual Workflow Builder
 *
 * Displays a workflow in a list with status, execution stats, and actions.
 * Following HCI principles: Immediate feedback, cognitive load minimization.
 */

'use client';

import * as React from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import {
  Play,
  Pause,
  Edit,
  Trash2,
  MoreVertical,
  CheckCircle2,
  XCircle,
  Clock,
} from 'lucide-react';

interface WorkflowListItemProps {
  id: string;
  name: string;
  description?: string | null;
  status: 'draft' | 'active' | 'paused' | 'archived';
  executionCount: number;
  successCount: number;
  errorCount: number;
  lastExecutedAt?: Date | null;
  onActivate?: (id: string) => void;
  onPause?: (id: string) => void;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
  className?: string;
}

/**
 * Status badge configuration
 */
const statusConfig = {
  draft: {
    label: 'Brouillon',
    variant: 'secondary' as const,
    className: 'bg-gray-100 text-gray-800',
  },
  active: {
    label: 'Actif',
    variant: 'default' as const,
    className: 'bg-green-100 text-green-800',
  },
  paused: {
    label: 'En pause',
    variant: 'secondary' as const,
    className: 'bg-yellow-100 text-yellow-800',
  },
  archived: {
    label: 'Archivé',
    variant: 'secondary' as const,
    className: 'bg-gray-100 text-gray-600',
  },
};

export function WorkflowListItem({
  id,
  name,
  description,
  status,
  executionCount,
  successCount,
  errorCount,
  lastExecutedAt,
  onActivate,
  onPause,
  onEdit,
  onDelete,
  className,
}: WorkflowListItemProps) {
  const statusInfo = statusConfig[status];
  const successRate = executionCount > 0 ? Math.round((successCount / executionCount) * 100) : 0;

  // Format last executed date
  const formatLastExecuted = () => {
    if (!lastExecutedAt) return 'Jamais exécuté';

    const date = new Date(lastExecutedAt);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'À l\'instant';
    if (diffMins < 60) return `Il y a ${diffMins} min`;
    if (diffHours < 24) return `Il y a ${diffHours}h`;
    if (diffDays < 7) return `Il y a ${diffDays}j`;

    return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  };

  return (
    <Card className={cn('hover:shadow-md transition-shadow', className)}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <Link href={`/workflows/${id}`} className="hover:underline">
                <CardTitle className="text-lg truncate">{name}</CardTitle>
              </Link>
              <Badge
                variant={statusInfo.variant}
                className={cn('text-xs', statusInfo.className)}
              >
                {statusInfo.label}
              </Badge>
            </div>
            {description && (
              <CardDescription className="mt-1 line-clamp-1">
                {description}
              </CardDescription>
            )}
          </div>

          {/* Actions dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="min-h-[44px] min-w-[44px]"
                aria-label="Actions du workflow"
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => onEdit?.(id)}>
                <Edit className="mr-2 h-4 w-4" />
                Modifier
              </DropdownMenuItem>
              {status === 'active' && (
                <DropdownMenuItem onClick={() => onPause?.(id)}>
                  <Pause className="mr-2 h-4 w-4" />
                  Mettre en pause
                </DropdownMenuItem>
              )}
              {(status === 'draft' || status === 'paused') && (
                <DropdownMenuItem onClick={() => onActivate?.(id)}>
                  <Play className="mr-2 h-4 w-4" />
                  Activer
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                onClick={() => onDelete?.(id)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Supprimer
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {/* Execution statistics */}
        <div className="flex items-center gap-6 text-sm">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 text-muted-foreground">
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              <span className="font-medium">{executionCount}</span>
            </div>
            <span className="text-muted-foreground">exécutions</span>
          </div>

          {executionCount > 0 && (
            <>
              <div className="flex items-center gap-1">
                <span
                  className={cn(
                    'font-medium',
                    successRate >= 80 ? 'text-green-600' : 'text-orange-600'
                  )}
                >
                  {successRate}%
                </span>
                <span className="text-muted-foreground">succès</span>
              </div>

              {errorCount > 0 && (
                <div className="flex items-center gap-1 text-red-600">
                  <XCircle className="h-4 w-4" aria-hidden="true" />
                  <span className="font-medium">{errorCount}</span>
                </div>
              )}
            </>
          )}

          <div className="flex items-center gap-1 text-muted-foreground ml-auto">
            <Clock className="h-4 w-4" aria-hidden="true" />
            <span className="text-xs">{formatLastExecuted()}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
