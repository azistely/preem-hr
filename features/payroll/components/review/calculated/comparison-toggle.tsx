'use client';

/**
 * Comparison Mode Toggle Component
 *
 * Allows users to switch between normal view and month-over-month comparison view
 */

import { BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ComparisonToggleProps {
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  disabled?: boolean;
}

export function ComparisonToggle({ enabled, onToggle, disabled = false }: ComparisonToggleProps) {
  return (
    <div className="flex gap-2">
      <Button
        variant={enabled ? 'outline' : 'default'}
        size="default"
        onClick={() => onToggle(false)}
        disabled={disabled}
        className="min-h-[44px]"
      >
        Affichage Normal
      </Button>
      <Button
        variant={enabled ? 'default' : 'outline'}
        size="default"
        onClick={() => onToggle(true)}
        disabled={disabled}
        className="min-h-[44px] gap-2"
      >
        <BarChart3 className="h-4 w-4" />
        Comparer
      </Button>
    </div>
  );
}
