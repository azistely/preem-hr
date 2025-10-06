/**
 * Read-Only Field Component
 *
 * Displays a field value that cannot be edited (defined by law/template)
 * Shows a lock badge to indicate the field is protected
 */

import { Lock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface ReadOnlyFieldProps {
  label: string;
  value: string | number | boolean;
  description?: string;
  reason?: string; // e.g., "Défini par la Convention Collective"
}

export function ReadOnlyField({ label, value, description, reason = "Défini par la loi" }: ReadOnlyFieldProps) {
  const displayValue = typeof value === 'boolean'
    ? (value ? 'Oui' : 'Non')
    : value;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <label className="text-sm font-medium text-muted-foreground">{label}</label>
        <Badge variant="secondary" className="gap-1 text-xs">
          <Lock className="h-3 w-3" />
          {reason}
        </Badge>
      </div>
      <div className="rounded-md border border-muted bg-muted/30 px-3 py-2 text-sm">
        {displayValue}
      </div>
      {description && (
        <p className="text-xs text-muted-foreground">{description}</p>
      )}
    </div>
  );
}
